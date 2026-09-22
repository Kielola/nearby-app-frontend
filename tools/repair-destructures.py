#!/usr/bin/env python3
"""
Regenerate every `const { ... } = use<X>Domain;` block from the hook module.

## Why this exists

`trim-domain-destructures.py` iterated over `range(len(lines))` while deleting
from the same list. `range` is evaluated once, so after the first deletion the
remaining indices no longer pointed at the blocks they were computed from, and
the tool cut ten lines out of unrelated places — notably the tail of several
destructures and two `useState` initialisers.

The hook modules are the source of truth for what each domain exports, so the
destructures can be rebuilt exactly rather than pieced back together.

This rewrites each destructure to list every key the hook returns. Run
`npx tsc --noEmit`, then `tools/trim-domain-destructures.py` to strip the keys
the controller's body does not actually reference.

Usage: python3 tools/repair-destructures.py
"""

import re
from pathlib import Path

CONTROLLER = Path('src/app/hooks/useNearbyController.ts')
IMPORT_RE = re.compile(r"^import \{ (use\w+) \} from '([^']+)';")


def hook_returns(module_path: Path) -> list:
    """The keys the hook's `return { ... }` exposes, in source order."""
    src = module_path.read_text()
    m = re.search(r'\n  return \{\n(.*?)\n  \};', src, re.S)
    if not m:
        return []
    return [l.strip()[:-1] for l in m.group(1).split('\n') if l.strip().endswith(',')]


def main():
    lines = CONTROLLER.read_text().split('\n')

    # hook name -> keys, from the imports the controller already has
    hooks = {}
    for line in lines:
        m = IMPORT_RE.match(line)
        if not m:
            continue
        name, spec = m.group(1), m.group(2)
        target = (CONTROLLER.parent / spec).resolve()
        for cand in (target.with_suffix('.ts'), target.with_suffix('.tsx'),
                     target / 'index.ts'):
            if cand.exists():
                keys = hook_returns(cand)
                if keys:
                    hooks[name] = keys
                break

    print(f'  {len(hooks)} hook module(s) found')
    # bottom-up so earlier line numbers stay valid
    for name in sorted(hooks, key=lambda n: -next(
            (i for i, l in enumerate(lines) if f'const {n}Domain = {name}(' in l), 0)):
        keys = hooks[name]
        call = next((i for i, l in enumerate(lines) if f'const {name}Domain = {name}(' in l), None)
        if call is None:
            print(f'  ⚠ {name}: no call site')
            continue

        # end of the call
        depth = 0
        for j in range(call, len(lines)):
            for ch in lines[j]:
                if ch in '{([':
                    depth += 1
                elif ch in '})]':
                    depth -= 1
            if depth <= 0 and j > call:
                call_end = j
                break

        # anything already sitting between the call and the next statement
        stop = call_end + 1
        while stop < len(lines) and (
            lines[stop].strip() == ''
            or lines[stop].strip().startswith('const {')
            or lines[stop].strip().startswith('//')
            or (lines[stop].startswith('    ') and lines[stop].rstrip().endswith(','))
            or lines[stop].strip() == f'}} = {name}Domain;'
            or re.match(r'^  \} = \w+Domain;$', lines[stop])
        ):
            stop += 1

        block = (
            ['  // Destructured for use below; the object itself is spread into the',
             '  // return so its keys do not have to be listed individually.',
             '  const {']
            + [f'    {k},' for k in keys]
            + [f'  }} = {name}Domain;']
        )
        lines[call_end + 1:stop] = block
        print(f'  {name:<26} → {len(keys)} name(s)')

    CONTROLLER.write_text('\n'.join(lines))
    print(f'\n  ✓ rewrote {CONTROLLER} ({len(lines)} lines)')


if __name__ == '__main__':
    main()

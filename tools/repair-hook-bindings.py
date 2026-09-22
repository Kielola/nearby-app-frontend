#!/usr/bin/env python3
"""
Rebuild every hook binding in the controller from the hook modules themselves.

## Why

`trim-domain-destructures.py` iterated `range(len(lines))` while deleting from
that same list. `range` is evaluated once, so after the first deletion the
remaining indices no longer pointed at the blocks they were computed from. Ten
lines were cut from unrelated places: the tail of several destructures, two
`useState` initialisers, and a stray `);`.

## The two patterns

Manual extractions bind the names directly:

    const { sendMessage, playVoiceNote } = useChatActions({ ...deps });

The generator prefers an intermediate object:

    const useMessagesDomain = useMessages({ ...deps });
    const { markMessagesAsRead } = useMessagesDomain;

Both are rebuilt from the hook module: its `Deps` interface is the call's
argument list, its `return { ... }` is the binding list. That is exact, rather
than piecing the wreckage back together by hand.

Usage: python3 tools/repair-hook-bindings.py
"""

import re
from pathlib import Path

CONTROLLER = Path('src/app/hooks/useNearbyController.ts')
IMPORT_RE = re.compile(r"^import \{ (use\w+) \} from '([^']+)';")


def parse_module(path: Path):
    """-> (dep names, returned names) for a hook module."""
    src = path.read_text()

    deps = []
    m = re.search(r'export interface \w+Deps \{(.*?)\n\}', src, re.S)
    if m:
        deps = re.findall(r'^\s+(\w+):', m.group(1), re.M)

    ret = []
    m = re.search(r'\n  return \{\n(.*?)\n  \};', src, re.S)
    if m:
        ret = [l.strip()[:-1] for l in m.group(1).split('\n') if l.strip().endswith(',')]
    return deps, ret


def end_of_call(lines, start):
    depth = 0
    for j in range(start, len(lines)):
        for ch in lines[j]:
            if ch in '{([':
                depth += 1
            elif ch in '})]':
                depth -= 1
        if depth <= 0 and j > start:
            return j
    raise AssertionError('unterminated call')


def main():
    lines = CONTROLLER.read_text().split('\n')

    modules = {}
    for line in lines:
        m = IMPORT_RE.match(line)
        if not m:
            continue
        name, spec = m.group(1), m.group(2)
        target = (CONTROLLER.parent / spec).resolve()
        for cand in (target.with_suffix('.ts'), target.with_suffix('.tsx'), target / 'index.ts'):
            if cand.exists():
                deps, ret = parse_module(cand)
                if ret:
                    modules[name] = (deps, ret)
                break

    report = []

    # ── pass 1: clean up orphaned `});` left behind by deleted destructures ──
    i = 0
    while i < len(lines) - 1:
        if (lines[i].strip() == '});' and lines[i + 1].strip() == ''
            and i > 0 and re.match(r'^  \} = \w+Domain;$', lines[i - 1])):
            del lines[i]
            report.append('removed an orphaned `});`')
            continue
        i += 1

    # ── pass 2: rebuild each hook binding, bottom-up ────────────────────────
    order = sorted(
        modules,
        key=lambda n: -next((i for i, l in enumerate(lines) if f'use{n[3:]}(' in l), 0),
    )
    for name in order:
        deps, ret = modules[name]
        domain = name[3].lower() + name[4:] + 'Domain'   # useChatList -> chatListDomain

        call = next((i for i, l in enumerate(lines) if f'{domain} = {name}(' in l), None)
        if call is not None:
            call_end = end_of_call(lines, call)
            # the binding header sits between the previous statement and the call
            head = call - 1
            while head > 0 and (lines[head].startswith('    ') or lines[head].strip() in ('const {', '//')
                                or lines[head].strip() == ''
                                or lines[head].strip().startswith('//')):
                head -= 1
            head += 1
            # and the value binding sits after the call
            stop = call_end + 1
            while stop < len(lines) and (
                lines[stop].strip() == '' or lines[stop].strip().startswith('//')
                or lines[stop].strip().startswith('const {')
                or re.match(r'^  \} = \w+Domain;$', lines[stop])
                or (lines[stop].startswith('    ') and lines[stop].rstrip().endswith(','))
            ):
                stop += 1
            lines[head:stop] = (
                [f'  const {domain} = {name}({{']
                + [f'    {d},' for d in deps]
                + ['  });',
                   '  // Destructured for use below; the object itself is spread into the',
                   '  // return so its keys do not have to be listed individually.',
                   '  const {']
                + [f'    {k},' for k in ret]
                + [f'  }} = {domain};']
            )
            report.append(f'{name}: rebuilt call + {len(ret)} binding(s)')
        else:
            # the call is gone entirely — regenerate it from the Deps interface
            ret_pos = next(k for k, l in enumerate(lines) if l == '  return {')
            lines[ret_pos:ret_pos] = (
                [f'  const {domain} = {name}({{']
                + [f'    {d},' for d in deps]
                + ['  });',
                   '  // Destructured for use below; the object itself is spread into the',
                   '  // return so its keys do not have to be listed individually.',
                   '  const {']
                + [f'    {k},' for k in ret]
                + [f'  }} = {domain};', '']
            )
            report.append(f'{name}: REGENERATED missing call, {len(deps)} deps')

    CONTROLLER.write_text('\n'.join(lines))
    for r in report:
        print(f'  {r}')
    print(f'\n  ✓ {CONTROLLER} ({len(lines)} lines)')


if __name__ == '__main__':
    main()

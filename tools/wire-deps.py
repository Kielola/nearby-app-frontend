#!/usr/bin/env python3
"""
After moving a block into its own module, fix what the compiler says is missing.

## What it does

`extract-domain.py` moves code but cannot know two things:

  1. **Imports.** The analyser deliberately ignores imported names when listing
     dependencies (they are not closure captures), so the new module has to
     re-import them itself. A moved file therefore always starts with a handful
     of `Cannot find name` errors for things like `auth` or `mediaApi`.

  2. **Values that are controller locals.** Anything the moved code reads that is
     declared elsewhere in the controller has to arrive through the `Deps`
     interface — added to the interface, the destructure, and the call site.

This walks the compiler output, resolves each missing name against the
controller's own import table, and does both.

## Usage

    python3 tools/wire-deps.py src/features/friends/hooks/useSocialActions.ts \\
        --hook useSocialActions

Run `npx tsc --noEmit` first; this reads its output. Run it again afterwards to
confirm, then run the test suite — wiring is mechanical, but a *wrong* wiring
still compiles if both sides end up `any`.
"""

import argparse
import os
import re
import subprocess
from pathlib import Path

CONTROLLER = 'src/app/hooks/useNearbyController.ts'


def tsc_errors():
    proc = subprocess.run(['./node_modules/.bin/tsc', '--noEmit'],
                          capture_output=True, text=True)
    return proc.stdout + proc.stderr


def controller_imports():
    """name -> (module specifier, is_type_only) for everything the controller imports.

    The type flag matters. `LocationOutcome` is a union type; passing it through
    the `Deps` interface and the call site makes TypeScript read it as a value
    and fail with `TS2693: 'LocationOutcome' only refers to a type`. Types must
    arrive as `import type` on the hook side and must never be forwarded as
    parameters.
    """
    table = {}
    text = Path(CONTROLLER).read_text()

    # `import React, { useState } from 'react'` — default and named in one
    # statement. The named list is what most of the table needs, and the default
    # binding is registered separately just below.
    for m in re.finditer(r"import\s+(type\s+)?([A-Za-z_$][\w$]*)\s*,\s*\{([^}]+)\}\s*from\s+'([^']+)'", text):
        is_type = bool(m.group(1))
        default_name = m.group(2)
        spec = m.group(4)
        if re.fullmatch(r'[A-Za-z_$][\w$]*', default_name):
            table.setdefault(default_name, (spec, is_type))
        for part in m.group(3).split(','):
            part = re.sub(r'^type\s+', '', part.strip())
            name = part.split(' as ')[-1].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', name):
                table.setdefault(name, (spec, is_type))

    for m in re.finditer(r"import\s+(type\s+)?\{([^}]+)\}\s+from\s+'([^']+)'", text):
        whole_block_is_type = bool(m.group(1))
        for part in m.group(2).split(','):
            part = part.strip()
            if not part:
                continue
            is_type = whole_block_is_type or part.startswith('type ')
            part = re.sub(r'^type\s+', '', part)
            name = part.split(' as ')[-1].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', name):
                table.setdefault(name, (m.group(3), is_type))

    for m in re.finditer(r"import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s+from\s+'([^']+)'", text):
        table.setdefault(m.group(1), (m.group(2), False))

    return table


def relative_module(from_file: Path, ctl_spec: str) -> str:
    """Resolve a controller-relative specifier into one relative to `from_file`.

    Bare package specifiers ('firebase/auth', 'react') are not paths and must be
    re-emitted verbatim — resolving them against the controller's directory
    produced imports like '../../../app/hooks/firebase/auth'.
    """
    if not ctl_spec.startswith('.'):
        return ctl_spec

    target = (Path('src/app/hooks') / ctl_spec).resolve()

    # Try the concrete file, then a directory index — the controller imports
    # `'../../lib/api'`, which is a folder, and `'../../types'`, which is a file.
    candidates = [target.with_suffix('.ts'), target.with_suffix('.tsx'),
                  target / 'index.ts', target / 'index.tsx', target]
    resolved = next((c for c in candidates if c.exists()), target)

    rel = os.path.relpath(resolved, from_file.parent.resolve())
    rel = rel.replace('\\', '/')
    if not rel.startswith('.'):
        rel = './' + rel
    # strip the extension; TS resolves it and shorter paths read better
    for ext in ('.tsx', '.ts'):
        if resolved.suffix == ext:
            rel = rel[: -len(ext)]
            break
    if rel.endswith('/index'):
        rel = rel[: -len('/index')]
    return rel


# React hooks are imported, never passed in as dependencies. Without this the
# tool wires `useCallback` through the Deps interface and the call site, which
# compiles — the controller happens to have it in scope — but is nonsense.
REACT_HOOKS = {
    'useCallback', 'useMemo', 'useEffect', 'useState', 'useRef', 'useReducer',
    'useLayoutEffect', 'useContext', 'useImperativeHandle', 'useTransition',
    'useDeferredValue', 'useId', 'useSyncExternalStore',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--hook', required=True)
    args = ap.parse_args()

    target = Path(args.file)
    source = target.read_text()
    errors = tsc_errors()

    missing = set()
    for m in re.finditer(rf"{re.escape(str(target))}\(\d+,\d+\): error TS2304: Cannot find name '(\w+)'", errors):
        missing.add(m.group(1))
    for m in re.finditer(rf"{re.escape(str(target))}\(\d+,\d+\): error TS2503: Cannot find namespace '(\w+)'", errors):
        missing.add(m.group(1))

    if not missing:
        print('  nothing missing — check for other error classes')
        for line in errors.split('\n'):
            if str(target) in line:
                print('   ', line)
        return

    print(f'  missing in {target.name}: {", ".join(sorted(missing))}')

    imports = controller_imports()
    ctl = Path(CONTROLLER)
    ctl_text = ctl.read_text()

    to_import, to_pass, to_import_type = {}, [], {}
    react_used = sorted(missing & REACT_HOOKS)

    for name in sorted(missing):
        if name in REACT_HOOKS:
            continue
        if name in imports:
            spec, is_type = imports[name]
            spec = relative_module(target, spec)
            if is_type:
                to_import_type.setdefault(spec, []).append(name)
            else:
                to_import.setdefault(spec, []).append(name)
        else:
            to_pass.append(name)

    if react_used:
        to_import.setdefault('react', []).extend(react_used)

    # ── add imports ──────────────────────────────────────────────────────
    if to_import or to_import_type:
        block = ''.join(
            f"import {{ {', '.join(sorted(set(names)))} }} from '{spec}';\n"
            for spec, names in sorted(to_import.items())
        ) + ''.join(
            f"import type {{ {', '.join(sorted(set(names)))} }} from '{spec}';\n"
            for spec, names in sorted(to_import_type.items())
        )
        lines = source.split('\n')
        last = max((i for i, l in enumerate(lines) if l.startswith('import ')), default=-1)
        lines[last + 1:last + 1] = block.rstrip('\n').split('\n')
        source = '\n'.join(lines)
        for spec, names in sorted(to_import.items()):
            print(f'  + import {{ {", ".join(sorted(set(names)))} }} from \'{spec}\'')

    # ── add missing names to the Deps interface, destructure, and call ────
    if to_pass:
        iface_name = args.hook[0].upper() + args.hook[1:] + 'Deps'
        # Never re-add what is already there. Each pass used to append
        # unconditionally, so a name that stayed unresolved across passes was
        # written as many times as the tool was run (TS1117, four `React` keys).
        already = set(re.findall(r'^\s*([A-Za-z_$][\w$]*)\s*[,:}]', source, re.M))
        to_pass = [n for n in to_pass if n not in already]
        if not to_pass:
            target.write_text(source)
            print('  ✓ nothing left to wire')
            return

        iface_m = re.search(rf'export interface {iface_name} \{{(.*?)\n\}}', source, re.S)
        if not iface_m:
            print(f'  ! could not find interface {iface_name}')
        else:
            extra = ''.join(f'  {n}: any;\n' for n in to_pass)
            source = source[:iface_m.end(1)] + '\n' + extra.rstrip('\n') + source[iface_m.end(1):]
            print(f'  + {iface_name}: {", ".join(to_pass)}')

        # `const {\n  } = deps;` is the shape a freshly generated hook has, and the
        # old pattern here demanded at least one name between the braces. When it
        # failed to match it left `m` holding the *interface* match from the module
        # file, and the controller was then spliced at that object's offset — a
        # position a few hundred characters in, which lands inside the import list.
        # Match both shapes, and never reuse a variable across the two files.
        destructure_m = re.search(r'const \{(.*?)\} = deps;', source, re.S)
        if destructure_m:
            add = ''.join(f'    {n},\n' for n in to_pass)
            source = (source[:destructure_m.end(1)] + '\n' + add.rstrip('\n')
                      + source[destructure_m.end(1):])
        else:
            print(f'  ! could not find `= deps;` in {target.name} — deps not destructured')

        # Two call-site shapes: value domains bind their result
        # (`const useFooDomain = useFoo({...})`), effect domains return nothing
        # and are called bare (`useFoo({...})`). This must stay OUTSIDE the
        # `else:` above, or `call_m` is only bound when the destructure failed.
        call_m = (re.search(rf'const {args.hook}Domain = {args.hook}\(\{{(.*?)\n  \}}\);', ctl_text, re.S)
                  or re.search(rf'\n  const \{{[^}}]*\}} = {args.hook}\(\{{(.*?)\n  \}}\);', ctl_text, re.S)
                  or re.search(rf'\n  {args.hook}\(\{{(.*?)\n  \}}\);', ctl_text, re.S))
        if call_m:
            add = ''.join(f'    {n},\n' for n in to_pass)
            ctl_text = (ctl_text[:call_m.end(1)] + '\n' + add.rstrip('\n')
                        + ctl_text[call_m.end(1):])
            ctl.write_text(ctl_text)
            print(f'  + passed into {args.hook}(...) at the call site')
        else:
            print(f'  ! could not find the {args.hook}(...) call in the controller')

    target.write_text(source)
    print(f'  ✓ rewrote {target}')


if __name__ == '__main__':
    main()

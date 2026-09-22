#!/usr/bin/env python3
"""Move a contiguous block of effect wiring out of the controller into a hook.

`extract-domain.py` moves *named declarations*. A lot of what is left in the
controller is not a named declaration at all — it is a run of `useEffect(...)`
calls that close over half the component. There is no name to ask for, so this
tool takes a line range instead.

    python3 tools/extract-effects.py --lines 1017:1123 \
        --out src/features/authentication/hooks/useAuthRedirect.ts \
        --hook useAuthRedirect \
        --title "Auth redirect handling" \
        --doc "Completes a Google sign-in that came back through a redirect." \
        --dry-run

Then, because the moved code references names that live in the controller:

    python3 tools/wire-deps.py <new-file> --hook <hook>    # repeat until quiet
    npx tsc --noEmit

`wire-deps.py` is the part that resolves dependencies, and it is deliberately
iterative: it reads the compiler's own TS2304/TS2503 output rather than
guessing which identifiers the block closed over. Guessing is what produced the
327-line module full of unresolved names earlier in this refactor.

Safety properties this tool enforces, because each of them has cost a broken
build at some point:

  * the range must start on a statement and end on a statement — checked by
    bracket balance and a trailing `;`, not by eyeballing the line numbers;
  * the extracted text is moved verbatim, dedented exactly two spaces, so
    template literals and indentation inside the block survive;
  * the call site replaces the block *in place*, so hook order is preserved and
    nothing that ran before it starts running after it;
  * `--dry-run` prints the plan without touching either file.
"""
import argparse
import os
import re
from pathlib import Path

CONTROLLER = Path('src/app/hooks/useNearbyController.ts')

# Statements that are complete on their own line, so the range can safely begin
# or end there. `});` closes a useEffect / useCallback; `;` closes anything else.
END_RE = re.compile(r'(;\s*$|\}\);\s*$|\}\)\s*;\s*$)')


def depth_delta(line):
    """Net bracket depth of one line, ignoring strings, comments and templates.

    Approximate by design — the same caveat as everywhere else in these tools.
    It is used to sanity-check a range, not to prove one, and the compiler is
    the actual authority.
    """
    out, i, quote = 0, 0, None
    while i < len(line):
        c = line[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '"\'`':
            quote = c
        elif c == '/' and i + 1 < len(line) and line[i + 1] == '/':
            break
        elif c in '{([':
            out += 1
        elif c in '})]':
            out -= 1
        i += 1
    return out


def check_range(lines, a, b):
    """a and b are 1-based inclusive. Returns a list of complaints."""
    bad = []
    start = lines[a - 1]
    end = lines[b - 1]

    if not end.rstrip().endswith((';', '});')):
        bad.append(f'line {b} does not end a statement: {end.strip()[:70]!r}')

    # The block must be internally balanced: everything the effect opened, it closed.
    net = 0
    for n in range(a, b + 1):
        net += depth_delta(lines[n - 1])
        if net < 0:
            bad.append(f'bracket depth goes negative at line {n}')
            break
    if net != 0:
        bad.append(f'brackets do not balance across the range (net {net:+d})')

    if start[:2] != '  ' or start[:4] == '    ':
        bad.append(f'line {a} is not at component-body indentation: {start[:50]!r}')
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lines', default='', help='A:B, 1-based inclusive')
    ap.add_argument('--at', default='',
                    help='unique text on the first line of the block; the end is found '
                         'by bracket depth. Preferred over --lines, which goes stale the '
                         'moment any earlier edit changes the file length.')
    ap.add_argument('--out', required=True)
    ap.add_argument('--hook', required=True)
    ap.add_argument('--title', default='')
    ap.add_argument('--doc', default='')
    ap.add_argument('--returns', default='',
                    help='comma-separated names the hook hands back to the controller. '
                         'A block that produces values is still a block; without this '
                         'it would stay in the controller forever.')
    ap.add_argument('--count', type=int, default=1,
                    help='how many top-level statements to consume. A banner comment '
                         'followed by two related effects is one logical block, not two.')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    ctl_lines = CONTROLLER.read_text().split('\n')

    if args.at:
        hits = [i + 1 for i, l in enumerate(ctl_lines) if args.at in l]
        if len(hits) != 1:
            print(f'  ✗ --at matched {len(hits)} lines (need exactly 1): {hits[:8]}')
            return
        a = hits[0]
        depth, b, seen = 0, None, 0
        for n in range(a, len(ctl_lines) + 1):
            depth += depth_delta(ctl_lines[n - 1])
            if depth == 0 and n > a and ctl_lines[n - 1].startswith('  ') \
                    and not ctl_lines[n - 1].startswith('    ') \
                    and ctl_lines[n - 1].rstrip().endswith(';'):
                seen += 1
                if seen >= args.count:
                    b = n
                    break
        if b is None:
            print(f'  ✗ could not find the end of the block starting at line {a}')
            return
    elif args.lines:
        a, b = (int(x) for x in args.lines.split(':'))
    else:
        print('  ✗ pass either --at or --lines')
        return

    problems = check_range(ctl_lines, a, b)
    if problems:
        print('  ✗ refusing to move — the range is not a clean statement block:')
        for p in problems:
            print(f'      {p}')
        return

    block = ctl_lines[a - 1:b]
    print(f'  moving lines {a}-{b} ({len(block)} lines) out of the controller')
    print(f'    first: {block[0].strip()[:78]}')
    print(f'    last:  {block[-1].strip()[:78]}')

    # Dedent exactly one level. Anything deeper stays deeper.
    body = [l[2:] if l.startswith('  ') else l for l in block]

    hooks = sorted({m for m in re.findall(r'\b(use[A-Z]\w*)\s*\(', '\n'.join(body))
                    if m not in {'use'}})
    react_hooks = [h for h in hooks if h in {
        'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useReducer',
        'useLayoutEffect', 'useContext', 'useImperativeHandle'}]
    external_hooks = [h for h in hooks if h not in react_hooks]

    if external_hooks:
        print(f'  note: references other hooks — {", ".join(external_hooks)}')
        print('        they will be reported by wire-deps.py as missing imports')

    imports = ''
    if react_hooks:
        imports = f"import {{ {', '.join(react_hooks)} }} from 'react';\n\n"
    returns = [r.strip() for r in args.returns.split(',') if r.strip()]
    if returns:
        call = f"  const {{ {', '.join(returns)} }} = {args.hook}({{\n  }});"
    else:
        call = f"  {args.hook}({{\n  }});"


    header = (
        f"{imports}"
        f"/**\n"
        f" * {args.title or args.hook}\n"
        f" *\n"
        f" * {args.doc or 'Extracted from useNearbyController.'}\n"
        f" *\n"
        f" * Every value this block reads is declared in `{args.hook[0].upper() + args.hook[1:]}Deps`\n"
        f" * rather than reached for through a closure, so the coupling is visible\n"
        f" * and the compiler enforces it.\n"
        f" */\n"
        f"export interface {args.hook[0].upper() + args.hook[1:]}Deps {{\n"
        f"}}\n"
        f"\n"
        f"export function {args.hook}(deps: {args.hook[0].upper() + args.hook[1:]}Deps) {{\n"
        f"  const {{\n"
        f"  }} = deps;\n"
        f"\n"
        f"{chr(10).join(body)}\n"
        + (f"\n  return {{ {', '.join(returns)} }};\n" if returns else '')
        + f"}}\n"
        f"\n"
        f"export default {args.hook};\n"
    )

    if args.dry_run:
        print(f'\n  → would write {args.out} ({len(header.splitlines())} lines)')
        print(f'  → would leave in the controller, at line {a}:')
        print(f'      {call.splitlines()[0]}')
        print(f'      {call.splitlines()[1]}')
        print('  → then run:  python3 tools/wire-deps.py '
              f'{args.out} --hook {args.hook}   (repeat until it says "nothing missing")')
        return

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        print(f'  ✗ {out} already exists — refusing to overwrite')
        return
    out.write_text(header)

    ctl_lines[a - 1:b] = call.split('\n')

    # The controller has to import the hook it now calls. Anchoring on line 1
    # (`import React ... from 'react';`) rather than on the last import keeps
    # this safe against the multi-line lucide-react import — appending after
    # that block once put dependency names *inside* the braced list.
    rel = os.path.relpath(out.resolve(), CONTROLLER.parent.resolve())
    rel = rel.replace('\\', '/')
    if not rel.startswith('.'):
        rel = './' + rel
    for ext in ('.tsx', '.ts'):
        if rel.endswith(ext):
            rel = rel[: -len(ext)]
            break
    import_line = f"import {{ {args.hook} }} from '{rel}';"
    if not any(l.startswith(f"import {{ {args.hook} }} from") for l in ctl_lines):
        ctl_lines.insert(1, import_line)
        print(f'  ✓ controller imports it: {import_line}')

    CONTROLLER.write_text('\n'.join(ctl_lines))

    print(f'  ✓ wrote {out} ({len(header.splitlines())} lines)')
    print(f'  ✓ controller {len(ctl_lines)} lines — block replaced in place, hook order kept')
    print(f'  → next:  python3 tools/wire-deps.py {args.out} --hook {args.hook}')
    print('           npx tsc --noEmit')


def code_only(line):
    """The code part of a line — everything before a `//` comment.

    Used when testing whether a line terminates a statement. Testing the raw
    line means a block whose last line has a trailing comment reads as
    unterminated, and the walk then swallows the next block too.
    """
    out, i, quote = [], 0, None
    while i < len(line):
        c = line[i]
        if quote:
            out.append(c)
            if c == chr(92):
                if i + 1 < len(line):
                    out.append(line[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '"' + chr(39) + '`':
            quote = c
            out.append(c)
        elif c == '/' and i + 1 < len(line) and line[i + 1] == '/':
            break
        else:
            out.append(c)
        i += 1
    return ''.join(out)


if __name__ == '__main__':
    main()

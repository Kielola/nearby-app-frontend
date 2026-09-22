#!/usr/bin/env python3
"""
Move a domain out of `useNearbyController.ts` in one step.

## The pattern this automates

A naive extraction moves the *logic* but leaves the controller's 600-key return
object untouched, so the file barely shrinks. The point of this tool is to move
the *surface* too:

    const chatDomain = useChatDomain({ ...deps });

    // Destructured for use inside the rest of the controller. No renaming
    // anywhere — the names are identical to what they were before.
    const { chatMessages, setChatMessages, sendMessage } = chatDomain;

    return {
      ...chatDomain,      // ← replaces ~50 individual `key,` lines
      ...socialDomain,
    };

Spreading AND destructuring the same object is deliberate: the spread collapses
the return object, the destructure keeps every existing reference working, and
neither requires touching the code that consumes those names.

## Disjoint domains

A domain's declarations are usually clustered, but not always — stories live in
seven places. The tool groups the selected declarations into contiguous runs and
moves each run, joining them in the new module in their original order. An
interstitial block is only absorbed into a run when it contains nothing but
blank lines and comments; anything else breaks the run, so unrelated code is
never swept up by accident. The tool prints every run before writing.

## Safety

This tool writes the module and rewrites the controller. It does NOT verify.
Run `npx tsc --noEmit` immediately afterwards — the analyser under-reports
dependencies by design (it cannot see type-only imports or browser globals), and
the compiler is the authority. A missing name is `TS2304`; a wrong signature is
`TS2345`. Then run `tools/wire-deps.py` against the new module, which resolves
the `TS2304`s automatically.

Usage:
    python3 tools/extract-domain.py \
        --names stateA,stateB,handlerC \
        --out src/features/chat/hooks/useChatDomain.ts \
        --hook useChatDomain \
        --title "Chat state and actions" \
        --doc "What this domain owns." \
        --dry-run
"""

import argparse
import os
import re
import sys
from pathlib import Path

CONTROLLER = 'src/app/hooks/useNearbyController.ts'

BUILTINS = {
    'true', 'false', 'null', 'undefined', 'this', 'new', 'typeof', 'instanceof',
    'in', 'of', 'return', 'await', 'async', 'function', 'const', 'let', 'var',
    'try', 'catch', 'finally', 'throw', 'switch', 'case', 'default', 'break',
    'continue', 'for', 'while', 'do', 'delete', 'void', 'if', 'else', 'class',
    'extends', 'import', 'export', 'JSON', 'Math', 'Object', 'Array', 'String',
    'Number', 'Boolean', 'Date', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Symbol', 'Proxy', 'Reflect', 'Error', 'TypeError', 'RegExp', 'Function',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'console',
    'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch',
    'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData', 'Image',
    'Audio', 'AbortController', 'TextEncoder', 'TextDecoder', 'crypto',
    'performance', 'structuredClone', 'queueMicrotask', 'globalThis', 'process',
    'atob', 'btoa', 'MediaStream', 'AudioContext', 'RTCPeerConnection',
    'SpeechSynthesisUtterance', 'CustomEvent', 'Event', 'Infinity', 'NaN',
}


def bound_names(line):
    for pat in (
        r'^  (?:const|let|var)\s+([A-Za-z_$][\w$]*)',
        r'^  (?:async\s+)?function\s+([A-Za-z_$][\w$]*)',
    ):
        m = re.match(pat, line)
        if m:
            return [m.group(1)]
    m = re.match(r'^  (?:const|let|var)\s*\[([^\]]+)\]\s*=', line)
    if m:
        return [p.strip() for p in m.group(1).split(',')
                if re.fullmatch(r'[A-Za-z_$][\w$]*', p.strip())]
    m = re.match(r'^  (?:const|let|var)\s*\{([^}]+)\}\s*=', line)
    if m:
        return [p.split(':')[-1].strip() for p in m.group(1).split(',')
                if re.fullmatch(r'[A-Za-z_$][\w$]*', p.split(':')[-1].strip())]
    return []


def code_part(line):
    """The part of a line that is actually code: everything before a `//` comment.

    Declaration end-detection tested `line.rstrip().endswith(';')` on the raw
    line, so a declaration with a trailing comment —

        const [selectedSkinTone, setSelectedSkinTone] = useState<string>(''); // '🏻', '🏼' …

    — read as unterminated, and the walk then consumed the next declaration as
    well. `isLockVoiceRecording` was invisible to the extractor for exactly this
    reason. Quote-aware, so a `//` inside a string literal (a URL, say) is not
    mistaken for the start of a comment.
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


def index_declarations(lines):
    """name -> (start, end), 1-based inclusive."""
    spans, i = {}, 0
    while i < len(lines):
        if re.match(r'^  (?:const|function|async function|let|var)\s', lines[i]):
            # End of a declaration: the first line where the brackets balance
            # *and* the statement terminates. Brackets alone are not enough —
            # `const x = a && f(a)` balances on its own first line, so the old
            # test cut the declaration short and left `? b : c;` orphaned in the
            # controller as a syntax error.
            depth, end = 0, None
            for j in range(i, len(lines)):
                for ch in lines[j]:
                    if ch in '{([':
                        depth += 1
                    elif ch in '})]':
                        depth -= 1
                if depth <= 0 and code_part(lines[j]).rstrip().endswith(';'):
                    end = j
                    break
            if end is None:
                end = i
            for name in bound_names(lines[i]):
                spans[name] = (i + 1, end + 1)
            i = end + 1
        else:
            i += 1
    return spans


def declared_inside(block):
    names = set()
    for line in block:
        for m in re.finditer(r'\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', line):
            names.add(m.group(1))
        m = re.search(r'\b(?:const|let|var)\s*[\{\[]([^\}\]]+)[\}\]]\s*=', line)
        if m:
            for part in m.group(1).split(','):
                part = part.split(':')[-1].strip()
                if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                    names.add(part)
    return names


def used_identifiers(block):
    used = set()
    for line in block:
        s = re.sub(r'//.*', '', line)
        s = re.sub(r"'[^']*'", "''", s)
        s = re.sub(r'"[^"]*"', '""', s)
        s = re.sub(r'`[^`]*`', '``', s)
        for m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)', s):
            used.add(m.group(1))
    return used


def is_filler(lines):
    """True if every line is blank or a comment — safe to absorb into a run."""
    return all(not l.strip() or l.strip().startswith('//') for l in lines)


def build_runs(lines, spans, names):
    """Group the selected declarations into runs, absorbing only filler gaps.

    Returns a list of (start, end, [names]) with 1-based inclusive line bounds,
    in source order. A gap containing real code splits the run, which is what
    stops a scattered domain from dragging unrelated declarations along.
    """
    picked = sorted({spans[n] for n in names})
    runs = []
    for start, end in picked:
        if runs and is_filler(lines[runs[-1][1]:start - 1]):
            runs[-1] = (runs[-1][0], max(end, runs[-1][1]))
        else:
            runs.append((start, end))
    # attach the names each run actually contains
    out = []
    for start, end in runs:
        inside = sorted(
            n for n, (s, e) in spans.items() if s >= start and e <= end
        )
        out.append((start, end, inside))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--names', required=True, help='comma-separated declarations to move')
    ap.add_argument('--return-keys', default='', help='extra return keys to collapse')
    ap.add_argument('--out', required=True)
    ap.add_argument('--hook', required=True)
    ap.add_argument('--title', default='')
    ap.add_argument('--doc', default='')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    src = Path(CONTROLLER)
    text = src.read_text()
    lines = text.split('\n')
    spans = index_declarations(lines)

    names = [n.strip() for n in args.names.split(',') if n.strip()]
    missing = [n for n in names if n not in spans]
    if missing:
        sys.exit(f'  ✗ not found at top level: {missing}')

    runs = build_runs(lines, spans, names)
    total = sum(e - s + 1 for s, e, _ in runs)
    print(f'  moving {len(names)} declaration(s) in {len(runs)} run(s), {total} lines')
    for s, e, inside in runs:
        print(f'    {s}-{e}  ({e - s + 1} lines)  {", ".join(inside)}')

    blocks = [lines[s - 1:e] for s, e, _ in runs]
    moved_names = {n for _, _, inside in runs for n in inside}
    flat = [l for b in blocks for l in b]
    local = declared_inside(flat)
    used = used_identifiers(flat)

    outside = {n: se for n, se in spans.items() if n not in moved_names}
    deps = sorted((used & set(outside)) - local)

    imported = set()
    for line in lines[:400]:
        m = re.match(r"\s*import\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\s+from", line)
        if m:
            for part in (m.group(1) or m.group(2) or '').split(','):
                part = part.strip().split(' as ')[-1].strip()
                if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                    imported.add(part)
    re_import = sorted((used & imported) - local)
    unresolved = sorted(used - local - set(outside) - BUILTINS - imported)

    print(f'  deps: {len(deps)}   re-import: {len(re_import)}   unresolved: {len(unresolved)}')
    if unresolved:
        print(f'    unresolved: {", ".join(unresolved[:20])}')

    if args.dry_run:
        print('\n  deps:', ', '.join(deps))
        print('  re-import:', ', '.join(re_import))
        return

    iface = '\n'.join(
        f'  {d}: Dispatch<SetStateAction<any>>;' if d.startswith('set')
        else f'  {d}: any;'
        for d in deps
    )
    iface_name = args.hook[0].upper() + args.hook[1:] + 'Deps'

    doc = args.doc.strip() or f'{args.title}.'

    # Join the runs. Non-adjacent runs get a marker so a reader knows the
    # original file had them apart — that separation is sometimes real
    # (a declaration that had to sit near its consumer).
    parts = []
    for idx, ((s, e, inside), block) in enumerate(zip(runs, blocks)):
        if idx:
            parts.append(f'\n  // ── moved from {CONTROLLER} lines {s}-{e} ──\n')
        parts.append('\n'.join(('  ' + l if l.strip() else l) for l in block))
    moved = '\n'.join(parts)

    returned = [k.strip() for k in args.return_keys.split(',') if k.strip()]
    flat_return = sorted(set(moved_names) | set(returned))
    tail = '\n\n  return {\n' + ''.join(f'    {k},\n' for k in flat_return) + '  };\n}\n'

    header = f"""import type {{ Dispatch, SetStateAction }} from 'react';

/**
 * {args.title}
 *
 * {doc}
 *
 * ## Dependency interface
 *
 * {len(deps)} parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface {iface_name} {{
{iface}
}}

export function {args.hook}(deps: {iface_name}) {{
  const {{
{chr(10).join(f'    {d},' for d in deps)}
  }} = deps;

"""

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(header + moved + tail)

    # ── delete the runs, bottom-up so earlier indices stay valid ─────────
    for s, e, _ in sorted(runs, reverse=True):
        del lines[s - 1:e]
    after_delete = '\n'.join(lines)

    # ── insert the call immediately before the top-level return ──────────
    anchor = [i for i, l in enumerate(after_delete.split('\n')) if l == '  return {']
    assert len(anchor) == 1, f'expected one top-level return, found {len(anchor)}'
    n = anchor[0]
    nl = after_delete.split('\n')
    call = (
        [f'  const {args.hook}Domain = {args.hook}({{']
        + [f'    {d},' for d in deps]
        + ['  });',
           '  // Destructured for use below; the object itself is spread into the',
           '  // return so its keys do not have to be listed individually.',
           '  const {']
        + [f'    {k},' for k in flat_return]
        + ['  } = ' + args.hook + 'Domain;', '']
    )
    nl[n:n] = call
    text = '\n'.join(nl)

    # ── dedupe the return object ────────────────────────────────────────
    # A moved name that the controller *also* still lists individually (because
    # something else legitimately re-exports it) lands twice: once as itself and
    # once via the spread. That is `TS1117`. Earlier duplicates win, so the
    # explicit entry is kept and the redundant one is dropped.
    # ── collapse the return keys into a spread ───────────────────────────
    ret_start = next(i for i, l in enumerate(text.split('\n')) if l == '  return {')
    head = text.split('\n')[:ret_start]
    ret_region = text.split('\n')[ret_start:]
    keep = []
    for l in ret_region:
        stripped = l.strip()
        if stripped.endswith(',') and stripped[:-1] in set(flat_return):
            continue
        keep.append(l)
    insert_at = next(i for i, l in enumerate(keep) if l.strip() == 'return {')
    keep.insert(insert_at + 1, f'    ...{args.hook}Domain,')
    # dedupe after collapsing: a key can appear both explicitly and via a spread
    seen, deduped = set(), []
    for l in keep:
        st = l.strip()
        if st.endswith(',') and not st.startswith('...') and st.startswith('    '):
            key = st[:-1].strip()
            if key in seen:
                continue
            seen.add(key)
        deduped.append(l)
    text = '\n'.join(head + deduped)

    # ── add the import ──────────────────────────────────────────────────
    # Two things this has to get right, both learned the hard way:
    #
    #   * The controller's Firebase import is a multi-line block. Its closing
    #     `} from 'firebase/auth';` line does not start with `import`, so
    #     anchoring on the last line that *does* inserted the new import into
    #     the middle of that block and produced five syntax errors.
    #   * The output path is not necessarily under `src/app/hooks/`, so the
    #     specifier has to be computed by path arithmetic, not slicing.
    tl = text.split('\n')
    rel = os.path.relpath(args.out, 'src/app/hooks')
    spec = rel[:-3] if rel.endswith('.ts') else rel
    if not spec.startswith('.'):
        spec = './' + spec
    imp = f"import {{ {args.hook} }} from '{spec}';"

    ends = [
        i for i, l in enumerate(tl)
        if re.match(r"^import\s.*from\s.*;\s*$", l) or re.match(r"^\}\s*from\s*['\"].*", l)
    ]
    assert ends, 'no import statements found'
    tl.insert(max(ends) + 1, imp)
    text = '\n'.join(tl)

    src.write_text(text)
    print(f'  ✓ wrote {args.out}')
    print(f'  ✓ collapsed {len(flat_return)} return key(s) into `...{args.hook}Domain`')
    print(f'  ✓ rewrote {CONTROLLER} ({len(text.splitlines())} lines)')
    warn_if_consumed_earlier(text, flat_return)


def warn_if_consumed_earlier(after: str, moved_names):
    """Warn about moved names the controller body still calls directly.

    The hook call and its destructure go immediately before the top-level
    `return {` — the only position where every dependency is guaranteed to be
    declared. That is *after* the rest of the component body, so anything
    earlier that calls a moved name hits the temporal dead zone:

        TS2448: Block-scoped variable used before its declaration.

    That is a genuine ordering conflict, not a tool bug: the value has to exist
    before its own hook call. Keep that declaration inline, or move its consumer
    into the hook as well. This happened for real with
    `loadLocalAccountsFromDisk`, which `useAuthProfileSync` consumed ~60 lines
    above where the hook call goes.
    """
    lines = after.split('\n')
    try:
        ret = next(i for i, l in enumerate(lines) if l == '  return {')
    except StopIteration:
        return

    body = lines[:ret]
    offenders = []
    for name in moved_names:
        hits = [
            i + 1 for i, l in enumerate(body)
            if re.search(rf'(?<![\w$.]){re.escape(name)}(?![\w$])', l)
            and not l.lstrip().startswith('//')
        ]
        if hits:
            offenders.append((name, hits))

    if not offenders:
        return

    print()
    print('  ⚠ still referenced earlier in the body:')
    for name, hits in offenders:
        print(f'      {name}: line(s) {", ".join(map(str, hits[:6]))}')
    print('    If any of those are outside the returned object, expect TS2448.')


if __name__ == '__main__':
    main()

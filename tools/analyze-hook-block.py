#!/usr/bin/env python3
"""
Work out what an extracted block of code needs from the rest of the hook.

## Why this exists

`useNearbyController.ts` was one ~6,000-line function containing 130 top-level
declarations that all close over each other's variables. Splitting it up means
moving a block of code into its own module and passing in everything it used to
reach for via the closure.

Doing that by eye is how you get a runtime `ReferenceError` in a code path that
only fires on a Tuesday. This tool reads the block, finds every identifier it
uses, and reports which of those are defined elsewhere in the parent file — that
list is exactly the dependency list the extracted hook has to declare.

## Usage

    python3 tools/analyze-hook-block.py src/app/hooks/useNearbyController.ts \\
        2869 3022                 # by line range

    python3 tools/analyze-hook-block.py src/app/hooks/useNearbyController.ts \\
        --names handlePublishStoryComposition startStoryPlaylist

Output is grouped so it can be pasted straight into a `deps` interface:

  READ (used)      — values the block reads; must be passed in
  WRITTEN (called) — setters/dispatchers the block calls; must be passed in
  LOCAL            — declared inside the block; do NOT pass in
  GLOBAL           — browser/DOM/imported; nothing to do
"""

import re
import sys

# Identifiers that are always available and never need passing in.
BUILTINS = {
    'true', 'false', 'null', 'undefined', 'this', 'super', 'new', 'typeof',
    'instanceof', 'in', 'of', 'if', 'else', 'return', 'await', 'async', 'function',
    'const', 'let', 'var', 'class', 'try', 'catch', 'finally', 'throw', 'switch',
    'case', 'default', 'break', 'continue', 'for', 'while', 'do', 'delete', 'void',
    'yield', 'static', 'get', 'set', 'from', 'as', 'import', 'export', 'extends',
    'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date',
    'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect',
    'Error', 'TypeError', 'RangeError', 'SyntaxError', 'RegExp', 'Function',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent', 'encodeURI', 'decodeURI', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
    'console', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
    'fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
    'AbortController', 'TextEncoder', 'TextDecoder', 'crypto', 'performance',
    'structuredClone', 'queueMicrotask', 'globalThis', 'process', 'atob', 'btoa',
    'MediaStream', 'AudioContext', 'Audio', 'Image', 'CustomEvent', 'Event',
    'HTMLElement', 'Element', 'Node', 'RTCPeerConnection', 'RTCSessionDescription',
    'RTCIceCandidate', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver',
}


def extract_block(lines, start, end):
    """1-based inclusive line range."""
    return lines[start - 1:end]


def _bound_names(line):
    """
    Names bound by a top-level declaration line.

    Handles all three forms, because a hook's variables come from all three and
    missing the third one silently reports every setter as 'not a dependency':

        const foo = ...                  -> foo
        const [a, b] = useState(...)     -> a, b
        const { a, b } = useThing()      -> a, b
    """
    names = []
    m = re.match(r'^  (?:const|let|var)\s+([A-Za-z_$][\w$]*)', line)
    if m:
        return [m.group(1)]
    m = re.match(r'^  (?:const|let|var)\s*\[([^\]]+)\]\s*=', line)
    if m:
        for part in m.group(1).split(','):
            part = part.strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                names.append(part)
        return names
    m = re.match(r'^  (?:const|let|var)\s*\{([^}]+)\}\s*=', line)
    if m:
        for part in m.group(1).split(','):
            part = part.split(':')[-1].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                names.append(part)
        return names
    m = re.match(r'^  (?:async\s+)?function\s+([A-Za-z_$][\w$]*)', line)
    if m:
        return [m.group(1)]
    return []


def top_level_decls(lines):
    """Map every top-level declaration name to its (start, end) line span."""
    pat = re.compile(r'^  (?:const|function|async function|let|var)\s')
    spans = {}
    i = 0
    while i < len(lines):
        m = pat.match(lines[i])
        if m:
            depth, started, end = 0, False, i
            for j in range(i, len(lines)):
                for ch in lines[j]:
                    if ch in '{([':
                        depth += 1
                        started = True
                    elif ch in '})]':
                        depth -= 1
                if started and depth <= 0:
                    end = j
                    break
                if not started and lines[j].rstrip().endswith(';'):
                    end = j
                    break
            for name in _bound_names(lines[i]):
                spans[name] = (i + 1, end + 1)
            i = end + 1
        else:
            i += 1
    return spans


def declared_inside(block):
    """Names declared within the block itself."""
    names = set()
    for line in block:
        for m in re.finditer(r'\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', line):
            names.add(m.group(1))
        # destructuring: const { a, b } = ... / const [a, b] = ...
        m = re.search(r'\b(?:const|let|var)\s*[\{\[]([^\}\]]+)[\}\]]\s*=', line)
        if m:
            for part in m.group(1).split(','):
                part = part.split(':')[-1].strip()
                if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                    names.add(part)
        for m in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)', line):
            names.add(m.group(1))
        # arrow params / function params (single line)
        m = re.match(r'\s*\(?\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\)?\s*=>', line)
        if m:
            names.update(p.strip() for p in m.group(1).split(','))
    return names


def used_identifiers(block):
    """All identifier tokens used in the block, minus property accesses."""
    used = set()
    for line in block:
        stripped = re.sub(r'//.*', '', line)
        stripped = re.sub(r'/\*.*?\*/', '', stripped)
        # drop string and template contents
        stripped = re.sub(r"'[^']*'", "''", stripped)
        stripped = re.sub(r'"[^"]*"', '""', stripped)
        stripped = re.sub(r'`[^`]*`', '``', stripped)
        # identifier not preceded by a dot (so `foo.bar` yields only `foo`)
        for m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)', stripped):
            used.add(m.group(1))
    return used


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    path = sys.argv[1]
    lines = open(path).read().split('\n')
    spans = top_level_decls(lines)

    if sys.argv[2] == '--names':
        names = sys.argv[3:]
        if not all(n in spans for n in names):
            missing = [n for n in names if n not in spans]
            sys.exit(f'unknown declaration(s): {missing}')
        start = min(spans[n][0] for n in names)
        end = max(spans[n][1] for n in names)
        selected = set(names)
    else:
        start, end = int(sys.argv[2]), int(sys.argv[3])
        selected = {n for n, (s, e) in spans.items() if s >= start and e <= end}

    block = extract_block(lines, start, end)
    local = declared_inside(block)
    used = used_identifiers(block)

    # Names defined at file top level, outside the extracted block.
    outside = {
        n: s for n, (s, e) in spans.items()
        if n not in local and not (s >= start and e <= end)
    }

    deps = sorted(used & set(outside))
    reads = [d for d in deps if not d.startswith('set') and not d.startswith('toggle')]
    writes = [d for d in deps if d.startswith('set') or d.startswith('toggle')]

    imported = set()
    for line in lines[:200]:
        m = re.match(r'\s*import\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\s+from', line)
        if m:
            for part in (m.group(1) or m.group(2) or '').split(','):
                part = part.strip().split(' as ')[-1].strip()
                if re.fullmatch(r'[A-Za-z_$][\w$]*', part):
                    imported.add(part)

    print(f'\n  Block: {path}:{start}-{end}  ({end - start + 1} lines, '
          f'{len(selected)} declaration(s))\n')
    print(f'  READ — pass these in ({len(reads)}):')
    for d in reads:
        print(f'      {d}')
    print(f'\n  WRITTEN — pass these in too ({len(writes)}):')
    for d in writes:
        print(f'      {d}')
    print('\n  LOCAL — declared inside, do NOT pass (sample):')
    for d in sorted(local)[:14]:
        print(f'      {d}')
    if len(local) > 14:
        print(f'      … and {len(local) - 14} more')
    # Imported names the block uses must be re-imported in the new module.
    uses_imports = sorted((used & imported) - local)
    if uses_imports:
        print(f'\n  RE-IMPORT in the new module ({len(uses_imports)}):')
        for d in uses_imports:
            print(f'      {d}')

    unresolved = sorted(used - local - set(outside) - BUILTINS - imported)
    if unresolved:
        print(f'\n  UNRESOLVED — check these by hand ({len(unresolved)}):')
        for d in unresolved[:25]:
            print(f'      {d}')
    print()


if __name__ == '__main__':
    main()

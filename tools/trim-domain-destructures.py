#!/usr/bin/env python3
"""
Trim the `const { ... } = <hook>Domain;` destructures to only what is used.

## Why

`extract-domain.py` destructures every name a moved domain exports, so that the
rest of the controller keeps compiling without any renaming. That is correct but
wasteful: most domains export thirty names and the controller's *body* refers to
two of them. The other twenty-eight are only there for the `return { ...spread }`
— which already handles them.

Across fifteen domains that is a few hundred lines of pure noise, and worse, it
reads as if the controller depends on all of it.

This keeps a name in the destructure only if the name appears somewhere in the
component body *outside* the return object. Everything else is dropped, and the
spread still exposes it to consumers unchanged.

Usage:
    python3 tools/trim-domain-destructures.py --check
    python3 tools/trim-domain-destructures.py
"""

import argparse
import re
import sys
from pathlib import Path

CONTROLLER = 'src/app/hooks/useNearbyController.ts'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='report without writing')
    args = ap.parse_args()

    path = Path(CONTROLLER)
    lines = path.read_text().split('\n')

    # Find every domain destructure FIRST, then delete from the bottom up.
    #
    # The previous version iterated `for close in range(len(lines)-1, -1, -1)`
    # and mutated `lines` inside the loop. `range` is evaluated once, so once
    # deletions near the end had shrunk the list, the lower indices no longer
    # pointed at the blocks they were computed from — and the tool deleted ten
    # lines out of the middle of an unrelated `useState` initialiser.
    blocks = []
    for close, line in enumerate(lines):
        if not re.match(r'^  \} = \w+Domain;$', line):
            continue
        start = close - 1
        names = []
        while start > 0 and lines[start].startswith('    ') and lines[start].rstrip().endswith(','):
            names.append((start, lines[start].strip()[:-1].strip()))
            start -= 1
        if names and lines[start].strip() == 'const {':
            blocks.append((start, close, names))

    ret = next(i for i, l in enumerate(lines) if l == '  return {')

    # Decide everything against the ORIGINAL file, then apply once.
    #
    # Both earlier versions got this wrong. The first iterated over
    # `range(len(lines))` while deleting from `lines`, so stale indices cut ten
    # lines out of unrelated code. The second hoisted the block search but still
    # recomputed `body` inside the deletion loop, where `ret` had gone stale —
    # the slice then ran past the real return object and 36 more lines went with
    # it. Deciding first and deleting second is the only correct order.
    drop_all, decisions = set(), []
    for start, close, names in blocks:
        body = '\n'.join(lines[:start] + lines[close + 1:ret])
        drop = [
            idx for idx, name in names
            if not re.search(rf'(?<![\w$.]){re.escape(name)}(?![\w$])', body)
        ]
        if not drop:
            continue
        decisions.append((lines[close].strip()[4:-1], len(names) - len(drop), drop, names))
        drop_all.update(drop)

    for hook, kept, drop, names in sorted(decisions, key=lambda d: -d[2][0]):
        shown = [n for i, n in names if i in drop]
        print(f'  {hook:<30} keeps {kept:>2}, drops {len(drop):>2}   ({", ".join(shown[:5])}'
              f'{"…" if len(shown) > 5 else ""})')

    total_dropped = len(drop_all)
    if args.check:
        print(f'\n  would drop {total_dropped} line(s)')
        return
    for i in sorted(drop_all, reverse=True):
        del lines[i]
    path.write_text('\n'.join(lines))
    print(f'\n  ✓ dropped {total_dropped} line(s) → {len(lines)} total')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Move several effect blocks out of the controller in one pass, safely.

`extract-effects.py` moves one block and needs a line range. A line range is
only valid until the next edit, and every extraction inserts an import at the
top of the controller — so a list of ranges prepared in advance is wrong from
the second job onwards. This driver avoids that entirely by re-reading the file
before every job and locating the block by content.

    python3 tools/move-effect-runs.py tools/effect-jobs.json

Each job is:

    {
      "contains":     "text that appears in the block and nowhere else",
      "count":        1,                 // top-level statements to consume
      "out":          "src/features/.../useX.ts",
      "hook":         "useX",
      "title":        "One-line title",
      "doc":          "What it owns and why it is separate.",
      "returns":      ""                 // optional, comma-separated
    }

`contains` is matched against the whole block, not one line, which is what
makes it unique when several effects start with the same guard.
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

CONTROLLER = Path('src/app/hooks/useNearbyController.ts')


def load_extractor():
    spec = importlib.util.spec_from_file_location('ee', 'tools/extract-effects.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def effect_runs(lines):
    """Every top-level statement block in the component body, as (start, end).

    A block starts on a line indented exactly two spaces and ends when the
    bracket depth returns to zero on a line that also terminates a statement.
    Trailing `//` comments are ignored when testing for the terminator — without
    that, a block whose last line carries a comment reads as unterminated.
    """
    ee = load_extractor()
    runs, i, n = [], 0, len(lines)
    while i < n:
        line = lines[i]
        if not line.startswith('  ') or line.startswith('    ') or not line.strip():
            i += 1
            continue
        depth, end = 0, None
        for j in range(i, n):
            depth += ee.depth_delta(lines[j])
            if depth <= 0 and j > i and ee.END_RE.search(ee.code_only(lines[j])):
                end = j
                break
        if end is None:
            i += 1
            continue
        runs.append((i, end))
        i = end + 1
    return runs


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text())
    done, failed = [], []

    for job in jobs:
        lines = CONTROLLER.read_text().split('\n')
        hits = []
        for a, b in effect_runs(lines):
            block = '\n'.join(lines[a:b + 1])
            if job['contains'] in block:
                hits.append((a, b))

        if len(hits) != 1:
            print(f"  ✗ {job['hook']}: `{job['contains'][:50]}` matched "
                  f"{len(hits)} blocks — needs to be unique")
            failed.append(job['hook'])
            continue

        a, b = hits[0]
        # consume `count` statements: extend to the end of the nth block
        want = job.get('count', 1)
        if want > 1:
            runs = effect_runs(lines)
            idx = next(k for k, (ra, rb) in enumerate(runs) if ra == a)
            b = runs[min(idx + want - 1, len(runs) - 1)][1]

        print(f"── {job['hook']}  lines {a + 1}-{b + 1} ({b - a + 1} lines)")
        cmd = ['python3', 'tools/extract-effects.py', '--lines', f'{a + 1}:{b + 1}',
               '--out', job['out'], '--hook', job['hook'],
               '--title', job['title'], '--doc', job['doc']]
        if job.get('returns'):
            cmd += ['--returns', job['returns']]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if '✓ wrote' not in r.stdout:
            print('   ' + '\n   '.join(l for l in r.stdout.split('\n') if l.strip())[:400])
            failed.append(job['hook'])
            continue

        for _ in range(4):
            w = subprocess.run(['python3', 'tools/wire-deps.py', job['out'],
                                '--hook', job['hook']], capture_output=True, text=True)
            if 'nothing missing' in w.stdout:
                break
        done.append(job['hook'])
        print(f"   ✓ controller now {len(CONTROLLER.read_text().splitlines())} lines")

    print()
    print(f"  moved: {', '.join(done) if done else 'none'}")
    if failed:
        print(f"  failed: {', '.join(failed)}")


if __name__ == '__main__':
    main()

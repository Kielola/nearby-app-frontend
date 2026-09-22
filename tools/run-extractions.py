#!/usr/bin/env python3
"""
Run a list of domain extractions, verifying after each one.

Each extraction is: extract-domain.py -> tsc --noEmit -> wire-deps.py -> tsc.
The loop stops at the first failure and prints the compiler output, because a
red `tsc` makes every later line number in the controller a guess.

Usage: python3 tools/run-extractions.py tools/domains.json
"""

import json
import subprocess
import sys
from pathlib import Path

CTL = 'src/app/hooks/useNearbyController.ts'


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)


def lines_of(path):
    return len(Path(path).read_text().splitlines())


def tsc():
    p = sh('./node_modules/.bin/tsc', '--noEmit')
    out = (p.stdout + p.stderr).strip()
    return out


def main():
    domains = json.loads(Path(sys.argv[1]).read_text())
    start = lines_of(CTL)
    print(f'  starting at {start} lines\n')

    for d in domains:
        print(f'── {d["hook"]}  ({len(d["names"])} declarations)')
        cmd = [
            'python3', 'tools/extract-domain.py',
            '--names', ','.join(d['names']),
            '--out', d['out'],
            '--hook', d['hook'],
            '--title', d['title'],
            '--doc', d.get('doc', d['title']),
        ]
        if d.get('return_keys'):
            cmd += ['--return-keys', ','.join(d['return_keys'])]

        p = sh(*cmd)
        out = (p.stdout + p.stderr)
        if p.returncode != 0:
            print(out)
            sys.exit(f'  ✗ extractor failed on {d["hook"]}')

        # the run summary and any ordering warning are the parts worth reading
        for line in out.split('\n'):
            if any(k in line for k in ('run(s)', '✓', '⚠', 'TS2448')):
                print('   ', line.strip())

        err = tsc()
        if err:
            print('    tsc before wiring:')
            for line in err.split('\n')[:6]:
                print('     ', line)
            w = sh('python3', 'tools/wire-deps.py', d['out'], '--hook', d['hook'])
            for line in (w.stdout + w.stderr).split('\n'):
                if line.strip():
                    print('     wire:', line.strip())
            err = tsc()
            if err:
                print('    tsc AFTER wiring — stopping:')
                for line in err.split('\n')[:12]:
                    print('     ', line)
                sys.exit(f'  ✗ {d["hook"]} did not compile')

        print(f'    ✓ clean — {lines_of(CTL)} lines\n')

    end = lines_of(CTL)
    print(f'  {start} → {end} lines ({start - end} removed)')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Repair the controller damage left by the earlier (buggy) destructure trimmer.

Two versions of `trim-domain-destructures.py` deleted lines at stale indices.
This puts back everything they took, from the hook modules and the compiler's
complaints. It is idempotent: run it as many times as you like.

    python3 tools/repair-controller.py
    npx tsc --noEmit
"""

import re
from pathlib import Path

p = Path('src/app/hooks/useNearbyController.ts')
lines = p.read_text().split('\n')
did = []


def deps_of(path):
    s = Path(path).read_text()
    m = re.search(r'export interface \w+Deps \{(.*?)\n\}', s, re.S)
    return re.findall(r'^\s+(\w+):', m.group(1), re.M)


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
    raise AssertionError('unterminated')


# ── 1. the useChatActions binding header ─────────────────────────────────
if any(l.strip() == '} = useChatActions({' for l in lines):
    i = next(k for k, l in enumerate(lines) if l.strip() == '} = useChatActions({')
    if lines[i - 1].strip() != 'const {':
        names = ['playVoiceNote', 'triggerSimulatedResponse', 'sendMessage', 'handleReaction',
                 'handleDeleteForMe', 'handleDeleteForEveryone', 'handleForwardMessage']
        lines[i:i] = ['  const {'] + [f'    {n},' for n in names]
        did.append('restored the useChatActions binding header')

# ── 2. orphaned `});` after a domain destructure ─────────────────────────
k, removed = 0, 0
while k < len(lines) - 1:
    if lines[k].strip() == '});' and re.match(r'^  \} = \w+Domain;$', lines[k - 1]):
        del lines[k]
        removed += 1
        continue
    k += 1
if removed:
    did.append(f'removed {removed} orphaned `}});`')

# ── 3. bindings whose call or header was cut away ────────────────────────
for domain, module, returns, deps in [
    ('useContactsSyncDomain', 'src/features/friends/hooks/useContactsSync.ts',
     ['executeContactsSyncAfterPermission'], None),
    ('useAuthActionsDomain', 'src/features/authentication/hooks/useAuthActions.ts',
     ['loginWithEmailOrPhone', 'loginWithGoogle', 'logoutUser', 'saveOnboardingDetails'], None),
]:
    call = f'const {domain} = {domain[:-6]}('
    if any(call in l for l in lines):
        continue
    hook = domain[:-6]
    deps = deps or deps_of(module)
    ret = next((i for i, l in enumerate(lines) if l.strip() == f'}} = {domain};'), None)
    anchor = ret - 1 if ret is not None else next(
        i for i, l in enumerate(lines) if l == '  return {')
    if ret is not None:
        while lines[anchor].strip() in ('const {', '') or lines[anchor].strip().startswith('//') \
                or (lines[anchor].startswith('    ') and lines[anchor].rstrip().endswith(',')):
            anchor -= 1
        anchor += 1
        del lines[anchor:ret + 1]
    lines[anchor:anchor] = (
        [f'  const {domain} = {hook}({{']
        + [f'    {d},' for d in deps]
        + ['  });',
           '  // Destructured for use below; the object itself is spread into the',
           '  // return so its keys do not have to be listed individually.',
           '  const {']
        + [f'    {r},' for r in returns]
        + [f'  }} = {domain};']
    )
    did.append(f'regenerated the {hook} call + binding ({len(deps)} deps)')

# ── 4. duplicate closes and stray binding lines ──────────────────────────
i = 0
while i < len(lines) - 1:
    if (re.match(r'^  \} = \w+Domain;$', lines[i])
            and lines[i].strip() == lines[i + 1].strip()):
        del lines[i + 1]
        did.append('removed a duplicated destructure close')
        continue
    i += 1

# a bare `const {` immediately above another `const` is always debris
i = 1
while i < len(lines) - 1:
    if (lines[i].strip() == 'const {' and lines[i + 1].strip().startswith('const ')
            and not lines[i + 1].strip().startswith('const {')):
        del lines[i]
        did.append('removed a stray `const {`')
        continue
    i += 1

# ── 5. persistProfileToBackend lost its first line and closing brace ─────
if any(l.strip() == 'const persistProfileToBackend = async (patch: Record<string, unknown>) => {'
       for l in lines) and not any(l.strip() == 'await usersApi.updateMe(payload);' and
                                   lines[i + 1].strip() == '};'
                                   for i, l in enumerate(lines[:-1])):
    i = next(k for k, l in enumerate(lines)
             if l.strip() == 'const persistProfileToBackend = async (patch: Record<string, unknown>) => {')
    j = next(k for k, l in enumerate(lines) if l.strip() == 'await usersApi.updateMe(payload);')
    lines[i + 1:i + 1] = ['    const payload: Record<string, unknown> = {};']
    j += 1
    lines[j + 1:j + 1] = ['  };']
    did.append('restored persistProfileToBackend\'s payload and closing brace')

# ── 6. a key passed to a hook but declared nowhere ───────────────────────
for name in ('lastLiveLocationWriteTimeRef',):
    hits = [i for i, l in enumerate(lines) if l.strip() == f'{name},']
    decl = any(re.match(rf'^  const \w*{name}', l) for l in lines)
    if hits and not decl:
        del lines[hits[0]]
        did.append(f'removed the undeclared {name} key')

# ── 7. call sites missing arguments the hook's interface requires ────────
for hook, extra in [
    ('useSocialActions', ['appUser']),
    ('useChatManagement', ['_setChatMessages', 'chatMessages', 'currentUser', 'neighbors']),
]:
    i = next((k for k, l in enumerate(lines) if f'const use{hook[3:]}Domain = {hook}(' in l
              or f'= {hook}(' in l), None)
    if i is None:
        continue
    end = end_of_call(lines, i)
    have = {l.strip().rstrip(',') for l in lines[i + 1:end] if l.strip().endswith(',')}
    add = [d for d in extra if d not in have]
    if add:
        lines[end:end] = [f'    {d},' for d in add]
        did.append(f'{hook} arguments += {", ".join(add)}')

p.write_text('\n'.join(lines))
for d in did:
    print(f'  {d}')
print(f'  → {len(lines)} lines')

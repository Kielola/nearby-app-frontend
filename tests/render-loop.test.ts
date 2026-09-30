/**
 * Guards against the render loop that made the app feel broken.
 *
 * ## What was happening
 *
 * `usePresenceSync` returned `statusQuery.data ?? {}`. That `?? {}` builds a
 * BRAND-NEW object every time it is evaluated. The result is fed to a `useEffect`
 * dependency array, so a fresh identity re-ran the effect, which called
 * `setPresenceMap`, which re-rendered, which evaluated `?? {}` again.
 *
 * `setPresenceMap` could not break the cycle either, because the merge always
 * returned a new object even when every value was identical.
 *
 * The query is `enabled: false` when there is nobody to watch, and `data` stays
 * `undefined` while it is disabled — so a newly registered account, which has no
 * neighbours yet, sat in that loop with no exit condition at all.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/render-loop.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const { mergePresenceMap } = await import('../src/features/presence/presenceMerge.ts');
type PresenceMap = Record<string, any>;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The merge must not invent new state ──────────────────────────────────
{
  const empty: PresenceMap = {};

  check(
    'an empty feed returns the SAME object',
    mergePresenceMap(empty, {}) === empty,
    'a new object here is what closed the loop into a hang',
  );

  const one = mergePresenceMap(empty, { u1: true });
  check('a real change produces an update', one !== empty && one.u1.online === true);

  check(
    're-applying the same feed returns the SAME object',
    mergePresenceMap(one, { u1: true }) === one,
    'the effect would re-run, write state, re-render, and never stop',
  );

  const two = mergePresenceMap(one, { u1: true, u2: false });
  check('a second user is added', two !== one && two.u2.status === 'offline');

  check(
    'a status flip IS an update',
    mergePresenceMap(two, { u1: true, u2: true }) !== two,
  );

  check(
    'a repeat of a mixed feed returns the SAME object',
    mergePresenceMap(two, { u1: true, u2: false }) === two,
  );
}

// ── 2. It does not wipe what other systems wrote ────────────────────────────
//
// The realtime feed only carries online/offline. The chat and call systems write
// richer entries into the same map. Replacing an entry wholesale would silently
// erase a live "typing…" indicator.
{
  const withTyping = mergePresenceMap({}, {
    u1: true,
  }) as PresenceMap;
  withTyping.u1.typing = 'hello there';
  withTyping.u1.lastSeen = '2 min ago';
  withTyping.u1.currentConversation = 'conv-9';

  // Same online state: untouched.
  check('an unchanged entry is left alone', mergePresenceMap(withTyping, { u1: true }) === withTyping);

  // Now the user goes offline — the entry updates, but the richer fields survive.
  const offline = mergePresenceMap(withTyping, { u1: false });
  check('presence updates when it really changes', offline !== withTyping && offline.u1.online === false);
  check('the typing indicator is preserved', offline.u1.typing === 'hello there');
  check('last-seen is preserved', offline.u1.lastSeen === '2 min ago');
  check('the active conversation is preserved', offline.u1.currentConversation === 'conv-9');
}

// ── 3. The loop terminates, simulated ───────────────────────────────────────
//
// Replays the exact cycle that was hanging: read the hook's value, run the
// effect, write state, render again. With the fix, state stops changing.
{
  // Stands in for `statusQuery.data ?? FALLBACK` while the query is disabled.
  const disabledQueryData = undefined;
  const EMPTY_STATUS = Object.freeze({}) as Record<string, boolean>;

  let state: PresenceMap = {};
  let renders = 0;
  let stateWrites = 0;
  let lastValue: unknown = null;

  for (let i = 0; i < 50; i++) {
    const onlineStatusByUserId = disabledQueryData ?? EMPTY_STATUS;

    // A re-render only happens if the effect's dependency changed identity. This
    // is the check that used to never fire, because `?? {}` produced a new object
    // every single time.
    if (onlineStatusByUserId === lastValue) break;
    lastValue = onlineStatusByUserId;

    renders++;
    const next = mergePresenceMap(state, onlineStatusByUserId);
    if (next !== state) {
      state = next;
      stateWrites++;
    }
  }

  check(
    'a disabled presence query settles immediately instead of looping',
    renders === 1,
    `${renders} renders — before the fix this ran to the 50-iteration cap`,
  );
  check('and writes no state at all', stateWrites === 0, `${stateWrites} writes`);
}

// ── 4. Nothing anywhere else hands back a fresh object as a hook result ─────
{
  const sync = read('src/features/presence/hooks/usePresenceSync.ts');

  check(
    'the presence hook uses a stable empty object',
    /statusQuery\.data \?\? EMPTY_STATUS/.test(sync),
    'this was the exact line that started the loop',
  );
  check(
    'it is a module-level frozen constant',
    /const EMPTY_STATUS[^=]*=\s*Object\.freeze\(\{\}\)/.test(sync),
    'a constant inside the hook body would still be rebuilt every render',
  );
  // Strip comments first. The fix's own explanatory comment quotes `?? {}` to say
  // why it must not be used — matching that is a false positive, and this exact
  // trap has caught this suite before.
  const syncCode = sync.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check(
    'no inline `?? {}` remains in that hook\'s code',
    !/\?\?\s*\{\}/.test(syncCode),
  );

  // The general shape: `?? {}` or `|| []` on a hook's return line.
  const risky: string[] = [];
  for (const file of [
    'src/features/presence/hooks/usePresenceSync.ts',
    'src/features/presence/hooks/usePresenceMapSync.ts',
    'src/features/presence/hooks/usePresenceHeartbeat.ts',
    'src/features/maps/hooks/useNearbyUsersQuery.ts',
  ]) {
    const src = read(file);
    for (const line of src.split('\n')) {
      if (/^\s*return\b/.test(line) && /(\?\?|\|\|)\s*(\{\}|\[\])/.test(line)) {
        risky.push(`${file}: ${line.trim()}`);
      }
    }
  }
  check(
    'no hook returns a freshly-created empty object or array',
    risky.length === 0,
    risky.join(' | '),
  );

  const mapSync = read('src/features/presence/hooks/usePresenceMapSync.ts');
  check(
    'the merge hook delegates to the tested pure function',
    /mergePresenceMap\(prev, onlineStatusByUserId\)/.test(mapSync),
    'un-testable inline logic is how this bug survived',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  if (r.pass) console.log(`  \x1b[32m✓\x1b[0m ${r.name}`);
  else console.log(`  \x1b[31m✗\x1b[0m ${r.name}${r.detail ? `\n      ${r.detail}` : ''}`);
}
const passed = results.length - failed.length;
console.log(`\nRESULT: ${passed} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);

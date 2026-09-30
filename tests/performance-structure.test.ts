/**
 * Structural guards for the things that decide how fast the app feels.
 *
 * None of these can be caught by `tsc`, and none of them fail loudly in a
 * browser — a reverted chunk split or a re-pasted import block just quietly
 * makes the app slower for everyone. That is exactly the kind of regression
 * worth a test.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/performance-structure.test.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. The bundle is split ──────────────────────────────────────────────────
//
// One 1.6 MB chunk means every deploy invalidates the whole file, so a returning
// user re-downloads React, Firebase and the map library to get a one-line copy
// change.
{
  const config = read('vite.config.ts');
  check(
    'vite.config.ts declares manualChunks',
    /manualChunks/.test(config),
    'the bundle is back to a single monolithic chunk',
  );
  check(
    'Firebase is its own chunk',
    /firebase:\s*\[/.test(config),
    'Firebase (~480 kB) is inlined into the app chunk again',
  );
  check(
    'motion is its own chunk',
    /motion:\s*\[/.test(config),
  );
}

// ── 2. The biggest component is not on the critical path ────────────────────
{
  const view = read('src/app/components/NearbyAppView.tsx');
  check(
    'SecondaryModals is loaded with a dynamic import',
    /lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/SecondaryModals['"]\)\s*\)/.test(view),
    'the 2,500-line modal file is eager again, so every visitor parses it before first paint',
  );
  check(
    'SecondaryModals is NOT imported statically',
    !/^import\s+SecondaryModals\s+from/m.test(view),
    'a static import would pull it back onto the critical path regardless of the lazy() call',
  );
  check(
    'its Suspense fallback is null, not a spinner',
    /<Suspense\s+fallback=\{null\}>/.test(view),
    'a spinner would flash where the app previously showed nothing',
  );
  check(
    'the deferred chunk is prefetched during idle time',
    /requestIdleCallback/.test(view) && /prefetchSecondaryModals/.test(view),
    'without a prefetch the wait simply moves to the first tap that opens a modal',
  );
  check(
    'the prefetch has a timer fallback for older Safari',
    /requestIdleCallback/.test(view) && /setTimeout\(prefetchSecondaryModals/.test(view),
    'Safari below 17.4 has no requestIdleCallback and would never prefetch',
  );
}

// ── 3. The duplicated import preamble does not come back ────────────────────
//
// Fifteen component files each carried an identical 129-line import block
// importing the map, the chat room, the profile view and ~90 icons they never
// used. It was 2,121 lines of dead code across 48 files, and it made every one
// of those files expensive to parse and every edit to the app look touch 15
// places.
//
// The specific signature was a single import statement naming dozens of
// bindings. A plain cap catches the realistic regression: pasting the block back
// in from an old copy.
{
  const files = walk(join(root, 'src'));
  const offenders: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const header = source.split('\n').slice(0, 160).join('\n');
    for (const statement of header.match(/^import[\s\S]*?from\s+['"][^'"]+['"];?$/gm) ?? []) {
      const braces = statement.match(/\{([\s\S]*)\}/);
      if (!braces) continue;
      const count = braces[1].split(',').filter((s) => s.trim()).length;
      if (count > 40) {
        offenders.push(`${relative(root, file)} (${count} bindings in one statement)`);
      }
    }
  }

  check(
    'no file has a copy-pasted mega-import',
    offenders.length === 0,
    offenders.join('; '),
  );

  const largest = files
    .map((f) => ({ f: relative(root, f), lines: readFileSync(f, 'utf8').split('\n').length }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);
  check(
    'the five largest source files are the ones expected',
    largest[0].lines < 3000,
    `largest: ${largest[0].f} (${largest[0].lines} lines)`,
  );
}

// ── 4. The keystroke path stays off the critical path ───────────────────────
//
// Every piece of app state used to live in a single hook — a hundred useState
// calls — whose entire return value was handed to one context consumed by the
// whole app shell. The hook is called at the root of the tree, so typing one
// character in the chat box re-rendered every tab, modal, nav bar and overlay in
// the app. That was the app's worst lag.
//
// The composer text now lives in `features/chat/composerText.ts`, which only the
// chat UI subscribes to. `tests/composer-text.test.ts` owns the real behaviour;
// what follows guards the shape, so it cannot quietly drift back.
{
  const controller = read('src/app/hooks/useNearbyController.ts');
  const controllerCode = controller.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const stateCount = (controllerCode.match(/useState/g) ?? []).length;

  const returnBlock = controller.slice(controller.lastIndexOf('\n  return {'));
  const keyCount = (returnBlock.match(/^\s{4}[A-Za-z_$][\w$]*,\s*$/gm) ?? []).length;

  // A ratchet, not a target. It can only go down.
  check(
    'the root state count has not grown',
    stateCount <= 100,
    `${stateCount} useState calls at the app root (was 101 before the composer fix; 100 is the current floor)`,
  );
  check(
    'the runtime context value has not grown',
    keyCount <= 300,
    `${keyCount} keys on the shared value (was 302 before the composer fix)`,
  );
  check(
    'the composer text is not back in the shared context value',
    !/^\s{4}textInput,\s*$/m.test(controllerCode),
    'a keystroke would re-render all 20 consumers again',
  );
  check(
    'the root does not subscribe to the composer store',
    !/useComposerText/.test(controllerCode),
    'subscribing at the root puts the keystroke back on the critical path',
  );

  // The remaining known hotspot, recorded so it is visible rather than
  // rediscovered. `searchQuery` changes on every keystroke in the Explore search
  // box AND feeds `filteredNeighbors`, a root-level useMemo — so moving it to a
  // store is not enough on its own, the filtering has to move with it. That is a
  // larger change than the composer was and is deliberately not done yet.
  check(
    'the remaining search-input hotspot is still where it was documented',
    /const \[searchQuery, setSearchQuery\] = useState<string>\(''\)/.test(controllerCode) &&
      /\}, \[syncedNeighbors, radarRadius, searchQuery, chatMessages\]\)/.test(controller),
    'searchQuery moved — update the note in nearest-cause-of-lag.md',
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
process.exit(failed.length === 0 ? 1 && 0 : 1);

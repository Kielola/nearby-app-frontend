/**
 * Tests for the chat composer's text store.
 *
 * This store exists to fix the app's worst lag: the text in the message box used
 * to be state at the root of the tree, so every keystroke re-rendered every tab,
 * modal, nav bar and overlay in the app.
 *
 * The store's setter is deliberately a drop-in replacement for React's `useState`
 * setter, because twenty existing call sites were written against `useState` and
 * a refactor that changes their behaviour is a refactor that breaks one of them.
 * The first block below is the proof that it really is a drop-in.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/composer-text.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const {
  getComposerText,
  setComposerText,
  clearComposerText,
  subscribeToComposerText,
} = await import('../src/features/chat/composerText.ts');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. It behaves exactly like useState ─────────────────────────────────────
{
  clearComposerText();

  setComposerText('hello');
  check('a plain value sets the text', getComposerText() === 'hello', `got ${JSON.stringify(getComposerText())}`);

  setComposerText((prev: string) => prev + ' world');
  check(
    'an updater function receives the previous value',
    getComposerText() === 'hello world',
    `got ${JSON.stringify(getComposerText())}`,
  );

  // The exact call at ChatRoomOverlay.tsx:978 — the emoji picker.
  setComposerText((prev: string) => prev + '🎉');
  check(
    'the emoji-picker call site works unchanged',
    getComposerText() === 'hello world🎉',
    `got ${JSON.stringify(getComposerText())}`,
  );

  // The exact call at useChatActions.ts:240 — clearing after a send.
  setComposerText('');
  check('clearing works', getComposerText() === '', `got ${JSON.stringify(getComposerText())}`);

  clearComposerText();
  check('clearComposerText works', getComposerText() === '');

  // Backspace to empty, then a fresh character: the classic stale-updater bug.
  setComposerText('a');
  setComposerText((prev: string) => prev.slice(0, -1));
  setComposerText((prev: string) => prev + 'b');
  check(
    'an updater after an update sees the latest value, not a stale one',
    getComposerText() === 'b',
    `got ${JSON.stringify(getComposerText())}`,
  );
}

// ── 2. Subscribers ──────────────────────────────────────────────────────────
{
  clearComposerText();
  const seen: string[] = [];
  const unsubscribe = subscribeToComposerText(() => seen.push(getComposerText()));

  setComposerText('a');
  setComposerText('ab');
  setComposerText('abc');
  check('every change notifies, in order', seen.join('|') === 'a|ab|abc', seen.join('|'));

  // This is not cosmetic. React re-renders and re-runs effects constantly, and a
  // subscriber notified on a no-op write would loop.
  const before = seen.length;
  setComposerText('abc');
  check('writing the same value notifies nobody', seen.length === before, `${seen.length - before} spurious notifications`);

  unsubscribe();
  setComposerText('xyz');
  check('an unsubscribed listener stops hearing changes', seen.length === before);

  const two: string[] = [];
  const a = subscribeToComposerText(() => two.push('a'));
  const b = subscribeToComposerText(() => two.push('b'));
  setComposerText('q');
  check('all subscribers are notified', two.length === 2, two.join(','));
  a();
  b();
}

// ── 3. The send path reads the live value ───────────────────────────────────
{
  clearComposerText();
  setComposerText('typed but not rendered yet');

  check(
    'getComposerText returns what is in the box right now',
    getComposerText() === 'typed but not rendered yet',
    'sendMessage would otherwise use a stale render-time value',
  );

  // A subscriber added later must see the current value immediately.
  let sawOnSubscribe = '';
  const unsub = subscribeToComposerText(() => {
    sawOnSubscribe = getComposerText();
  });
  setComposerText('next');
  check('a late subscriber sees the current value on the next change', sawOnSubscribe === 'next');
  unsub();
  clearComposerText();
}

// ── 4. It is genuinely out of the root ──────────────────────────────────────
//
// The lag is only fixed if the state is GONE from the root. Leaving a duplicate
// copy in the controller would look harmless and restore the original problem,
// because writing to it would still re-render the whole app.
{
  const controller = read('src/app/hooks/useNearbyController.ts');
  const controllerCode = controller.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  check(
    'the root controller no longer owns the composer text',
    !/useState[^\n]*\btextInput\b/.test(controllerCode),
    'the state is back at the root, so every keystroke re-renders the whole app again',
  );
  check(
    'the root controller no longer returns it in the shared context value',
    !/^\s{4}textInput,\s*$/m.test(controllerCode),
    'consumers would read a value that never updates',
  );
  check(
    'the root controller does not subscribe to the store',
    !/useComposerText/.test(controllerCode),
    'subscribing at the root puts the keystroke back on the critical path',
  );
  check(
    'the root passes the store setter to the send path',
    /setTextInput: setComposerText/.test(controllerCode),
    'clearing after a send would do nothing',
  );
}

// ── 5. The chat overlay is where it is consumed ─────────────────────────────
{
  const overlay = read('src/app/components/ChatRoomOverlay.tsx');

  check(
    'the chat overlay subscribes to the store',
    /const \[textInput, setTextInput\] = useComposerText\(\)/.test(overlay),
    'nothing would read the typed text',
  );
  // Scope this to the runtime destructuring block specifically. Checking the
  // whole file for `textInput,` is wrong — the typing publisher is *supposed* to
  // pass the value along, and an over-broad pattern fails on correct code.
  const runtimeDestructuring = overlay.slice(
    overlay.indexOf('useNearbyRuntime()') === -1 ? 0 : overlay.lastIndexOf('const {', overlay.indexOf('} = useNearbyRuntime();')),
    overlay.indexOf('} = useNearbyRuntime();'),
  );
  check(
    'the chat overlay no longer takes it from the app-wide context',
    runtimeDestructuring.length > 0 && !/\btextInput\b/.test(runtimeDestructuring),
    'the overlay would still be reading a context value that no longer exists',
  );
  check(
    'the chat overlay still passes it down to the chat room',
    /textInput=\{textInput\}/.test(overlay) && /setTextInput=\{setTextInput\}/.test(overlay),
    'PremiumChatRoom would receive undefined',
  );
  check(
    'the typing indicator publishes from the overlay',
    /useTypingIndicatorPublisher\(\{/.test(overlay),
    'the other side would never see "typing…"',
  );
}

// ── 6. The send path ────────────────────────────────────────────────────────
{
  const actions = read('src/features/chat/hooks/useChatActions.ts');
  const code = actions.replace(/\/\/[^\n]*/g, '');

  check(
    'sending reads the live composer text',
    /customText !== undefined \? customText : getComposerText\(\)/.test(code),
    'a send would use a stale value',
  );
  check(
    'sending still clears the box only when it came from the composer',
    /if \(customText === undefined\) \{\s*setTextInput\(''\)/.test(code),
    'sending a photo with a caption would wipe text the user was still typing',
  );
  check(
    'the composer text is no longer a parameter of the send hook',
    !/^\s{2}textInput: any;\s*$/m.test(code),
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

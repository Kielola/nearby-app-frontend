/**
 * Tests for the referral-code input path.
 *
 * This covers the wiring that lets a user arrive on an invite link — `/join/CODE`
 * or the older `?ref=CODE` — be taken straight to the sign-up form, see the code
 * pre-filled, edit or clear it, and have the exact string they left in the box be
 * the one that gets attributed.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/referral-code-input.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Read a source file relative to the frontend root. */
function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── A minimal DOM, installed before the module under test is imported ───────
//
// The module reads `window.localStorage` and dispatches a window event, so it
// needs a window. A fake here is better than a real one: it lets us simulate
// private-mode storage throwing, which is the case that actually breaks
// attribution and which a real jsdom localStorage will never produce.

type Listener = (event: any) => void;

function makeFakeWindow(opts: { throwOnStorage?: boolean } = {}) {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<Listener>>();

  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.throwOnStorage) throw new Error('QuotaExceededError (private mode)');
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      if (opts.throwOnStorage) throw new Error('SecurityError (private mode)');
      store.delete(k);
    },
    clear: () => store.clear(),
  };

  const win: any = {
    localStorage,
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: any) => {
      listeners.get(event?.type)?.forEach((fn) => fn(event));
      return true;
    },
    location: { href: 'https://nearby.fashfos.com/' },
    history: { replaceState: () => undefined },
  };

  return { win, store, fire: (type: string, event: any = { type }) => win.dispatchEvent(event) };
}

class FakeCustomEvent {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

(globalThis as any).CustomEvent = FakeCustomEvent;

// ── Import the module with a window already in place ────────────────────────

async function loadModule(win: any) {
  (globalThis as any).window = win;
  // Cache-bust so each case gets a fresh module instance and module-level state
  // from a previous case cannot leak in.
  const mod = await import('../src/features/referrals/pendingCode.ts?t=' + Math.random());
  return mod as typeof import('../src/features/referrals/pendingCode');
}

// ── 1. Normalisation ────────────────────────────────────────────────────────

{
  const { win } = makeFakeWindow();
  const { normaliseReferralCode } = await loadModule(win);

  const cases: [string, string, string][] = [
    ['lowercase is uppercased', 'abcd1234', 'ABCD1234'],
    ['surrounding whitespace is trimmed', '   ABCD1234   ', 'ABCD1234'],
    ['inner spaces from a paste are dropped', 'ABCD 1234', 'ABCD1234'],
    ['newlines from a copied email are dropped', 'ABCD1234\n', 'ABCD1234'],
    ['a "REF-" style prefix keeps its dash', 'ref-ab12', 'REF-AB12'],
    ['smart quotes are stripped', '\u2018ABCD\u2019', 'ABCD'],
    ['a full URL paste yields only the code fragment', 'NEARBY10', 'NEARBY10'],
    ['an emoji paste cannot smuggle characters through', 'AB\u{1F600}CD', 'ABCD'],
    ['empty stays empty', '', ''],
    ['whitespace only collapses to empty', '    ', ''],
  ];

  for (const [name, input, expected] of cases) {
    const got = normaliseReferralCode(input);
    check(name, got === expected, `got "${got}", expected "${expected}"`);
  }

  // A pasted paragraph must not become a 5000-character code.
  const huge = normaliseReferralCode('A'.repeat(5000));
  check('an over-long paste is capped at 32 chars', huge.length === 32, `got ${huge.length}`);
}

// ── 2. Round trip ───────────────────────────────────────────────────────────

{
  const { win, store } = makeFakeWindow();
  const mod = await loadModule(win);

  check('a fresh visitor has no pending code', mod.readPendingReferralCode() === null);

  mod.writePendingReferralCode('nearby10');
  check(
    'writing stores the normalised code',
    store.get(mod.REFERRAL_STORAGE_KEY) === 'NEARBY10',
    `stored ${store.get(mod.REFERRAL_STORAGE_KEY)}`,
  );
  check('reading returns the normalised code', mod.readPendingReferralCode() === 'NEARBY10');

  mod.writePendingReferralCode(null);
  check('writing null clears it', mod.readPendingReferralCode() === null);
  check('clearing removes the key entirely', !store.has(mod.REFERRAL_STORAGE_KEY));

  mod.writePendingReferralCode('ABCD1234');
  mod.writePendingReferralCode('');
  check('writing an empty string also clears', mod.readPendingReferralCode() === null);
}

// ── 3. The last writer wins ─────────────────────────────────────────────────

{
  const { win } = makeFakeWindow();
  const mod = await loadModule(win);

  // The scenario this exists for: someone clicks an invite link (?ref=ADA),
  // then decides to type a different code a friend told them.
  mod.writePendingReferralCode('ADA');
  mod.writePendingReferralCode('CHIDI');
  check(
    'a typed code overrides the one from the invite link',
    mod.readPendingReferralCode() === 'CHIDI',
  );

  // And the reverse — a link clicked in a later tab wins over an old typed code.
  mod.writePendingReferralCode('CHIDI');
  mod.writePendingReferralCode('LAGOS7');
  check('a later code always wins', mod.readPendingReferralCode() === 'LAGOS7');
}

// ── 4. Subscribers ──────────────────────────────────────────────────────────

{
  const { win } = makeFakeWindow();
  const mod = await loadModule(win);

  const seen: (string | null)[] = [];
  const unsubscribe = mod.subscribeToPendingReferralCode((c) => seen.push(c));

  mod.writePendingReferralCode('FIRST');
  mod.writePendingReferralCode('SECOND');
  mod.writePendingReferralCode(null);

  check(
    'a subscriber is notified on every change, in order',
    JSON.stringify(seen) === JSON.stringify(['FIRST', 'SECOND', null]),
    JSON.stringify(seen),
  );

  unsubscribe();
  mod.writePendingReferralCode('AFTER');
  check(
    'an unsubscribed listener stops hearing changes',
    seen.length === 3,
    `saw ${seen.length} events`,
  );
}

// ── 5. Private mode must degrade, not crash ─────────────────────────────────

{
  const { win } = makeFakeWindow({ throwOnStorage: true });
  const mod = await loadModule(win);

  let threw = false;
  try {
    mod.writePendingReferralCode('BLOCKED1');
    mod.readPendingReferralCode();
    mod.writePendingReferralCode(null);
  } catch {
    threw = true;
  }

  check(
    'blocked storage never throws into the caller',
    !threw,
    'a Safari private-mode visitor would see an unhandled error',
  );
  // Reading must not resurrect anything either.
  check('blocked storage reads as null rather than undefined', mod.readPendingReferralCode() === null);
}

// ── 6. No window at all (SSR / prerender) ───────────────────────────────────

{
  delete (globalThis as any).window;
  const mod = await loadModule(undefined);
  delete (globalThis as any).window;

  let threw = false;
  try {
    check('reading without a window returns null', mod.readPendingReferralCode() === null);
    mod.writePendingReferralCode('X');
    const un = mod.subscribeToPendingReferralCode(() => undefined);
    un();
  } catch {
    threw = true;
  }
  check('the module is safe to import without a window', !threw);
}

// ── 7. Invite-link URL shapes ───────────────────────────────────────────────
//
// The app now shares `/join/CODE`, but links built the old way (`?ref=CODE`) are
// already sitting in WhatsApp groups and cannot be recalled. Both must resolve.

{
  const { win } = makeFakeWindow();
  const { referralCodeFromUrl, normaliseReferralCode } = await loadModule(win);

  const cases: [string, string, string | null][] = [
    ['the new /join/ path', 'https://nearby.fashfos.com/join/ABCD1234', 'ABCD1234'],
    ['/join/ with a trailing slash', 'https://nearby.fashfos.com/join/ABCD1234/', 'ABCD1234'],
    ['/join/ with arbitrary casing', 'https://nearby.fashfos.com/JOIN/abcd1234', 'ABCD1234'],
    ['the original ?ref= parameter', 'https://nearby.fashfos.com/?ref=ABCD1234', 'ABCD1234'],
    ['the older ?referral= spelling', 'https://nearby.fashfos.com/?referral=ABCD1234', 'ABCD1234'],
    ['a bare path with no origin', '/join/ABCD1234', 'ABCD1234'],
    ['?ref= alongside other parameters', 'https://nearby.fashfos.com/?utm=x&ref=ABCD1234&a=b', 'ABCD1234'],
    ['a code with a dash', 'https://nearby.fashfos.com/join/REF-AB12', 'REF-AB12'],
    ['lowercase query value is uppercased', 'https://nearby.fashfos.com/?ref=abcd1234', 'ABCD1234'],
    ['no code at all', 'https://nearby.fashfos.com/', null],
    ['an unrelated path', 'https://nearby.fashfos.com/about', null],
    ['/join/ with nothing after it', 'https://nearby.fashfos.com/join/', null],
    ['an empty string', '', null],
  ];

  for (const [name, url, expected] of cases) {
    const got = referralCodeFromUrl(url);
    check(
      `invite URL: ${name}`,
      got === expected,
      `got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }

  // A code must never leak a path traversal or query fragment into storage.
  const nasty = referralCodeFromUrl('https://x.com/join/AB%2F..%2FCD?ref=ZZZ');
  check(
    'a percent-encoded path cannot inject separators',
    nasty === null || !nasty.includes('/'),
    `got ${JSON.stringify(nasty)}`,
  );
  check('normalisation is idempotent', normaliseReferralCode(normaliseReferralCode('ab-12')) === 'AB-12');
}

// ── 8. Following an invite must actually land on the sign-up form ───────────
//
// This was broken TWICE, in two different ways, and the second fix is the one
// that mattered.
//
//   Attempt 1: the auth screen was hard-coded to 'login'. Fixed by seeding it from
//   the referral store.
//
//   Attempt 2 (still broken): that seed read localStorage, but the code is written
//   to localStorage by an EFFECT, and effects run after the render that mounts
//   them. So during the initialiser — the one render where the answer matters —
//   storage was always empty. The app opened on log-in and the code appeared in the
//   field a moment later, which made the feature look like it was working.
//
// The screen is now decided from the URL, which is present on the first render.
// See tests/auth-entry.test.ts for the behaviour itself.
{
  const controller = read('src/app/hooks/useNearbyController.ts');
  const flags = read('src/features/settings/hooks/useUiFlags.ts');

  // Strip comments before asserting. Checking raw source produced a FALSE PASS
  // here: the controller's own note explains that it "used to read storage:
  // `readPendingReferralCode() ? 'signup' : 'login'`", and the old assertion
  // matched that sentence while the code had already changed.
  const controllerCode = controller.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const flagsCode = flags.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  check(
    'the auth screen is decided from the URL, not from storage',
    /useState<AuthScreen>\(\(\) => authEntryScreen\(\)\)/.test(controllerCode),
    "storage is empty during the initialiser, so an invited visitor was shown a log-in form",
  );
  check(
    'it no longer decides from storage',
    !/readPendingReferralCode/.test(controllerCode),
    'reading storage here is the bug that survived the first fix',
  );
  check(
    'an invited visitor skips the landing screen',
    /arrivedViaInvite\(\)/.test(flagsCode) && /!arrivedViaInviteNow/.test(flagsCode),
    'the landing screen gates whether auth screens render at all, so the sign-up form would stay hidden',
  );
  check(
    'the sign-up field is still seeded when the form renders',
    /readPendingReferralCode/.test(read('src/app/components/AuthGate.tsx')),
    'the field would render empty even with a valid code',
  );
}

// ── 9. The shared link shape ────────────────────────────────────────────────
{
  const backend = readFileSync(join(root, '..', 'nearby-backend', 'src/referrals/referrals.service.ts'), 'utf8');
  check(
    'the backend shares /join/ links',
    /\/join\/\$\{code\}/.test(backend),
    'the link users share does not use the /join/ form',
  );
  check(
    'no ?ref= link is still generated',
    !/\/\?ref=\$\{code\}/.test(backend),
    'the backend still hands out the old link shape',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  if (r.pass) {
    console.log(`  \x1b[32m✓\x1b[0m ${r.name}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
    if (r.detail) console.log(`      → ${r.detail}`);
  }
}

const passed = results.length - failed.length;
console.log(`\nRESULT: ${passed} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);

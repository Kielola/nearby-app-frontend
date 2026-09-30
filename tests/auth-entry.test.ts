/**
 * Tests for how the app decides which auth screen to open on.
 *
 * Two defects are covered here, and they compounded.
 *
 * 1. The share message contained the link TWICE — once inside the sentence and
 *    again on its own line — because the link was passed both inside `text` and as
 *    the separate `url` field, and most share targets append one to the other.
 *
 * 2. An invite link pre-filled the referral code but still opened the LOG-IN
 *    screen. The screen was chosen during the first render by reading
 *    localStorage; the code is written to localStorage by an effect, which runs
 *    after that render. So storage was always empty at the moment of the decision.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/auth-entry.test.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

/** A window with storage, a URL and a working replaceState. */
function fakeWindow(href: string, stored?: Record<string, string>) {
  const data = new Map(Object.entries(stored ?? {}));
  const parsed = new URL(href);
  const win: any = {
    // `pathname` and `search` are provided because a real Location has them. An
    // earlier version of this fake omitted them, which silently made every path
    // lookup fail and produced six false failures that looked like code bugs.
    location: { href, pathname: parsed.pathname, search: parsed.search },
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
    history: {
      replaceState: (_a: unknown, _b: unknown, next: string) => {
        win.location.href = next;
      },
    },
  };
  return win;
}

async function withWindow(href: string, stored: Record<string, string> | undefined, fn: () => Promise<void> | void) {
  (globalThis as any).window = fakeWindow(href, stored);
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  await fn();
}

const { authEntryScreen, arrivedViaInvite, syncAuthRoute } = await import('../src/features/authentication/authEntry.ts');
const { currentReferralCode } = await import('../src/features/referrals/pendingCode.ts');

// ── 1. The invite is seen even when storage is empty ────────────────────────
//
// This is the exact condition of the bug: the user has just arrived from the link,
// so the URL carries the code and NOTHING has been written to storage yet.
{
  await withWindow('https://nearby.fashfos.com/join/AYOF3118', undefined, () => {
    check(
      'an invite in the URL is found with empty storage',
      currentReferralCode() === 'AYOF3118',
      `got ${JSON.stringify(currentReferralCode())} — this returning null was the whole bug`,
    );
    check('and it is recognised as an invite', arrivedViaInvite() === true);
    check(
      'so the app opens on sign-up',
      authEntryScreen() === 'signup',
      "invited users were shown a log-in form for an account they did not have",
    );
  });

  await withWindow('https://nearby.fashfos.com/?ref=AYOF3118', undefined, () => {
    check('the older ?ref= link also opens sign-up', authEntryScreen() === 'signup');
  });

  await withWindow('https://nearby.fashfos.com/?referral=AYOF3118', undefined, () => {
    check('and ?referral= too', authEntryScreen() === 'signup');
  });

  // A code captured on an earlier visit and then refreshed away must survive.
  await withWindow('https://nearby.fashfos.com/', { nearby_referral_code: 'STORED99' }, () => {
    check('a previously captured code still counts', authEntryScreen() === 'signup');
  });
}

// ── 2. The explicit paths ───────────────────────────────────────────────────
{
  const cases: [string, string, string][] = [
    ['/signup', 'signup', 'the explicit sign-up path'],
    ['/signup/', 'signup', 'a trailing slash'],
    ['/SignUp', 'signup', 'unusual casing'],
    ['/login', 'login', 'the explicit log-in path'],
    ['/login/', 'login', 'a trailing slash'],
    ['/', 'login', 'the bare root with no invite'],
    ['/about', 'login', 'an unrelated path'],
  ];

  for (const [path, expected, label] of cases) {
    await withWindow(`https://nearby.fashfos.com${path}`, undefined, () => {
      check(`${label} -> ${expected}`, authEntryScreen() === expected, `got ${authEntryScreen()}`);
    });
  }

  // Explicit wins over the invite: someone following a friend's link who already
  // has an account should not be pushed into registering again. Their code is
  // still pre-filled, so the referral attributes either way.
  await withWindow('https://nearby.fashfos.com/login?ref=AYOF3118', undefined, () => {
    check('an explicit /login beats the invite', authEntryScreen() === 'login');
    check('but the invite is still captured', currentReferralCode() === 'AYOF3118');
  });
  await withWindow('https://nearby.fashfos.com/signup?ref=AYOF3118', undefined, () => {
    check('an explicit /signup agrees with the invite', authEntryScreen() === 'signup');
  });
}

// ── 3. The address bar follows the screen ───────────────────────────────────
{
  await withWindow('https://nearby.fashfos.com/', undefined, () => {
    syncAuthRoute('signup');
    check(
      'switching to sign-up writes /signup',
      (globalThis as any).window.location.href === 'https://nearby.fashfos.com/signup',
      (globalThis as any).window.location.href,
    );

    syncAuthRoute('login');
    check(
      'switching back writes /login',
      (globalThis as any).window.location.href === 'https://nearby.fashfos.com/login',
      (globalThis as any).window.location.href,
    );
  });

  await withWindow('https://nearby.fashfos.com/login', undefined, () => {
    syncAuthRoute('forgot');
    check(
      'a password-reset step does not get its own URL',
      (globalThis as any).window.location.href === 'https://nearby.fashfos.com/login',
      'linking to a reset form would be a phishing-looking URL',
    );
    syncAuthRoute('verification');
    check('nor does the verification wall', (globalThis as any).window.location.href === 'https://nearby.fashfos.com/login');
  });

  await withWindow('https://nearby.fashfos.com/join/AYOF3118?utm=x', undefined, () => {
    syncAuthRoute('login');
    const href = (globalThis as any).window.location.href;
    check('an invite path is replaced, not stacked', href === 'https://nearby.fashfos.com/login', href);
  });
}

// ── 4. A refresh of /signup stays on /signup ────────────────────────────────
{
  await withWindow('https://nearby.fashfos.com/signup', undefined, () => {
    syncAuthRoute('signup');
    check(
      're-writing the same path changes nothing',
      (globalThis as any).window.location.href === 'https://nearby.fashfos.com/signup',
    );
    check('and the entry screen still reads sign-up', authEntryScreen() === 'signup');
  });
}

// ── 5. The wiring ───────────────────────────────────────────────────────────
{
  const controller = read('src/app/hooks/useNearbyController.ts');
  const flags = read('src/features/settings/hooks/useUiFlags.ts');
  const panel = read('src/features/referrals/components/ReferralOverviewPanel.tsx');

  check(
    'the controller decides the screen from the URL',
    /useState<AuthScreen>\(\(\) => authEntryScreen\(\)\)/.test(controller),
    'reading storage instead is the original bug — storage is empty at that moment',
  );
  check(
    'the controller no longer reads storage for that decision',
    !/useState[^\n]*readPendingReferralCode/.test(controller),
  );
  check(
    'screen changes update the URL',
    /syncAuthRoute\(next\)/.test(controller),
    '/signup and /login would not survive a refresh',
  );
  check(
    'the landing screen also reads the invite from the URL',
    /arrivedViaInvite\(\)/.test(flags),
    'an invitee would still get the marketing screen on a device that remembers an account',
  );

  check(
    'the share message passes the link once',
    /navigator\.share\(\{ title: 'Join Nearby', text \}\)/.test(panel),
    'passing url as well duplicated the link in WhatsApp',
  );
  check(
    'it does not pass the link as a separate url field',
    !/navigator\.share\([^)]*\burl\s*:/.test(panel),
  );
  check(
    'the link is still inside the message text',
    /\$\{profile\.referralLink\}/.test(panel),
    'a target that ignores `url` would then send no link at all',
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

/**
 * Tests for the email-verification gate rules.
 *
 * `requiresEmailVerification` is the single most consequential function added
 * here. A false positive locks a real user out of their own account with no way
 * back in; a false negative lets an unverified account through. Everything it
 * decides is covered below.
 *
 * Plain `tsx` script, no framework — same convention as the other tests.
 * Run: npx tsx tests/email-verification.test.ts
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// The pure rules module has no Firebase dependency, so import it directly. The
// rule was deliberately extracted from the SDK-carrying service for exactly this
// reason: the decision that can lock a user out should be testable on its own.
const { requiresEmailVerification: requires } = await import(
  '../src/features/authentication/services/verificationRules.ts'
);

// The service file is still read as text, for the error-handling assertions later.
const source = read('src/features/authentication/services/emailVerification.ts');

// ── 1. Real inboxes must be asked to verify ─────────────────────────────────

const shouldRequire: [string, any][] = [
  ['a normal unverified email', { email: 'chidi@example.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['a Gmail address', { email: 'someone@gmail.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['uppercase email', { email: 'SOMEONE@GMAIL.COM', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['email with surrounding whitespace', { email: '  someone@gmail.com  ', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['a subdomain address', { email: 'a@mail.example.co.uk', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  // An address that merely CONTAINS the synthetic domain must not be mistaken
  // for one — this is the bug the endsWith check exists to prevent.
  ['a real address at a lookalike domain', { email: 'me@notnearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['a real address with nearby.com as a subdomain', { email: 'me@sub.nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
];

for (const [name, user] of shouldRequire) {
  check(`requires verification: ${name}`, requires(user) === true, `got ${requires(user)}`);
}

// ── 2. Must NOT be asked ────────────────────────────────────────────────────

const shouldNotRequire: [string, any][] = [
  ['synthetic phone registration', { email: 'phone_+2348012345678@nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['synthetic phone with no plus', { email: 'phone_08012345678@nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['phone prefix in a different case', { email: 'PHONE_08012345678@nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['any address at the synthetic domain', { email: 'someone@nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['already verified', { email: 'someone@gmail.com', emailVerified: true }],
  ['verified and synthetic', { email: 'phone_0801@nearby.com', emailVerified: true }],
  ['no email at all', { email: undefined, emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['null email', { email: null, emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['empty email', { email: '', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['whitespace-only email', { email: '   ', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['not an address at all', { email: 'not-an-email', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' }],
  ['null user', null],
  ['undefined user', undefined],
];

for (const [name, user] of shouldNotRequire) {
  check(`does NOT require verification: ${name}`, requires(user) === false, `got ${requires(user)}`);
}

// ── 2b. Grandfathering: nobody who already exists gets locked out ───────────
//
// Verification shipped to an app that already had accounts. Every one of those is
// unverified through no fault of its owner, so gating them on launch day would
// lock out people who did nothing wrong and had no way to know. The cutoff fixes
// that, and these assertions are what stop it being "tidied away".

const CUTOFF = '2026-10-01T00:00:00Z';

const grandfathered: [string, any][] = [
  ['a month-old account', { email: 'old@example.com', emailVerified: false, creationTime: '2026-09-01T10:00:00Z' }],
  ['an account made yesterday', { email: 'recent@example.com', emailVerified: false, creationTime: '2026-09-29T22:00:00Z' }],
  ['an account made minutes before the cutoff', { email: 'edge@example.com', emailVerified: false, creationTime: '2026-09-30T23:59:59Z' }],
  ['an account with no creation time recorded', { email: 'unknown@example.com', emailVerified: false, creationTime: undefined }],
  ['an unparseable creation time', { email: 'broken@example.com', emailVerified: false, creationTime: 'not-a-date' }],
];

for (const [name, user] of grandfathered) {
  check(
    `grandfathered (never gated): ${name}`,
    requires(user) === false,
    'an existing user would be locked out on launch day — the exact harm the cutoff prevents',
  );
}

const gated: [string, any][] = [
  ['an account created after the cutoff', { email: 'new@example.com', emailVerified: false, creationTime: '2026-10-01T00:00:01Z' }],
  ['a brand new signup', { email: 'fresh@example.com', emailVerified: false, creationTime: '2026-10-03T09:00:00Z' }],
];

for (const [name, user] of gated) {
  check(
    `gated (must verify): ${name}`,
    requires(user) === true,
    'a new account would skip verification, so the requirement would be decorative',
  );
}

// The failure mode above is permissive AND silent: reading the wrong shape makes
// every account look grandfathered and disables the gate for everyone, without a
// single error anywhere. So the adaptation step is asserted explicitly.
{
  const gate = read('src/features/authentication/services/verificationGate.ts');
  check(
    'the gate reads Firebase\'s nested metadata.creationTime',
    /metadata\?\.creationTime/.test(gate),
    'Firebase nests creationTime under `metadata`; reading it flat yields undefined and silently disables verification for every account',
  );
  check(
    'the app boundary uses the adapting helper, not the raw rule',
    /verificationRequiredFor/.test(read('src/app/App.tsx')),
    'calling the rule with a raw Firebase user reads undefined creationTime and grandfathers everyone',
  );
}

// ── 3. The trap that must never reopen ──────────────────────────────────────
//
// If a phone registration were ever asked to verify, that user is locked out
// permanently: no mail can be delivered to that address, so the gate could never
// be satisfied. This is the highest-severity failure mode in the whole feature.
{
  const phoneUser = { email: 'phone_+2348012345678@nearby.com', emailVerified: false, creationTime: '2026-10-02T09:00:00Z' };
  const locked = requires(phoneUser);
  check(
    'a phone registration can never be trapped behind the gate',
    locked === false,
    'a phone user would be permanently locked out — no mailbox exists to verify',
  );
}

// ── 4. Wiring: the signup path must actually send it ────────────────────────

const authActions = read('src/features/authentication/hooks/useAuthActions.ts');
// Asserted by POSITION, not by proximity in characters. A character window breaks
// the moment someone adds a comment (as happened here), which makes the test
// report a regression that has not occurred — and a test people learn to ignore is
// worse than no test.
{
  const createAt = authActions.indexOf('createUserWithEmailAndPassword(auth, finalEmail, pass)');
  const sendAt = authActions.indexOf('sendVerificationEmail(');
  check(
    'signup sends a verification email',
    createAt !== -1 && sendAt !== -1 && sendAt > createAt,
    createAt === -1
      ? 'the email/password signup call moved — this test needs updating'
      : sendAt === -1
        ? 'nothing sends a verification email any more'
        : 'the send happens before the account exists, so it cannot work',
  );
}
check(
  'a failed verification send cannot fail the signup',
  /sendVerificationEmail\([^)]*\)\.catch\(\(\) => undefined\)/.test(authActions),
  'an unhandled rejection here would surface an error to a user who just registered successfully',
);

// ── 5. Wiring: the gate must be unskippable and must precede the app ────────

const app = read('src/app/App.tsx');
check(
  'the app renders behind the verification boundary',
  /<EmailVerificationBoundary>\s*<NearbyAppView \/>\s*<\/EmailVerificationBoundary>/.test(app),
  'NearbyAppView is no longer wrapped, so verification can be skipped',
);
check(
  'the boundary re-evaluates when the signed-in user changes',
  /onAuthStateChanged/.test(app),
  'without this, signing out of a verified account and into an unverified one inherits a stale pass',
);
check(
  'banned takes precedence over verification',
  app.indexOf('isCurrentMeBanned') < app.indexOf('<EmailVerificationBoundary>'),
  'a banned user would be told to verify their email as though that would let them in',
);

// ── 6. The gate screen must offer a way out ─────────────────────────────────

const gate = read('src/features/authentication/components/VerifyEmailGate.tsx');
check(
  'the gate polls so "I clicked the link" works without a manual refresh',
  /setInterval/.test(gate) && /visibilityState/.test(gate),
  'the user would click the link and appear stuck',
);
check(
  'the gate re-checks when the tab regains focus',
  /addEventListener\('focus'/.test(gate),
  'returning from the mail client is the common path and must resolve immediately',
);
check(
  'the gate throttles resends',
  /RESEND_COOLDOWN_SECONDS/.test(gate) && /too-many-requests|throttled/.test(source),
  'unthrottled resends get the sender rate-limited by Firebase',
);
check(
  'the gate always provides a sign-out escape',
  /signOut\(auth\)/.test(gate),
  'a user who mistyped their email would be stuck forever with no way back',
);

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

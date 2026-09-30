/**
 * Tests for the two email-verification defects.
 *
 * 1. "Open my email app" opened a blank COMPOSE window instead of the inbox,
 *    because `mailto:` with no recipient does exactly that.
 *
 * 2. Tapping "continue" on Firebase's action page dropped the user back on the
 *    marketing landing screen instead of the sign-in page — technically correct
 *    (they arrived at the bare root, and the app cannot tell a new visitor from a
 *    returning one) but it looked like the link had failed.
 *
 * Plain `tsx` script, no framework — same convention as the other tests here.
 * Run: npx tsx tests/email-return.test.ts
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
    else out.push(full);
  }
  return out;
}

const { webmailTargetFor } = await import('../src/features/authentication/services/webmail.ts');
const { withVerificationMarker, consumeVerificationReturn, resetVerificationReturnForTests } =
  await import('../src/features/authentication/verificationReturn.ts');

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

// ── 1. No more blank compose windows ────────────────────────────────────────
{
  const offenders: string[] = [];
  for (const file of walk(join(root, 'src'))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    // Strip comments — the fix's own explanation quotes the removed line.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    code.split('\n').forEach((line, i) => {
      if (/mailto:/.test(line)) offenders.push(`${relative(root, file)}:${i + 1}`);
    });
  }
  check(
    'no `mailto:` remains anywhere in the code',
    offenders.length === 0,
    `a bare mailto: opens a blank draft, not the inbox — ${offenders.join(', ')}`,
  );
}

// ── 2. The inbox link ───────────────────────────────────────────────────────
{
  const cases: [string, string | null][] = [
    ['ada@gmail.com', 'https://mail.google.com'],
    ['ADA@GMAIL.COM', 'https://mail.google.com'],
    ['ada@googlemail.com', 'https://mail.google.com'],
    ['ada@yahoo.com', 'https://mail.yahoo.com'],
    ['ada@yahoo.co.uk', 'https://mail.yahoo.com'],
    ['ada@ymail.com', 'https://mail.yahoo.com'],
    ['ada@outlook.com', 'https://outlook.live.com/mail'],
    ['ada@hotmail.com', 'https://outlook.live.com/mail'],
    ['ada@hotmail.co.uk', 'https://outlook.live.com/mail'],
    ['ada@icloud.com', 'https://www.icloud.com/mail'],
    ['ada@proton.me', 'https://mail.proton.me'],
    // Unknown providers must return null so the UI shows guidance instead of a
    // button that cannot work.
    ['ada@fashfos.com', null],
    ['ada@company.co', null],
    ['', null],
    [null, null],
    ['not-an-email', null],
  ];

  for (const [email, expected] of cases) {
    const got = webmailTargetFor(email as any)?.url ?? null;
    check(`inbox link for ${email ?? 'null'}`, got === expected, `got ${got}`);
  }
  check('the label names the provider', webmailTargetFor('a@gmail.com')?.label === 'Open Gmail');
}

// ── 3. The continue URL tells the app where the user came from ──────────────
{
  check(
    'the continue URL is marked',
    withVerificationMarker('https://nearby.fashfos.com') === 'https://nearby.fashfos.com/?verified=1',
    withVerificationMarker('https://nearby.fashfos.com'),
  );
  check(
    'an existing query string survives',
    withVerificationMarker('https://nearby.fashfos.com/?a=b') ===
      'https://nearby.fashfos.com/?a=b&verified=1',
  );
  check('a malformed URL is returned unchanged', withVerificationMarker('nonsense') === 'nonsense');
}

// ── 4. Landing back from verification opens sign-in ─────────────────────────
{
  const makeWindow = (href: string) => {
    const url = new URL(href);
    const win = {
      location: { href: url.toString() },
      history: {
        replaceState: (_a: unknown, _b: unknown, next: string) => {
          win.location.href = next;
        },
      },
    };
    return win;
  };

  (globalThis as any).window = makeWindow('https://nearby.fashfos.com/?verified=1');
  resetVerificationReturnForTests();

  check('the marker is detected', consumeVerificationReturn() === true);
  check(
    'reading it a second time still reports true',
    consumeVerificationReturn() === true,
    'the first read strips the URL, so an uncached second read would say false and the sign-in screen would not show',
  );
  check(
    'the marker is removed from the address bar',
    !(globalThis as any).window.location.href.includes('verified'),
    `a reload would re-trigger the confirmation — href is ${(globalThis as any).window.location.href}`,
  );

  (globalThis as any).window = makeWindow('https://nearby.fashfos.com/');
  resetVerificationReturnForTests();
  check('no marker means a normal visit', consumeVerificationReturn() === false);

  (globalThis as any).window = makeWindow('https://nearby.fashfos.com/?verified=0');
  resetVerificationReturnForTests();
  check('verified=0 is not treated as verified', consumeVerificationReturn() === false);

  delete (globalThis as any).window;
  resetVerificationReturnForTests();
  check('no window at all does not throw', consumeVerificationReturn() === false);
}

// ── 5. The wiring ───────────────────────────────────────────────────────────
{
  const gate = read('src/features/authentication/components/VerifyEmailGate.tsx');
  const verification = read('src/features/authentication/services/emailVerification.ts');
  const flags = read('src/features/settings/hooks/useUiFlags.ts');

  check('the verification gate links to the provider inbox', /webmailTargetFor\(email\)/.test(gate));
  check(
    'the inbox link opens in a new tab',
    /target="_blank"/.test(gate) && /rel="noreferrer noopener"/.test(gate),
    'replacing the whole tab would throw away the verification screen mid-flow',
  );
  check(
    'no inbox button is shown when the provider is unknown',
    /\{webmail && \(/.test(gate),
    'a button that cannot work is worse than no button',
  );
  check('the verification email carries the marker', /withVerificationMarker\(continueUrl\)/.test(verification));
  check(
    'arriving from verification skips the landing screen',
    /arrivedFromVerification/.test(flags) && /!arrivedFromVerification/.test(flags),
    'the user would land on the marketing screen moments after being told they can continue',
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

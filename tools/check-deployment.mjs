#!/usr/bin/env node
/**
 * Check a Nearby deployment end to end.
 *
 * Usage:
 *   node tools/check-deployment.mjs
 *   node tools/check-deployment.mjs https://api.fashfos.com https://nearby.fashfos.com
 *
 * Defaults come from the arguments, or from VITE_API_URL / a built-in guess.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every failure mode this checks has actually happened on this project, and
 * each one showed up as "the app is broken" with no indication of which of the
 * six possible layers was at fault. This walks the layers in order and stops
 * reporting the first thing that is actually wrong:
 *
 *   1. Is the backend running at all? (Render suspends free services — the
 *      response is a 503 with `x-render-routing: suspend`, which looks like a
 *      crash but is not.)
 *   2. Is the referral code deployed? (A backend that is up but running an old
 *      build answers /health and 404s everything else.)
 *   3. Has the migration been run? (The tables are what the endpoints need;
 *      a missing table is a 500 with `relation ... does not exist`.)
 *   4. Is the auth guard actually guarding? (/referrals/me with no token must
 *      be 401, never 200.)
 *   5. Is CORS configured for the real frontend origin? (FRONTEND_URL on the
 *      backend must list the site that is calling it, or every request fails
 *      in the browser with a message that names neither side.)
 *   6. Is the Firebase auth proxy live? (Without it, Google sign-in and the
 *      password-reset page fall through to the SPA rewrite and the popup shows
 *      the firebaseapp.com domain.)
 *
 * Exits non-zero if anything fails, so it works in a deploy step or a cron.
 */

const API = (process.argv[2] ?? process.env.VITE_API_URL ?? 'https://api.fashfos.com').replace(/\/$/, '');
const SITE = (process.argv[3] ?? process.env.VITE_SITE_URL ?? 'https://nearby.fashfos.com').replace(/\/$/, '');
const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID ?? 'nearby-socials';

const results = [];
function record(name, pass, detail, fix) {
  results.push({ name, pass, detail, fix });
  const mark = pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${mark} ${name}`);
  if (!pass) {
    if (detail) console.log(`      ${detail}`);
    if (fix) console.log(`      \x1b[33mfix:\x1b[0m ${fix}`);
  }
}

async function timedFetch(url, options = {}, ms = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

console.log('\n\x1b[1mNearby deployment check\x1b[0m');
console.log(`  backend : ${API}`);
console.log(`  frontend: ${SITE}\n`);

// ── 1. Backend reachable, and not suspended ────────────────────────────────
console.log('\x1b[1mBackend\x1b[0m');
let backendUp = false;
try {
  const res = await timedFetch(`${API}/health`);
  const suspended = res.headers.get('x-render-routing') === 'suspend';
  const body = await res.text();

  if (suspended) {
    record('backend is running', false,
      'Render answered 503 with x-render-routing: suspend — the service is SUSPENDED, not crashing.',
      'Open the Render dashboard. Free instance hours reset at the start of each calendar month; ' +
      'a bandwidth or service-initiated-traffic suspension needs a paid instance to restore. ' +
      'See the launch runbook, "the Render free-tier trap".');
  } else if (res.status === 404) {
    // Render serves its own 404 for a hostname with no service.
    record('backend is running', false,
      `404 from ${API} — no service is attached to that hostname (or the onrender.com name changed).`,
      'Check the service URL in the Render dashboard, and the api CNAME in Netlify DNS.');
  } else {
    record('backend is running', res.ok, `HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`,
      'Check Render logs for a failed build or a boot error (usually a bad database URL).');
    backendUp = res.ok;
  }
} catch (error) {
  record('backend is running', false, `${error.name}: ${error.message}`,
    'DNS may not resolve yet, or the service is cold-starting. A Render free service takes ~60s to wake.');
}

if (!backendUp) {
  console.log('\n\x1b[33mStopping: nothing else can be verified until the backend responds.\x1b[0m\n');
  process.exit(1);
}

// ── 2. The referral module is deployed ────────────────────────────────────
console.log('\n\x1b[1mReferral API\x1b[0m');
try {
  const res = await timedFetch(`${API}/referrals/code/THISISNOTACODE`);
  record('referral routes exist', res.status !== 404,
    `HTTP ${res.status} on /referrals/code/…`,
    'This backend build predates the referral work, or the module is not in app.module.ts. Redeploy the latest zip.');

  if (res.ok) {
    const body = await res.json();
    record('unknown code is reported invalid, not accepted',
      body?.valid === false, `responded ${JSON.stringify(body)}`,
      'A code lookup that reports an unknown code as valid would let anyone attribute anyone.');
  }
} catch (error) {
  record('referral routes exist', false, error.message);
}

// ── 3. The migration has been run ─────────────────────────────────────────
try {
  const res = await timedFetch(`${API}/referrals/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'SMOKETEST' }),
  });
  const body = await res.text();

  if (res.ok) {
    record('database tables exist (write path works)', true, `HTTP ${res.status}`);
  } else if (/relation .* does not exist|42P01/i.test(body)) {
    record('database tables exist (write path works)', false,
      'Postgres says a table does not exist — the migration has not been run against this database.',
      'From the backend folder: npm run db:migrate');
  } else {
    record('database tables exist (write path works)', false, `HTTP ${res.status} — ${body.slice(0, 160)}`,
      'Check the Render logs for the underlying error.');
  }
} catch (error) {
  record('database tables exist (write path works)', false, error.message);
}

// ── 4. The auth guard guards ──────────────────────────────────────────────
try {
  const res = await timedFetch(`${API}/referrals/me`);
  record('protected routes reject anonymous requests', res.status === 401,
    `HTTP ${res.status} on /referrals/me with no token`,
    res.status === 200
      ? 'CRITICAL: an unauthenticated request reached user data. Do not launch until this is 401.'
      : 'Expected 401. A 500 means the guard is throwing instead of rejecting.');
} catch (error) {
  record('protected routes reject anonymous requests', false, error.message);
}

// ── 5. CORS allows the real origin ────────────────────────────────────────
console.log('\n\x1b[1mCORS\x1b[0m');
try {
  const res = await timedFetch(`${API}/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: SITE,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  const allow = res.headers.get('access-control-allow-origin');
  record('the frontend origin is allowed by the backend', allow === SITE || allow === '*',
    `Origin ${SITE} was answered with access-control-allow-origin: ${allow ?? '(absent)'}`,
    'Set FRONTEND_URL on the backend to include this exact origin (scheme + host, no trailing slash, ' +
    'comma-separated for several). A wrong value here fails every API call in the browser while ' +
    'curl works perfectly — which is the confusing part.');
} catch (error) {
  record('the frontend origin is allowed by the backend', false, error.message);
}

// ── 6. The frontend and its auth proxy ────────────────────────────────────
console.log('\n\x1b[1mFrontend\x1b[0m');
try {
  const res = await timedFetch(SITE);
  const html = await res.text();
  record('site is serving', res.ok && html.includes('<div id="root"'),
    `HTTP ${res.status}${html.includes('<div id="root"') ? '' : ' but the page is not the app shell'}`,
    'Check the Netlify deploy log and that the publish directory is dist.');
} catch (error) {
  record('site is serving', false, error.message);
}

try {
  // A transparent proxy answers with Firebase's handler, not with index.html.
  // Netlify rewrites unmatched paths to the SPA, so the failure signature is a
  // 200 that contains the app shell — which is why this checks the body, not
  // just the status code.
  const res = await timedFetch(`${SITE}/__/auth/handler`);
  const body = await res.text();
  const isSpa = body.includes('<div id="root"');

  record('Firebase auth proxy is live (/__/auth/*)', res.status !== 404 && !isSpa,
    res.status === 404
      ? 'HTTP 404 — the /__/auth redirect is not in the deployed netlify.toml.'
      : 'The SPA catch-all is answering /__/auth/* instead of the proxy — netlify.toml redirects are ' +
        'applied in order, so the proxy rule must come BEFORE the /* rule.',
    'Deploy the current netlify.toml. Without this, Google sign-in and the password-reset page ' +
    'fall back to the firebaseapp.com domain.');

  const expected = `https://${PROJECT}.firebaseapp.com/__/auth/handler`;
  if (res.status !== 404 && !isSpa) {
    record('proxy reaches Firebase (not an empty rewrite)', true);
  } else {
    record('proxy reaches Firebase (not an empty rewrite)', false,
      `expected Firebase's helper for ${expected}`);
  }
} catch (error) {
  record('Firebase auth proxy is live (/__/auth/*)', false, error.message);
}

// ── 7. The invite link actually carries the app ───────────────────────────
try {
  const res = await timedFetch(`${SITE}/?ref=SMOKETEST`);
  const html = await res.text();
  record('an invite link loads the app', res.ok && html.includes('<div id="root"'),
    `HTTP ${res.status}`, 'The SPA rewrite must serve index.html for /?ref=…');
} catch (error) {
  record('an invite link loads the app', false, error.message);
}

// ── Report ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log(`\n${'─'.repeat(60)}`);
if (failed.length === 0) {
  console.log(`\x1b[32mAll ${results.length} checks passed.\x1b[0m\n`);
  process.exit(0);
}
console.log(`\x1b[31m${failed.length} of ${results.length} checks failed:\x1b[0m`);
for (const f of failed) console.log(`  • ${f.name}`);
console.log('');
process.exit(1);

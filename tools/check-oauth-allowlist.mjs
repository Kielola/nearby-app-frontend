#!/usr/bin/env node
/**
 * Check whether Google will actually accept a sign-in from your domain.
 *
 * Usage:
 *   node tools/check-oauth-allowlist.mjs
 *   node tools/check-oauth-allowlist.mjs https://nearby.fashfos.com https://nearbyfash.netlify.app
 *
 * WHY THIS EXISTS
 * ---------------
 * Google sign-in has TWO allowlists and they are configured in two different
 * consoles:
 *
 *   1. Firebase  -> Authentication -> Settings -> Authorized domains
 *   2. Google Cloud -> Google Auth Platform -> Clients -> your Web client
 *                     -> Authorized redirect URIs
 *
 * A domain present in (1) but missing from (2) is the single most common
 * misconfiguration in this stack, and it fails in the worst possible way: the
 * user picks their Google account, and *then* gets
 * "Error 400: redirect_uri_mismatch". Nothing in the app can detect it in
 * advance, because the failure happens on Google's servers.
 *
 * This asks Google directly. It:
 *   1. reads your public Firebase API key (from the deployed bundle, so there is
 *      nothing to configure),
 *   2. asks Identity Toolkit which OAuth client_id your project signs in with,
 *   3. opens Google's real authorization endpoint with each candidate
 *      redirect_uri and reports whether Google accepts or refuses it.
 *
 * The API key is the one that already ships inside every visitor's browser
 * bundle. It is public by design and is not a secret.
 */

import { readFileSync } from 'fs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const SITE = args[0] ?? 'https://nearby.fashfos.com';

const CANDIDATES = args.length > 0
  ? args
  : [
      'https://nearby.fashfos.com',
      'https://nearbyfash.netlify.app',
      'https://fashfos.com',
      'https://www.fashfos.com',
    ];

let failures = 0;

// ── Step 1: find a deployed bundle and read the public config out of it ─────
async function findApiKey() {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;

  const bases = [...new Set([SITE, 'https://nearbyfash.netlify.app', 'https://nearby.fashfos.com'])];

  for (const base of bases) {
    try {
      const res = await fetch(base, { redirect: 'follow' });
      if (!res.ok) continue;
      const html = await res.text();
      const match = html.match(/assets\/[^"']*\.js/);
      if (!match) continue;

      const js = await (await fetch(new URL(match[0], base).toString())).text();
      const key = js.match(/AIzaSy[A-Za-z0-9_-]{25,}/);
      if (key) {
        console.log(`  API key read from ${base}`);
        return key[0];
      }
    } catch {
      // try the next base
    }
  }
  return null;
}

// ── Step 2: ask Identity Toolkit which client_id this project uses ──────────
async function findClientId(apiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google.com',
        continueUri: `${SITE}/`,
      }),
    },
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  }
  const uri = data.authUri ?? '';
  const match = uri.match(/client_id=([^&]+)/);
  if (!match) throw new Error('no client_id in the authUri response');
  return decodeURIComponent(match[1]);
}

// ── Step 3: does Google accept this redirect_uri for that client? ──────────
async function googleAcceptsRedirectUri(clientId, redirectUri) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');

  let body = '';
  let finalUrl = '';
  let status = 0;

  try {
    // MUST follow redirects.
    //
    // A refused redirect_uri does NOT come back as a 400. Google answers with a
    // 302 to `https://accounts.google.com/signin/oauth/error?authError=…`, and
    // the reason is only visible in that destination — the first response is an
    // empty-looking redirect with no error text in its body at all.
    //
    // An earlier version of this tool used `redirect: 'manual'` and treated any
    // 302 as success, so it reported every domain as allow-listed including ones
    // Google was actively refusing. Following the redirect is what makes this
    // measurement mean anything.
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NearbyDeployCheck/1.0)' },
      redirect: 'follow',
    });
    status = res.status;
    finalUrl = res.url;
    body = await res.text();
  } catch (error) {
    return { ok: false, reason: `request failed: ${error.message}` };
  }

  // Google signals failure by landing on its OAuth error page. Check the final
  // URL first — it is the reliable signal — then the body as a backstop.
  const landedOnError = /\/signin\/oauth\/error|authError=/.test(finalUrl);
  const bodySaysMismatch = /redirect_uri_mismatch/i.test(body);
  const bodySaysError = /Error 400/i.test(body) && /redirect_uri/i.test(body);

  if (landedOnError || bodySaysMismatch || bodySaysError) {
    // The authError parameter is a base64 protobuf that carries the machine
    // reason; decode it so the message names the actual problem.
    let reason = 'redirect_uri_mismatch';
    const encoded = finalUrl.match(/authError=([^&]+)/);
    if (encoded) {
      const decoded = Buffer.from(decodeURIComponent(encoded[1]), 'base64')
        .toString('utf8')
        .replace(/[^\x20-\x7E]+/g, ' ')
        .trim();
      const known = decoded.match(/redirect_uri_mismatch|invalid_client|invalid_request|unauthorized_client/i);
      if (known) reason = known[0];
    }
    return { ok: false, reason };
  }

  // A usable answer is Google's account chooser or the consent screen.
  if (status === 200 && /accounts\.google\.com|Choose an account|Sign in|consent/i.test(body)) {
    return { ok: true };
  }
  return { ok: false, reason: `unexpected response (HTTP ${status})` };
}

// ── Run ────────────────────────────────────────────────────────────────────
console.log('\n\x1b[1mGoogle sign-in allowlist check\x1b[0m');

console.log('\nLocating your Firebase API key…');
const apiKey = await findApiKey();
if (!apiKey) {
  console.error(
    '  \x1b[31m✗\x1b[0m Could not read an API key from any deployed bundle.\n' +
      '    Pass one explicitly:  VITE_FIREBASE_API_KEY=AIza... node tools/check-oauth-allowlist.mjs\n',
  );
  process.exit(1);
}

console.log('Resolving the OAuth client Firebase signs in with…');
let clientId;
try {
  clientId = await findClientId(apiKey);
  console.log(`  client_id: ${clientId.slice(0, 22)}…${clientId.slice(-24)}`);
} catch (error) {
  console.error(`  \x1b[31m✗\x1b[0m Could not resolve the client id: ${error.message}`);
  console.error('    This usually means Google sign-in is not enabled for the project.');
  process.exit(1);
}

console.log('\nAsking Google about each redirect URI:\n');

for (const origin of CANDIDATES) {
  const redirectUri = `${origin.replace(/\/$/, '')}/__/auth/handler`;
  const result = await googleAcceptsRedirectUri(clientId, redirectUri);

  if (result.ok) {
    console.log(`  \x1b[32m✓\x1b[0m ${redirectUri}`);
  } else {
    failures += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${redirectUri}`);
    console.log(`      Google refused this redirect URI (${result.reason}).`);
    console.log('      \x1b[33mfix:\x1b[0m add it under Google Cloud → \x1b[1mGoogle Auth Platform → Clients\x1b[0m');
    console.log('           → the client named "Web client (auto created by Google Service)"');
    console.log('           → \x1b[1mAuthorized redirect URIs\x1b[0m → Add URI. Also add the bare origin');
    console.log('           (without /__/auth/handler) under \x1b[1mAuthorized JavaScript origins\x1b[0m.');
  }
}

console.log(`\n${'─'.repeat(62)}`);
if (failures === 0) {
  console.log('\x1b[32mAll redirect URIs are allow-listed. Google sign-in will work on these domains.\x1b[0m\n');
} else {
  console.log(`\x1b[31m${failures} redirect URI(s) refused.\x1b[0m`);
  console.log(
    '\nUntil these are added, setting VITE_FIREBASE_AUTH_DOMAIN to the corresponding\n' +
      'domain will BREAK Google sign-in with "Error 400: redirect_uri_mismatch" —\n' +
      'shown to the user only AFTER they have picked their Google account.\n',
  );
}
process.exit(failures === 0 ? 0 : 1);

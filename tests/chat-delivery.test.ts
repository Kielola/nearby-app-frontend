/**
 * Regression guards for the live chat-delivery failure.
 *
 * WHY THESE ASSERT ON SOURCE TEXT
 *
 * The bugs these guard against are all *absences* — a handler that was never
 * registered, a guard that was never written, a `catch` that was never added.
 * Every one of them produced code that typechecks, builds, and behaves
 * perfectly in a single-user test; they only fail with two real phones and a
 * socket that has reconnected. There is no unit of behaviour to call, because
 * the missing thing is the call itself.
 *
 * So these assert on the shape of the source: if someone deletes the rejoin, or
 * moves the location effect's guard, this fails loudly instead of shipping.
 * That is weaker than an integration test and it is not pretending otherwise —
 * it is the guard that would have caught this bug before the CEO saw it.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ESM: `__dirname` does not exist, and this suite reads files relative to the
// repo root, so derive it from the module URL instead.
const __dirname = dirname(fileURLToPath(import.meta.url));

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
}

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const chatSync = read('src/features/chat/hooks/useChatSync.ts');
const chatSocket = read('src/lib/socket/chatSocket.ts');
const locationTracking = read('src/features/maps/hooks/useLocationTracking.ts');
const gatewayPath = '../nearby-backend/src/chat/chat.gateway.ts';

// ── 1. Rooms must be re-joined on every reconnect ───────────────────────────
// Socket.IO does not restore room membership across a reconnect. Without a
// `connect` handler the socket reconnects into zero rooms and silently receives
// nothing — while still reporting `connected: true`.
check(
  'chat sync registers a connect handler',
  /socket\.on\(\s*'connect'/.test(chatSync),
  'no socket.on(\'connect\') — room membership will not survive a reconnect',
);
check(
  'the connect handler re-joins every known room',
  /function handleConnect\(\)[\s\S]{0,400}?joinAllRooms\(/.test(chatSync),
  'connect handler does not call joinAllRooms',
);
check(
  'send path joins the room unconditionally, not only on first contact',
  /socket\.emit\('join_conversation'[\s\S]{0,200}?socket\.emit\('send_message'/.test(chatSync),
  'sendChatMessage no longer joins before sending',
);

// ── 2. Setup failure must not be silent, and must retry ─────────────────────
// A rejected listConversations (free-tier cold start, mobile blip) used to kill
// setup as an unhandled promise rejection: no listener, no rooms, no isReady.
check(
  'setup failure is caught and logged',
  /attemptSetup\(\)[\s\S]{0,400}?\.catch\(/.test(chatSync) || /setup\(\)\s*\.catch\(/.test(chatSync),
  'setup() rejection is unhandled again',
);
check(
  'setup retries before giving up',
  /SETUP_MAX_ATTEMPTS/.test(chatSync) && /setTimeout\(attemptSetup/.test(chatSync),
  'no retry loop — a cold backend still leaves chat dead until reload',
);
check(
  'socket connect_error is surfaced',
  /socket\.on\(\s*'connect_error'/.test(chatSync),
  'connect_error is swallowed again — a wrong VITE_SOCKET_URL will be invisible',
);

// ── 3. A refused message must not look delivered ────────────────────────────
// The bubble is set to 'sent' by the sender the moment it emits, so a silent
// server-side refusal left a single tick on a message that was never stored.
check(
  'chat sync listens for message:error',
  /socket\.on\(\s*'message:error'/.test(chatSync),
  'no message:error listener — refusals show as delivered',
);
check(
  'chat socket module never disconnects a live socket on read',
  !/if\s*\(\s*!chatSocket\.connected\s*\)\s*\{?\s*disconnect/.test(chatSocket),
  'chatSocket tears down on an unconnected read — the reconnect-storm pattern',
);

// ── 4. Location must not run while signed out ───────────────────────────────
// Unguarded, this ran a high-accuracy GPS watch on the LOGIN screen, re-rendering
// the email/password form several times a second: the input lag users reported.
// It also fired a permission prompt before the account existed.
const guardCount = (locationTracking.match(/if \(!currentUser\) return;/g) || []).length;
check(
  'both location effects bail out when signed out',
  guardCount >= 2,
  `found ${guardCount} guard(s), expected 2 — the login screen will lag again`,
);
check(
  'watchPosition only starts after the signed-out guard',
  locationTracking.indexOf('if (!currentUser) return;') < locationTracking.indexOf('watchPosition('),
  'guard sits after the watch starts, so it does not prevent anything',
);

// ── 5. The backend must say why it refused ──────────────────────────────────
let gateway = '';
try {
  gateway = read(gatewayPath);
} catch {
  // The backend lives beside the frontend repo in the workspace; when tests run
  // from an extracted frontend-only checkout, skip rather than false-fail.
  gateway = '';
}
if (gateway) {
  check(
    'chat gateway logs refused joins instead of returning silently',
    /console\.warn\([\s\S]{0,300}?join refused/.test(gateway),
    'a refused join is silent again — undiagnosable in production',
  );
  check(
    'chat gateway emits message:error on refusal',
    /client\.emit\('message:error'/.test(gateway),
    'refusals no longer reach the client',
  );
  check(
    'chat gateway logs its own send failures',
    /console\.error\([\s\S]{0,200}?send failed/.test(gateway),
    'a storage failure during send is silent again',
  );
}

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `\n      → ${r.detail}`}`);
}
console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

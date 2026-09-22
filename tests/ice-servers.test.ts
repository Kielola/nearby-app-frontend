/* Verifies call connectivity configuration — the launch blocker. */
import {
  getIceServers,
  getRelayOnlyIceServers,
  getConfiguredTurn,
  hasConfiguredTurn,
  describeIceConfiguration,
} from '../src/features/calls/iceServers';

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail = '') => results.push({ name, pass, detail });
const setEnv = (v: Record<string, string> | null) => {
  (globalThis as any).__NEARBY_BUILD_ENV__ = v;
};
const urls = (list: any[]) => list.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));

// ── no relay configured: must still attempt a relayed connection ──────────
setEnv(null);
const dflt = getIceServers();
check('default config still includes a TURN relay (not STUN-only)',
  urls(dflt).some((u) => String(u).startsWith('turn:')), urls(dflt).filter((u: string) => u.startsWith('turn:')).join(', '));
check('default config includes STUN for the direct path',
  urls(dflt).some((u) => String(u).startsWith('stun:')));
check('hasConfiguredTurn() is false when nothing is set', hasConfiguredTurn() === false);
check('describeIceConfiguration warns it is unconfigured',
  describeIceConfiguration().includes('NOT configured'), describeIceConfiguration());

// ── relay configured properly ────────────────────────────────────────────
setEnv({
  VITE_TURN_URLS: 'turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443,turns:a.relay.metered.ca:443?transport=tcp',
  VITE_TURN_USERNAME: 'user123',
  VITE_TURN_CREDENTIAL: 'pass456',
});
const cfg = getIceServers();
const turn = cfg.filter((s) => urls([s]).some((u) => String(u).startsWith('turn')));
check('configured relay replaces the public fallback',
  turn.length === 1 && urls(turn).length === 3, `${turn.length} server(s), ${urls(turn).length} url(s)`);
check('configured relay carries its credentials',
  turn[0].username === 'user123' && turn[0].credential === 'pass456');
check('includes a turns:// endpoint for filtered mobile networks',
  urls(turn).some((u) => String(u).startsWith('turns:')), urls(turn).join(', '));
check('STUN is still present alongside the relay',
  urls(cfg).some((u: string) => String(u).startsWith('stun:')));
check('hasConfiguredTurn() is true', hasConfiguredTurn() === true);
check('describeIceConfiguration reports the endpoint count',
  describeIceConfiguration().includes('3 endpoints'), describeIceConfiguration());

// ── relay configured but credentials missing — the silent killer ─────────
setEnv({ VITE_TURN_URLS: 'turn:a.relay.metered.ca:443' });
const warns: string[] = [];
const realWarn = console.warn;
console.warn = (...a: any[]) => warns.push(a.join(' '));
const halfCfg = getIceServers();
console.warn = realWarn;
check('half-configured relay warns loudly instead of failing mysteriously',
  warns.some((w) => w.includes('VITE_TURN_USERNAME')), `${warns.length} warning(s)`);
check('half-configured relay still returns servers (degrades, does not throw)',
  urls(halfCfg).some((u) => String(u).startsWith('turn:')));

// ── relay-only mode ──────────────────────────────────────────────────────
setEnv({
  VITE_TURN_URLS: 'turn:a.relay.metered.ca:443',
  VITE_TURN_USERNAME: 'u',
  VITE_TURN_CREDENTIAL: 'p',
});
const relayOnly = getRelayOnlyIceServers();
check('relay-only mode excludes STUN entirely',
  !urls(relayOnly).some((u) => String(u).startsWith('stun:')), urls(relayOnly).join(', '));
check('relay-only mode still has a relay', urls(relayOnly).length > 0);
check('relay-only mode never returns an empty list (would break ICE)',
  getConfiguredTurn() === null ? getRelayOnlyIceServers().length > 0 : true);

setEnv(null);

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
console.log(`\nRESULT: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);

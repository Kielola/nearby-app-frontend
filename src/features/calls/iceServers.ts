/**
 * ICE server configuration for WebRTC calls.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A MODULE AND NOT AN ARRAY IN THE HOOK
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Calls need a TURN relay to work on Nigerian mobile networks. That is not a
 * tuning detail, it is the difference between calls connecting and calls
 * ringing then dying, so it lives somewhere with room to explain itself.
 *
 * Most Nigerian mobile subscribers are behind carrier-grade NAT. Both callers
 * share a public address with thousands of other subscribers, and the carrier
 * will not accept an unsolicited inbound packet from a stranger. STUN can
 * discover each peer's public address, but discovery is not permission. With
 * only STUN configured, ICE finds two candidates it cannot actually connect to,
 * the call shows "ringing", and then times out — which is exactly the symptom
 * being fixed here.
 *
 * A TURN server is a relay both peers *can* reach, because both peers opened
 * the connection outward. When direct connection is impossible, media flows
 * through the relay. That is what makes the call work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONFIGURING A REAL RELAY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The defaults below include Metered's public "Open Relay" demo credentials.
 * They need no sign-up, which is why they are the fallback — but they are a
 * shared free service used by a great many applications. They are rate-limited,
 * frequently saturated, and were never intended to carry production traffic.
 *
 * For launch, create a free Metered account — 20 GB of relay traffic per month,
 * every month, no card — and set these in the frontend's build environment:
 *
 *   VITE_TURN_URLS="<copied from the dashboard — see below>"
 *   VITE_TURN_USERNAME="<from the Metered dashboard>"
 *   VITE_TURN_CREDENTIAL="<from the Metered dashboard>"
 *
 * Copy the URLs from the dashboard rather than from any example here. The
 * hostname encodes your plan and region: a free account is served from
 * `standard.relay.metered.ca`, a paid or global one from
 * `global.relay.metered.ca`. A relay URL pointing at the wrong host fails in
 * exactly the way a misconfigured network does.
 *
 * Only turn: and turns: URLs belong in VITE_TURN_URLS — STUN is added
 * automatically by getIceServers() below, and a relay URL is useless without
 * the username and credential beside it.
 *
 * Because Vite inlines these at BUILD time, changing them requires a rebuild,
 * not just a restart. That is the usual reason a relay change appears to have
 * no effect.
 *
 * `turns:` (TLS on 443) is listed deliberately: on mobile networks that
 * intercept or filter plain UDP, TLS on port 443 is the transport most likely
 * to get through, since it is indistinguishable from ordinary HTTPS.
 */

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Read a build-time value.
 *
 * Checks `globalThis.__NEARBY_BUILD_ENV__` first. That is a test seam: Vite
 * replaces `import.meta.env.*` at build time, so it cannot be reassigned from a
 * test, and the configured-relay path would otherwise be untestable. Outside
 * tests the global is absent and this reads Vite's env exactly as before.
 */
function env(key: string): string {
  try {
    const override = (globalThis as any).__NEARBY_BUILD_ENV__;
    if (override && typeof override[key] === 'string') return override[key].trim();

    const value = (import.meta as any)?.env?.[key];
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Public STUN servers.
 *
 * These only ever discover a peer's public address. They do not relay, and they
 * are not enough on their own — see the note at the top of this file.
 */
const STUN_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * Last-resort relay: Metered's public Open Relay.
 *
 * Kept so a build with no configured relay still attempts a relayed connection
 * rather than having none at all. Treat any successful call over this as luck,
 * not a working configuration — it is shared, capped, and can disappear.
 */
const FALLBACK_TURN: IceServerConfig = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:443?transport=tcp',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject',
};

/**
 * The configured relay, if one was provided at build time.
 *
 * `VITE_TURN_URLS` accepts a comma-separated list so several transports can be
 * offered at once — ICE will try each and use whichever connects.
 */
export function getConfiguredTurn(): IceServerConfig | null {
  const urls = env('VITE_TURN_URLS')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) return null;

  const username = env('VITE_TURN_USERNAME');
  const credential = env('VITE_TURN_CREDENTIAL');

  // A relay URL with no credentials is usually a half-finished configuration.
  // Warn rather than silently dropping it, because the resulting failure looks
  // exactly like a network problem and is easy to misdiagnose for hours.
  if (!username || !credential) {
    console.warn(
      '[calls] VITE_TURN_URLS is set but VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL are missing. ' +
        'The relay will reject every allocation. Calls will fall back to STUN and will not ' +
        'connect on mobile networks behind carrier-grade NAT.',
    );
  }

  return { urls, username: username || undefined, credential: credential || undefined };
}

/** True when a real relay has been configured for this build. */
export function hasConfiguredTurn(): boolean {
  return getConfiguredTurn() !== null;
}

/**
 * The ICE servers to use for a normal call attempt: direct connection first,
 * relay as the fallback ICE itself picks when direct candidates fail.
 */
export function getIceServers(): IceServerConfig[] {
  const turn = getConfiguredTurn();
  return [...STUN_SERVERS, turn ?? FALLBACK_TURN];
}

/**
 * ICE servers for a forced-relay attempt.
 *
 * `iceTransportPolicy: 'relay'` makes the browser skip host and server-reflexive
 * candidates entirely and use only the relay. Pair that with these servers and
 * the connection is made through TURN by construction.
 *
 * This is the retry that rescues calls on carrier-grade NAT when the browser's
 * own candidate selection has already given up on the direct paths. It is
 * slower to establish and always costs relay bandwidth, which is why it is a
 * fallback rather than the default.
 */
export function getRelayOnlyIceServers(): IceServerConfig[] {
  const turn = getConfiguredTurn();
  if (turn) return [turn];
  return [FALLBACK_TURN];
}

/** Diagnostics shown when a call fails, so the cause is not guessed at. */
export function describeIceConfiguration(): string {
  const turn = getConfiguredTurn();
  if (turn) {
    const count = Array.isArray(turn.urls) ? turn.urls.length : 1;
    return `relay configured (${count} endpoint${count === 1 ? '' : 's'})`;
  }
  return 'relay NOT configured — using the shared public fallback';
}

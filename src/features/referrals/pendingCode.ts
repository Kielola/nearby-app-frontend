/**
 * The referral code a visitor arrived with — or typed in themselves during
 * sign-up — held in one place.
 *
 * ## Why this module exists
 *
 * The code has three possible origins and they must not fight each other:
 *
 *   1. `/join/CODE` — the link the app now generates and shares
 *   2. `?ref=CODE` — the original parameter, still live in links already sent
 *   3. `?referral=CODE` — the older spelling of the same thing
 *   4. A code typed or pasted into the sign-up field
 *
 * All four land in the same slot. Old links must keep working forever: a link
 * already pasted into a WhatsApp group cannot be recalled and fixed.
 *
 * Whichever came last wins, and all three end up in the same slot. That slot is
 * `localStorage`, because attribution has to survive a page reload and an email
 * verification step — the visitor is not signed in when they arrive.
 *
 * ## Why an event instead of a React context
 *
 * The capture hook is mounted at the app root, *above* the auth branch, so it is
 * running before the sign-up form exists. The sign-up field is deep inside the
 * auth tree. Rather than thread a setter through every layer between them — or
 * lift auth state into a new provider — the two talk through a tiny window event.
 * Both sides stay independent, and the storage key remains the single source of
 * truth, which is what makes the cross-tab `storage` listener fall out for free.
 *
 * ## What this module deliberately does NOT do
 *
 * It never validates that a code is real, never attributes anything, and never
 * decides a referral happened. A typed code is just a string until the server
 * resolves it. See `api.ts` for why that boundary matters.
 */

const STORAGE_KEY = 'nearby_referral_code';
const CHANGE_EVENT = 'nearby:referral-code-change';

/**
 * Codes are upper-case alphanumerics. Strip everything else rather than reject —
 * users paste with trailing spaces, smart quotes and stray newlines constantly,
 * and `ABCD 123` should become `ABCD123`, not an error message.
 *
 * Length is capped so a paste of an entire page cannot reach the API.
 */
export function normaliseReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32);
}

/** The pending code, or null. Never throws — private mode has no storage. */
export function readPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const clean = normaliseReferralCode(stored);
    return clean || null;
  } catch {
    return null;
  }
}

/**
 * Set or clear the pending code. Passing null or an empty string clears it.
 *
 * Notifies subscribers synchronously, so the capture hook sees a typed code
 * immediately rather than on the next page load.
 */
export function writePendingReferralCode(code: string | null): void {
  if (typeof window === 'undefined') return;

  const clean = code ? normaliseReferralCode(code) : '';

  try {
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the in-memory notification below still
    // lets this session attribute correctly. Only a reload loses it.
  }

  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // No CustomEvent (very old browser): subscribers simply don't hear about
    // in-session changes. Their next mount reads storage directly.
  }
}

/**
 * Listen for changes from any origin — the URL parser, the sign-up field, or
 * another tab of the same app.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToPendingReferralCode(
  listener: (code: string | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleLocal = () => listener(readPendingReferralCode());
  // Fires only for changes made by *other* tabs — which is exactly what we want,
  // since same-tab writes are already covered by handleLocal.
  const handleCrossTab = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener(readPendingReferralCode());
  };

  window.addEventListener(CHANGE_EVENT, handleLocal);
  window.addEventListener('storage', handleCrossTab);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleLocal);
    window.removeEventListener('storage', handleCrossTab);
  };
}

/**
 * Pull a referral code out of a URL, from any of the supported shapes.
 *
 * Handles `/join/ABCD1234` and its trailing-slash and nested variants, plus the
 * `?ref=` and `?referral=` query parameters.
 *
 * Returns null when the URL carries no code, so callers can tell "no invite" from
 * "empty invite".
 */
export function referralCodeFromUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;

  // Query parameters first — cheap and unambiguous.
  try {
    const url = new URL(rawUrl, 'https://placeholder.invalid');
    const fromQuery = url.searchParams.get('ref') ?? url.searchParams.get('referral');
    if (fromQuery) {
      const clean = normaliseReferralCode(fromQuery);
      if (clean) return clean;
    }

    // Path form: /join/CODE — the segment after `join`.
    const match = url.pathname.match(/\/join\/([^/?#]+)/i);
    if (match) {
      const clean = normaliseReferralCode(decodeURIComponent(match[1]));
      if (clean) return clean;
    }
  } catch {
    // Not a parseable URL. Fall through to the regex, which still works on a
    // bare path like "/join/ABCD".
  }

  const loose = rawUrl.match(/\/join\/([^/?#]+)/i);
  return loose ? normaliseReferralCode(decodeURIComponent(loose[1])) || null : null;
}

/** Exposed for tests. */
export const REFERRAL_STORAGE_KEY = STORAGE_KEY;

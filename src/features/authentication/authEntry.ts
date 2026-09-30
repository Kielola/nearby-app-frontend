/**
 * Which auth screen the app opens on, decided from the URL.
 *
 * ## Why the URL and not state
 *
 * `/join/CODE`, `/signup` and `/login` are all links somebody can send to somebody
 * else, or type, or refresh. A screen chosen by JavaScript state cannot survive a
 * refresh and cannot be linked to, so the same URL would show different screens
 * depending on what the app remembered from a previous visit.
 *
 * Deciding from the URL makes the entry point a property of the address rather than
 * of the session, which is what makes a shared invite link behave the same for
 * everyone who opens it — including someone who has used the app before.
 *
 * ## Precedence
 *
 *   1. `/signup`   — explicit, so it wins
 *   2. `/login`    — explicit, so it wins even if an invite code is present
 *   3. an invite   — `/join/CODE`, `?ref=CODE`, `?referral=CODE`, or a code already
 *                    captured, all mean "this person was invited", and an invited
 *                    person by definition has no account yet, so: sign up
 *   4. otherwise   — log in
 *
 * `/login?ref=X` resolving to log-in is deliberate. The code is still pre-filled, so
 * somebody who already has an account and follows a friend's link is not pushed into
 * registration; they just sign in and the referral still attributes.
 */

import { currentReferralCode } from '../referrals/pendingCode';

export type AuthScreen = 'login' | 'signup' | 'forgot' | 'verification';
export type AuthEntryScreen = 'login' | 'signup';

/** Normalise "/signup/" and "/SignUp" to "signup". */
function pathSegment(pathname: string): string {
  return pathname.replace(/\/+$/, '').toLowerCase().split('/').pop() ?? '';
}

/** The screen to open on, for this page load. */
export function authEntryScreen(): AuthEntryScreen {
  if (typeof window === 'undefined') return 'login';

  try {
    // Parse the whole href rather than reading `window.location.pathname`.
    // Deriving the path from one value that is definitely present is more robust
    // than trusting a second property to exist, and it keeps the path and the
    // query reads consistent with each other.
    const segment = pathSegment(new URL(window.location.href).pathname);
    if (segment === 'signup') return 'signup';
    if (segment === 'login') return 'login';
  } catch {
    // Fall through to the invite check — a malformed path should not stop the
    // invitation from working.
  }

  return currentReferralCode() ? 'signup' : 'login';
}

/** True when this page load arrived on an invite of some kind. */
export function arrivedViaInvite(): boolean {
  return Boolean(currentReferralCode());
}

/**
 * Keep the address bar in step with the screen the user is looking at.
 *
 * `/signup` and `/login` are only written for those two screens. `forgot` and
 * `verification` are steps inside a flow, not destinations, and giving them URLs
 * would invite people to link to a password-reset form or a verification wall.
 *
 * `replaceState` rather than `pushState`: the back button should leave the auth
 * flow, not walk backwards through its screens.
 */
export function syncAuthRoute(screen: AuthScreen): void {
  if (typeof window === 'undefined') return;
  if (screen !== 'login' && screen !== 'signup') return;

  const wanted = screen === 'signup' ? '/signup' : '/login';

  try {
    const url = new URL(window.location.href);
    // Clear the whole query, not just ref/referral. `/login?utm_source=...` is not
    // a URL anyone wants to share, and every parameter that mattered — the invite
    // code above all — has already been captured into storage by this point.
    if (url.pathname === wanted && !url.search) return;
    url.pathname = wanted;
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  } catch {
    // A failed history write is cosmetic — the screen itself has already changed.
  }
}

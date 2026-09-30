/**
 * Detecting that the user has just come back from the verification email.
 *
 * ## The problem
 *
 * Firebase's action page, after confirming an address, offers a continue button
 * that returns the user to the URL in `actionCodeSettings`. That is
 * `VITE_AUTH_CONTINUE_URL`, which is our own root — `https://nearby.fashfos.com`.
 *
 * Landing on the bare root is ambiguous. The app cannot tell "a new visitor has
 * arrived" from "somebody just verified their email", so it did the safe default
 * and showed the marketing landing screen. Users who had just been told "you can
 * now continue" and tapped continue found themselves back at a splash page with a
 * Get Started button and no indication anything had worked.
 *
 * ## The fix
 *
 * The continue URL carries a marker: `?verified=1`. Arriving with it means the
 * user finished verification, so the app opens on the sign-in screen — which is
 * the thing they are now able to do — rather than the landing screen.
 *
 * The marker is read ONCE and cached, then removed from the address bar. Reading
 * it twice would return false the second time, because the first read strips it;
 * caching makes the function idempotent so any component can call it safely.
 */

let consumed: boolean | null = null;

const MARKER = 'verified';

export function consumeVerificationReturn(): boolean {
  if (consumed !== null) return consumed;

  if (typeof window === 'undefined') {
    consumed = false;
    return consumed;
  }

  try {
    const url = new URL(window.location.href);
    consumed = url.searchParams.get(MARKER) === '1';

    if (consumed) {
      // Tidy it immediately. A reload should not re-trigger the "email verified"
      // confirmation, and a shared link should not carry a stale marker.
      url.searchParams.delete(MARKER);
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    consumed = false;
  }

  return consumed;
}

/** Build the continue URL that returns the user to our sign-in screen. */
export function withVerificationMarker(continueUrl: string): string {
  try {
    const url = new URL(continueUrl);
    url.searchParams.set(MARKER, '1');
    return url.toString();
  } catch {
    return continueUrl;
  }
}

/** Test seam — forget what was consumed. */
export function resetVerificationReturnForTests(): void {
  consumed = null;
}

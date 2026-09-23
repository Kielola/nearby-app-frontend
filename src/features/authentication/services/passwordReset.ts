import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../firebase';

/**
 * Send a Firebase password-reset email, optionally routing the user back to our
 * own domain afterwards.
 *
 * WHY THIS IS A SEPARATE MODULE
 *
 * Two separate domain problems look like one, and only one of them is fixable
 * from code:
 *
 *  1. **The link in the email.** By default it points at
 *     `https://<project>.firebaseapp.com/__/auth/action?mode=resetPassword...`.
 *     The domain there is owned by the Firebase console, not by this repo —
 *     it changes only under **Authentication → Templates → pencil on "Password
 *     reset" → customize action URL**. Nothing in this file can move it.
 *
 *  2. **Where the user lands after they finish.** That is `continueUrl`, and it
 *     IS ours to set — via `actionCodeSettings.url` below.
 *
 * WHY IT IS OPT-IN
 *
 * `actionCodeSettings.url` must be on a domain listed in the project's
 * authorized domains. Passing an unlisted URL does not degrade gracefully:
 * `sendPasswordResetEmail` rejects with `auth/unauthorized-continue-uri` and the
 * user gets **no email at all**. Turning this on before the domain is registered
 * would therefore break password reset for everyone — strictly worse than the
 * cosmetic problem it solves.
 *
 * So it is gated on `VITE_AUTH_CONTINUE_URL`, which is unset by default. Leave
 * it unset and behaviour is byte-for-byte what it was before this file existed.
 * Set it once the custom domain is in Firebase's authorized-domains list.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  // Written as a direct `import.meta.env.VITE_…` expression on purpose: Vite
  // only substitutes that literal form. A computed lookup (`env[key]`) compiles
  // fine and then reads `undefined` at runtime in the built bundle.
  const continueUrl = (import.meta as any).env?.VITE_AUTH_CONTINUE_URL as string | undefined;

  if (continueUrl) {
    return sendPasswordResetEmail(auth, email, {
      url: continueUrl,
      // The reset itself is completed on Firebase's action page (proxied through
      // our domain when the auth domain is switched). `handleCodeInApp: false`
      // means the email link opens in the browser rather than being captured by
      // a native app — correct for this app, which is web-only.
      handleCodeInApp: false,
    });
  }

  return sendPasswordResetEmail(auth, email);
}

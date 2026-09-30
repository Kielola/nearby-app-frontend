import { auth } from '../../../firebase';
import { sendEmailVerification as firebaseSendEmailVerification } from 'firebase/auth';

/**
 * Email verification for newly registered accounts.
 *
 * ## What Firebase actually sends
 *
 * Not a numeric code — a **link**. (The console wording is "verification link",
 * and the mail contains one clickable button.) That is the only verification
 * Firebase Auth offers without you running your own mail server; the link
 * carries a single-use `oobCode` that is bound to the account and expires.
 *
 * ## Where the link points
 *
 * `https://nearby-socials.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=…`
 *
 * The origin is Firebase's and is **not** ours to change from code — it is the
 * same locked template as the password-reset mail. See `ACTION_URL_LOCKED.md`.
 * The user does still finish on our domain, because when `VITE_AUTH_CONTINUE_URL`
 * is configured it becomes `continueUrl`, and Firebase's page offers a continue
 * button that returns there. If that variable is unset, `actionCodeSettings` is
 * omitted entirely rather than sent with an empty URL — passing an unauthorised
 * continue URL makes the send fail with `auth/unauthorized-continue-uri` and the
 * user gets **no email at all**.
 *
 * ## Why verification is only required for real addresses
 *
 * Phone registrations create a synthetic address of the form
 * `phone_<number>@nearby.com`. That mailbox does not exist, so no verification
 * mail can ever reach it and requiring verification would lock every phone user
 * out permanently. `requiresEmailVerification` encodes that rule in one place so
 * the gate, the signup path and any future caller cannot disagree about it.
 */

// The rules live in a pure module with no Firebase import, so they can be tested
// directly — the decision to lock someone out of their account should not require
// standing up an SDK to verify. Re-exported here so callers have one import.
export {
  requiresEmailVerification,
  SYNTHETIC_PHONE_DOMAIN,
  SYNTHETIC_PHONE_PREFIX,
  VERIFICATION_REQUIRED_SINCE,
} from './verificationRules';
export type { VerifiableUser } from './verificationRules';

import { requiresEmailVerification as requiresVerification } from './verificationRules';

/**
 * Flatten Firebase's nested `metadata.creationTime` into the flat shape the rule
 * expects.
 *
 * Small function, important reason: the two shapes differ, and getting it wrong
 * fails *quietly* in the permissive direction — every account would be treated as
 * grandfathered and the gate would never appear for anyone.
 */
function withCreationTime(user: any) {
  return {
    email: user?.email,
    emailVerified: user?.emailVerified,
    creationTime: user?.metadata?.creationTime ?? null,
  };
}

/** Build the settings object, or `undefined` when we have no approved URL.
 *
 *  `import.meta.env.VITE_…` is written as a literal expression on purpose: Vite
 *  only substitutes that exact form, and a computed lookup would read `undefined`
 *  in the built bundle. */
function actionCodeSettings() {
  const continueUrl = (import.meta as any).env?.VITE_AUTH_CONTINUE_URL as string | undefined;
  if (!continueUrl) return undefined;
  return {
    url: continueUrl,
    handleCodeInApp: false,
  };
}

/**
 * Outcome of a send attempt.
 *
 * A string discriminant rather than a boolean one, because `if (result.sent)`
 * did not narrow reliably here — and this way the failure cases are the union
 * member, so a caller that forgets to handle `throttled` gets a type error rather
 * than a silent generic message.
 */
export type VerificationSendResult =
  | { status: 'sent' }
  | { status: 'no-user' | 'not-required' | 'throttled' | 'failed'; message?: string };

/**
 * Send (or resend) the verification link.
 *
 * Never throws — the caller is a button handler or the signup path, and neither
 * should have to try/catch to stay alive. The distinction that matters to the UI
 * is `throttled` versus everything else: Firebase rate-limits these to protect
 * the sender reputation, and "you already asked a minute ago" is a very different
 * message from "this failed".
 */
export async function sendVerificationEmail(
  userOverride?: { email?: string | null; emailVerified?: boolean } | null,
): Promise<VerificationSendResult> {
  const user = userOverride ?? auth.currentUser;

  if (!user) return { status: 'no-user' };
  if (!requiresVerification(withCreationTime(user))) return { status: 'not-required' };

  try {
    await firebaseSendEmailVerification(user as any, actionCodeSettings());
    return { status: 'sent' };
  } catch (error: any) {
    const code = error?.code ?? '';
    if (code === 'auth/too-many-requests') {
      return {
        status: 'throttled',
        message: 'A verification email was sent recently. Please wait a minute before trying again.',
      };
    }
    return {
      status: 'failed',
      message: error?.message ?? 'Could not send the verification email.',
    };
  }
}

/**
 * Has the address been verified since we last looked?
 *
 * `reload()` is the only way to find out: the local session caches the claim
 * from sign-in, so a user who has just clicked the link in another tab still
 * looks unverified until the token is refreshed. This does hit the network, which
 * is why the gate calls it on a timer rather than on every render.
 *
 * Returns false on any error, including being offline — an unverified answer is
 * the safe one, because the alternative is letting someone through on a network
 * blip.
 */
export async function refreshVerificationStatus(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  // Note the shape passed here: Firebase's User carries `metadata.creationTime`,
  // not a top-level `creationTime`. Without flattening it the rule would see
  // `undefined` for everyone and silently grandfather the entire user base.
  if (!requiresVerification(withCreationTime(user))) return true;
  try {
    await user.reload();
    return Boolean(auth.currentUser?.emailVerified);
  } catch {
    return false;
  }
}

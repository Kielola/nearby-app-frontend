/**
 * Pure rules for email verification — no Firebase, no React, no side effects.
 *
 * Separated from `emailVerification.ts` so the decision that can lock a user out
 * of their account is testable directly, without standing up the Firebase SDK or
 * faking a browser. `emailVerification.ts` re-exports everything here, so callers
 * still have one import to remember.
 */

/**
 * The synthetic domain used for phone-number registrations.
 *
 * Must stay in step with `useAuthActions.ts`, which builds these addresses as
 * `phone_<number>@nearby.com`. If that format ever changes, this is the file that
 * has to change with it — otherwise every phone registration is asked to verify
 * an address that cannot receive mail.
 */
export const SYNTHETIC_PHONE_DOMAIN = '@nearby.com';
export const SYNTHETIC_PHONE_PREFIX = 'phone_';

/**
 * Accounts created before this are never asked to verify.
 *
 * ## Why a cutoff exists
 *
 * Verification shipped after the app had already been used. Every existing
 * email/password account is unverified — through no fault of its owner — so
 * switching the gate on for everyone at once would lock out people who did
 * nothing wrong, on the day of launch, with no way for them to have known.
 *
 * Grandfathering them means verification is real for everyone who signs up from
 * here on, while nobody who already has an account is surprised by it. Users who
 * *do* get verified are unaffected either way.
 *
 * `creationTime` is Firebase's own record of when the account was made, so this
 * cannot be spoofed by the client.
 *
 * The date this gate shipped. Accounts created from that moment on are gated;
 * anything older is not.
 *
 * ⚠️ This was originally set to a date in the FUTURE ("2026-10-01") while the app
 * was being used on 2026-09-30, which meant every account — including brand-new
 * signups — counted as "older" and was grandfathered. The result was that
 * verification silently did nothing and no email was ever sent, with no error
 * anywhere: `sendVerificationEmail` returned a normal `not-required` and the gate
 * waved the user straight through. A cutoff that excludes the present is a switch
 * that turns the feature off.
 *
 * Moving this date EARLIER gates more accounts; moving it later gates fewer. Never
 * set it ahead of the current date.
 */
export const VERIFICATION_REQUIRED_SINCE = '2026-09-30T00:00:00Z';

export interface VerifiableUser {
  email?: string | null;
  emailVerified?: boolean;
  /** Firebase `UserMetadata.creationTime` — an RFC 3339 timestamp. */
  creationTime?: string | null;
}

/**
 * Was this account created on or after the cutoff?
 *
 * Fails **closed to grandfathering** (returns false = do not require) when the
 * timestamp is missing or unparseable, for the same asymmetry documented below:
 * an unreadable date must never be the thing that locks someone out.
 */
function createdAfterCutoff(creationTime: string | null | undefined): boolean {
  if (!creationTime) return false;
  const created = Date.parse(creationTime);
  const cutoff = Date.parse(VERIFICATION_REQUIRED_SINCE);
  if (Number.isNaN(created) || Number.isNaN(cutoff)) return false;
  return created >= cutoff;
}

/**
 * Is this a real inbox that can receive a verification link, and does it still
 * need to be checked?
 *
 * Returns false for the synthetic phone addresses, for accounts with no email at
 * all, for already-verified accounts, and for anything that does not look like an
 * address.
 *
 * ## The asymmetry is deliberate
 *
 * Anything this is unsure about is treated as **not** requiring verification.
 * That is not laziness — the two failure modes are not equally bad:
 *
 *   - A **false negative** (we skip verification for a real address) means one
 *     unverified account gets in. Recoverable; you can tighten later.
 *   - A **false positive** (we demand verification for an address that cannot
 *     receive it) means a user is locked out of their own account with **no path
 *     back in at all**. Unrecoverable, and it is a support burden you cannot fix
 *     from a dashboard.
 *
 * So the check fails open, and the phone-registration trap in particular can
 * never reopen.
 */
export function requiresEmailVerification(user: VerifiableUser | null | undefined): boolean {
  if (!user) return false;

  const email = (user.email ?? '').trim().toLowerCase();

  // No usable address, or nothing address-shaped.
  if (!email || !email.includes('@')) return false;

  // Synthetic phone address: no mailbox exists, so verification is impossible.
  // `startsWith` on the local part, not `includes` — otherwise a real address
  // like `x@notnearby.com` or `x@sub.nearby.com` would be wrongly skipped.
  if (email.startsWith(SYNTHETIC_PHONE_PREFIX)) return false;
  if (email.endsWith(SYNTHETIC_PHONE_DOMAIN)) return false;

  // Already verified: nothing to do, and in particular do not re-send.
  if (user.emailVerified) return false;

  // Accounts that predate the gate are grandfathered — see the cutoff above.
  if (!createdAfterCutoff(user.creationTime)) return false;

  return true;
}

import { requiresEmailVerification } from './emailVerification';

/**
 * The one call the app boundary should use to decide whether to show the gate.
 *
 * Exists so that the metadata-flattening step cannot be forgotten. Firebase's User
 * object carries the creation timestamp at `user.metadata.creationTime`, while the
 * pure rule expects it flat. Calling the rule directly with a raw Firebase user
 * would read `undefined` for every account, treat them all as grandfathered, and
 * silently disable verification for everyone — a failure that looks like success.
 *
 * Keeping the adaptation in one place means there is exactly one correct way to
 * ask the question.
 */
export function verificationRequiredFor(user: unknown): boolean {
  const u = user as any;
  if (!u) return false;
  return requiresEmailVerification({
    email: u.email,
    emailVerified: u.emailVerified,
    creationTime: u.metadata?.creationTime ?? null,
  });
}

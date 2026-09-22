/**
 * A hand-off slot between "the user pressed I AGREE" and "the account exists".
 *
 * ## Why this indirection exists
 *
 * The user must see and accept the agreement *before* an account is created —
 * that is the whole point of a sign-up gate. But the endpoint that records the
 * acceptance is authenticated, so it cannot be called until the account and its
 * Firebase token exist. There is a genuine gap between those two moments.
 *
 * Rather than weaken the gate (create the account first, agree afterwards) or
 * fake the record client-side, the acknowledgement is parked here when the user
 * presses the button, and claimed by `AuthContext` the instant `getMe()` has
 * provisioned the user row. That is the earliest moment the server can be told.
 *
 * ## Why it is persisted, not just held in memory
 *
 * If the acknowledgement only lived in a variable and the acceptance POST failed
 * — flaky Nigerian mobile connection, app backgrounded, phone locked — the
 * record would be lost silently and the user would be treated as never having
 * agreed. Written to localStorage, the write is retried on the next app load
 * until the server confirms it.
 *
 * The value stored is a **version string**, never a boolean, and it is compared
 * against what the server already has. On success it is cleared. It is not
 * evidence of anything on its own; the server record is the evidence. This is
 * only a note-to-self that a write is still owed.
 */

const PENDING_KEY = 'nearby_terms_pending_version';

/** Called when the user presses "I AGREE", before the account exists. */
export function markPendingTermsAcceptance(version: string): void {
  try {
    localStorage.setItem(PENDING_KEY, version);
  } catch {
    /* Private mode. The in-session path still works via the caller's state. */
  }
}

/** The version awaiting a server write, or null if none is outstanding. */
export function peekPendingTermsAcceptance(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the outstanding note.
 *
 * ONLY call this once the server has confirmed the write. Clearing it earlier
 * is what would lose the record.
 */
export function clearPendingTermsAcceptance(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to do */
  }
}

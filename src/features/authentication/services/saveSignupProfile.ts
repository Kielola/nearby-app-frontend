import { usersApi } from '../../../lib/api/usersApi';
import {
  clearSignupProfile,
  hasSignupProfile,
  signupProfilePayload,
} from '../signupProfile';

/**
 * Save what the user told us at registration, now that their account exists.
 *
 * ## Why this is a separate step from creating the account
 *
 * The account is created by Firebase, and the profile lives in our own Postgres
 * behind `PATCH /me`, which needs a valid ID token. Before
 * `createUserWithEmailAndPassword` resolves there is no token to authenticate
 * with, so the two genuinely cannot happen in one request. This runs immediately
 * after, while the new session is live.
 *
 * ## Why a failure here is not an error the user sees
 *
 * At this point the account is real and the user is signed in. Showing them a
 * failure because their *age* did not save would be alarming and misleading — it
 * would read as "registration failed" when registration succeeded. So this
 * returns a boolean, and the caller does not surface it.
 *
 * The answers are NOT discarded on failure: `clearSignupProfile` runs only on
 * success, so a failed save leaves the values in the store. That is deliberate —
 * losing them would recreate the exact problem these fields were added to fix,
 * an account with an empty profile.
 *
 * ## The one thing this does not do
 *
 * There is no automatic retry. If the save fails the answers sit in the store
 * until something clears them, which today means until the tab is closed. A
 * retry on the next successful profile load would be the proper fix and is noted
 * as outstanding rather than quietly implied.
 */
export async function saveSignupProfile(): Promise<boolean> {
  if (!hasSignupProfile()) return false;

  try {
    await usersApi.updateMe(signupProfilePayload());
    clearSignupProfile();
    return true;
  } catch {
    // Swallowed on purpose — see above. The account exists and the user is in.
    return false;
  }
}

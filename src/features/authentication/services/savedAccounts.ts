/**
 * The device-local account list.
 *
 * `localStorage['nearby_saved_accounts']` is a cache of the accounts this
 * browser has signed in with, so the sign-in screen can offer them without a
 * round trip. It is a *cache*: a malformed value is not an error worth
 * surfacing, it just means the list comes back empty.
 *
 * This lives at module scope rather than inside a hook because two separate
 * hooks legitimately need it — the profile-hydration effect and the sign-in
 * actions — and threading one through the other's dependency list would make
 * the ordering of those hooks load-bearing.
 */

export const SAVED_ACCOUNTS_KEY = 'nearby_saved_accounts';

export function loadLocalAccountsFromDisk(
  setSavedAccounts: (accounts: unknown[]) => void,
): void {
  const rawAccounts = localStorage.getItem(SAVED_ACCOUNTS_KEY);
  if (!rawAccounts) return;
  try {
    const parsed = JSON.parse(rawAccounts);
    if (Array.isArray(parsed)) setSavedAccounts(parsed);
  } catch {
    // Malformed cache — leave the list as it is.
  }
}

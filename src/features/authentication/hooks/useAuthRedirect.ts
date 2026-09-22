import { useEffect } from 'react';
import { auth } from '../../../firebase';
import { browserLocalPersistence, getRedirectResult, setPersistence } from 'firebase/auth';

/**
 * Completing a sign-in that came back through a redirect
 *
 * Consumes the redirect result on mount, so a Google sign-in returning through a redirect cannot land on a UI that still thinks the user is signed out.
 *
 * Every value this block reads is declared in `UseAuthRedirectDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseAuthRedirectDeps {
  setAuthError: any;
  setAuthLoading: any;
  setCurrentUser: any;
  setShowLandingMode: any;
}

export function useAuthRedirect(deps: UseAuthRedirectDeps) {
  const {
  
    setAuthError,
    setAuthLoading,
    setCurrentUser,
    setShowLandingMode,} = deps;

// Complete Google redirect sign-in when the browser returns from Google.
// Without getRedirectResult(), a successful redirect can land back on the app
// while the UI still thinks the user is signed out. Firebase documents that the
// redirect result must be consumed after returning to the app.
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await getRedirectResult(auth);
      if (!cancelled && result?.user) {
        localStorage.removeItem('nearby_google_redirect_pending');
        localStorage.setItem('nearby_current_uid', result.user.uid);
        setCurrentUser(result.user);
        setShowLandingMode(false);
      }
    } catch (err: any) {
      console.error('Google redirect completion failed:', err);
      if (!cancelled) {
        localStorage.removeItem('nearby_google_redirect_pending');
        setAuthError(err?.message || 'Google sign-in could not be completed.');
        setAuthLoading(false);
      }
    }
  })();
  return () => { cancelled = true; };
}, []);
}

export default useAuthRedirect;

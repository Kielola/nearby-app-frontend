import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../../firebase';
import { usersApi } from '../../../lib/api';
import {
  clearPendingTermsAcceptance,
  peekPendingTermsAcceptance,
} from '../../legal/pendingAcceptance';
import { ApiUser } from '../../../lib/api/types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: ApiUser | null;
  isLoading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// This is the ONE place Firebase auth state and our Postgres user record
// get connected. Every other feature (radar, chat, friends...) reads
// `appUser` from this context instead of re-deriving it — replacing the
// pattern in useNearbyController.ts where auth state was read and acted
// on inline in dozens of places.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Firebase tells us WHO is logged in; onAuthStateChanged fires once
    // on load with the restored session (or null), then again on every
    // login/logout.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setError(null);

      if (!user) {
        setAppUser(null);
        setIsLoading(false);
        return;
      }

      try {
        // This call verifies the token server-side AND provisions the
        // Postgres row on first login (see UsersService.findOrCreateByFirebaseUid).
        const me = await usersApi.getMe();
        setAppUser(me);

        // Claim any terms acceptance the user gave on the sign-up screen.
        //
        // The agreement is shown BEFORE the account exists, so the acceptance
        // could not be sent at the moment the button was pressed. This is the
        // first point where an authenticated write is possible — `getMe()` has
        // just provisioned the row for a brand-new account.
        //
        // Runs on every login, not only on sign-up: if a previous attempt failed
        // mid-flight the note is still outstanding, and this is what retries it.
        const owedVersion = peekPendingTermsAcceptance();
        if (owedVersion && me?.termsAcceptedVersion !== owedVersion) {
          try {
            await usersApi.acceptTerms(owedVersion);
            // Cleared only now, after the server has the record.
            clearPendingTermsAcceptance();
          } catch {
            // Left outstanding on purpose — retried on the next app load.
            console.warn('[terms] acceptance not yet recorded; will retry on next load');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load user profile'));
        setAppUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

import { auth } from '../../../firebase';
import {
  signInWithEmailAndPassword as fSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as fCreateUserWithEmailAndPassword,
  signOut as fSignOut,
} from 'firebase/auth';

/**
 * The app's minimal email/password auth facade.
 *
 * Google sign-in was removed from this service deliberately — see the note in
 * `hooks/useAuthActions.ts`. Anything that needs to authenticate goes through
 * exactly these three calls, which is what keeps the sign-in surface auditable.
 */
export const authService = {
  getCurrentUser: () => auth.currentUser,

  login: async (email: string, pass: string) => {
    return fSignInWithEmailAndPassword(auth, email, pass);
  },

  signup: async (email: string, pass: string) => {
    return fCreateUserWithEmailAndPassword(auth, email, pass);
  },

  logout: async () => {
    return fSignOut(auth);
  },
};

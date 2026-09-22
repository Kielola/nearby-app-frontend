import { apiRequest } from './httpClient';
import { ApiUser, PublicProfile } from './types';

export interface UpdateMePayload {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  streetName?: string;
  customStatus?: string;
  locationAccuracy?: number | null;
}

export const usersApi = {
  // Verifies the current Firebase token and returns (or provisions) the
  // matching Postgres user row. Call this right after login.
  getMe: () => apiRequest<ApiUser>('/me'),

  // Partial profile update. This is the replacement for every
  // `setDoc/updateDoc(doc(db, 'users', uid), ...)` the client used to do —
  // the client no longer needs write access to the users collection.
  updateMe: (payload: UpdateMePayload) =>
    apiRequest<ApiUser>('/me', { method: 'PATCH', body: payload }),

  // Public profile for viewing another user. Returns no lat/lng and no
  // email, so it's safe to call for anyone you can already see on radar.
  getPublicProfile: (userId: string) =>
    apiRequest<PublicProfile>(`/users/${userId}`),

  // Record acceptance of the Terms of Service. Sends the version string only —
  // the server sets the timestamp, so the record cannot be backdated by a
  // client. Idempotent: calling it twice is harmless.
  acceptTerms: (version: string) =>
    apiRequest<{
      id: string;
      termsAcceptedVersion: string | null;
      termsAcceptedAt: string | null;
    }>('/me/terms-acceptance', { method: 'POST', body: { version } }),
};

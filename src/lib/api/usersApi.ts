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
};

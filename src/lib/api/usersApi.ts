import { apiRequest } from './httpClient';
import { ApiUser } from './types';

export const usersApi = {
  // Verifies the current Firebase token and returns (or provisions) the
  // matching Postgres user row. Call this right after login.
  getMe: () => apiRequest<ApiUser>('/me'),
};

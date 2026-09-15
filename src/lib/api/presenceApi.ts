import { apiRequest } from './httpClient';

export const presenceApi = {
  heartbeat: () => apiRequest<{ ok: true }>('/presence/heartbeat', { method: 'POST' }),

  goOffline: () => apiRequest<{ ok: true }>('/presence', { method: 'DELETE' }),

  getStatus: (userIds: string[]) =>
    apiRequest<Record<string, boolean>>('/presence/status', {
      method: 'POST',
      body: { userIds },
    }),
};

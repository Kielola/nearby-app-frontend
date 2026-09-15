import { apiRequest } from './httpClient';

export const reportsApi = {
  create: (reportedUserId: string, reason: string) =>
    apiRequest<{ report: unknown; reportCount: number; banned: boolean }>('/reports', {
      method: 'POST',
      body: { reportedUserId, reason },
    }),
};

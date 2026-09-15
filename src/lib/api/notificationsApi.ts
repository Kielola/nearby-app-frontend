import { apiRequest } from './httpClient';

export interface ApiNotification {
  id: string;
  userId: string;
  senderId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  create: (data: { userId: string; type: string; title: string; message: string }) =>
    apiRequest<ApiNotification>('/notifications', { method: 'POST', body: data }),

  list: () => apiRequest<ApiNotification[]>('/notifications'),

  markRead: (id: string) =>
    apiRequest<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),

  markAllRead: () =>
    apiRequest<{ ok: true }>('/notifications/read-all', { method: 'POST' }),

  toggleRead: (id: string, isRead: boolean) =>
    apiRequest<{ ok: true }>(`/notifications/${id}/toggle-read`, {
      method: 'POST',
      body: { isRead },
    }),

  delete: (id: string) =>
    apiRequest<{ ok: true }>(`/notifications/${id}`, { method: 'DELETE' }),

  deleteAll: () => apiRequest<{ ok: true }>('/notifications', { method: 'DELETE' }),
};

import { apiRequest } from './httpClient';
import { ApiUser, FriendRequest } from './types';

export const friendsApi = {
  sendRequest: (receiverId: string) =>
    apiRequest<FriendRequest>(`/friends/request/${receiverId}`, { method: 'POST' }),

  accept: (requestId: string) =>
    apiRequest<FriendRequest>(`/friends/${requestId}/accept`, { method: 'POST' }),

  decline: (requestId: string) =>
    apiRequest<FriendRequest>(`/friends/${requestId}/decline`, { method: 'POST' }),

  unfriend: (userId: string) =>
    apiRequest<{ ok: true }>(`/friends/${userId}`, { method: 'DELETE' }),

  listIncomingRequests: () => apiRequest<FriendRequest[]>('/friends/requests'),

  listSentRequests: () => apiRequest<FriendRequest[]>('/friends/requests/sent'),

  listFriends: () => apiRequest<ApiUser[]>('/friends'),
};

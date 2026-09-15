import { apiRequest } from './httpClient';
import { Post, Highlight } from './types';

export const postsApi = {
  create: (data: { caption?: string; mediaUrl?: string; mediaType?: 'image' | 'video' }) =>
    apiRequest<Post>('/posts', { method: 'POST', body: data }),

  feed: () => apiRequest<Post[]>('/posts/feed'),

  forUser: (userId: string) => apiRequest<Post[]>(`/posts/user/${userId}`),

  delete: (postId: string) => apiRequest<{ ok: true }>(`/posts/${postId}`, { method: 'DELETE' }),
};

export const highlightsApi = {
  create: (data: { mediaUrl: string; mediaType: 'image' | 'video'; caption?: string }) =>
    apiRequest<Highlight>('/highlights', { method: 'POST', body: data }),

  forUser: (userId: string) => apiRequest<Highlight[]>(`/highlights/user/${userId}`),

  delete: (highlightId: string) =>
    apiRequest<{ ok: true }>(`/highlights/${highlightId}`, { method: 'DELETE' }),
};

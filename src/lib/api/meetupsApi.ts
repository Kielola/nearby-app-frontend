import { apiRequest } from './httpClient';

export interface ApiMeetup {
  id: string;
  requesterId: string;
  otherUserId: string;
  location: string | null;
  scheduledAt: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface MeetupStats {
  meetupsCompleted: number;
  ratingsCount: number;
  averageRating: number | null;
}

export interface ApiMeetupRating {
  id: string;
  meetupId: string;
  raterId: string;
  ratedUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export const meetupsApi = {
  schedule: (otherUserId: string, scheduledAt?: string, location?: string) =>
    apiRequest<ApiMeetup>('/meetups', { method: 'POST', body: { otherUserId, scheduledAt, location } }),

  list: () => apiRequest<ApiMeetup[]>('/meetups'),

  confirm: (id: string) => apiRequest<ApiMeetup>(`/meetups/${id}/confirm`, { method: 'POST' }),

  complete: (id: string) => apiRequest<ApiMeetup>(`/meetups/${id}/complete`, { method: 'POST' }),

  cancel: (id: string) => apiRequest<ApiMeetup>(`/meetups/${id}/cancel`, { method: 'POST' }),

  rate: (id: string, rating: number, comment?: string) =>
    apiRequest(`/meetups/${id}/rate`, { method: 'POST', body: { rating, comment } }),

  statsForUser: (userId: string) => apiRequest<MeetupStats>(`/meetups/stats/${userId}`),

  ratingsForUser: (userId: string) => apiRequest<ApiMeetupRating[]>(`/meetups/ratings/${userId}`),
};

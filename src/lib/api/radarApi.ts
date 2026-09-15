import { apiRequest } from './httpClient';
import { NearbyUser } from './types';

export const radarApi = {
  updateLocation: (latitude: number, longitude: number) =>
    apiRequest<{ ok: true }>('/radar/location', {
      method: 'POST',
      body: { latitude, longitude },
    }),

  // Matches the old app's radar on/off toggle + visibility picker
  // (everyone / friends / hidden) — now enforced server-side.
  setVisibility: (isVisibleOnRadar: boolean, radarVisibilityMode: 'everyone' | 'friends' | 'hidden') =>
    apiRequest<{ ok: true }>('/radar/visibility', {
      method: 'POST',
      body: { isVisibleOnRadar, radarVisibilityMode },
    }),

  getNearby: (radiusKm = 5) =>
    apiRequest<NearbyUser[]>('/radar/nearby', { query: { radiusKm } }),
};

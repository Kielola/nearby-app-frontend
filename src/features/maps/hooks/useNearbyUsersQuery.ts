import { useQuery } from '@tanstack/react-query';
import { radarApi } from '../../../lib/api';

// Polling, not a live socket subscription — proximity data doesn't need
// sub-second freshness, and this replaces a much heavier pattern: the
// old code subscribed to the ENTIRE `users` collection via onSnapshot,
// downloading every user's raw lat/lng to every other client and
// filtering client-side. This asks the server for exactly "who's near
// me right now" and the server does the filtering with a spatial index.
export function useNearbyUsersQuery(enabled: boolean, radiusKm: number) {
  return useQuery({
    queryKey: ['radar', 'nearby', radiusKm],
    queryFn: () => radarApi.getNearby(radiusKm),
    enabled,
    refetchInterval: 20_000,
  });
}

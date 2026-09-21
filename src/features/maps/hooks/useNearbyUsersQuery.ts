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
    // 60s rather than 20s. Proximity data doesn't need sub-minute
    // freshness, and every poll is one Redis mget on the server. On a free
    // Redis tier metered in commands, the polling interval IS the bill.
    refetchInterval: 60_000,
  });
}

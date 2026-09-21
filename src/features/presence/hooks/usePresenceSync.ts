import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { presenceApi } from '../../../lib/api';

// Must stay comfortably below the server's HEARTBEAT_TTL_SECONDS (90s) or
// the key expires and the user flickers offline. 60s leaves 30s of slack
// for a slow network while halving the command count vs 30s.
const HEARTBEAT_INTERVAL_MS = 60_000;

// Batch status lookups are the single biggest Redis cost in the app, so
// they run far less often than the heartbeat. The radar response already
// carries is_online for everyone on it, which is what the UI mostly needs.
const STATUS_POLL_INTERVAL_MS = 120_000;

// Sends a heartbeat while the app is open (keeps this user's own presence
// key alive server-side), and separately polls online/offline status for
// whichever set of user ids the caller cares about right now (e.g. the
// current radar list). Two different concerns, one hook, since they share
// the same enabled/lifecycle condition in practice.
export function usePresenceSync(enabled: boolean, watchedUserIds: string[]) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    presenceApi.heartbeat().catch((err) => console.warn('Presence heartbeat failed:', err));
    intervalRef.current = setInterval(() => {
      presenceApi.heartbeat().catch((err) => console.warn('Presence heartbeat failed:', err));
    }, HEARTBEAT_INTERVAL_MS);

    // Best-effort — if the tab closes before this fires, the TTL in Redis
    // expires the key on its own within 90s anyway (see PresenceService).
    const handleUnload = () => {
      presenceApi.goOffline().catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      presenceApi.goOffline().catch(() => {});
    };
  }, [enabled]);

  const statusQuery = useQuery({
    queryKey: ['presence', 'status', watchedUserIds.slice().sort().join(',')],
    queryFn: () => presenceApi.getStatus(watchedUserIds),
    enabled: enabled && watchedUserIds.length > 0,
    refetchInterval: STATUS_POLL_INTERVAL_MS,
  });

  return { onlineStatusByUserId: statusQuery.data ?? {} };
}

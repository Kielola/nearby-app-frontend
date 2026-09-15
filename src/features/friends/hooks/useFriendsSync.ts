import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { friendsApi } from '../../../lib/api';

// Polling rather than a socket subscription — friend-request state
// doesn't change often enough per user to justify a dedicated real-time
// channel, and this replaces a single Firestore `array-contains` listener
// that doesn't have a backend equivalent (no realtime push here yet).
export function useFriendsSync(enabled: boolean) {
  const friendsQuery = useQuery({
    queryKey: ['friends', 'list'],
    queryFn: () => friendsApi.listFriends(),
    enabled,
    refetchInterval: 30_000,
  });

  const incomingQuery = useQuery({
    queryKey: ['friends', 'incoming'],
    queryFn: () => friendsApi.listIncomingRequests(),
    enabled,
    refetchInterval: 30_000,
  });

  const sentQuery = useQuery({
    queryKey: ['friends', 'sent'],
    queryFn: () => friendsApi.listSentRequests(),
    enabled,
    refetchInterval: 30_000,
  });

  // Memoized on the actual query data — without this, every render of
  // the consumer would produce brand-new array/object references here,
  // and a downstream `useEffect([friendIds, ...])` syncing this into
  // local state would fire (and re-render) forever even when nothing
  // actually changed.
  const friendIds = useMemo(
    () => (friendsQuery.data ?? []).map((u) => u.id),
    [friendsQuery.data],
  );

  const incomingRequestsByUserId = useMemo(
    () => Object.fromEntries((incomingQuery.data ?? []).map((r) => [r.senderId, r.id])),
    [incomingQuery.data],
  );

  const sentRequestUserIds = useMemo(
    () => (sentQuery.data ?? []).map((r) => r.receiverId),
    [sentQuery.data],
  );

  return {
    friendIds,
    incomingRequestsByUserId,
    sentRequestUserIds,
    refetchAll: () => {
      friendsQuery.refetch();
      incomingQuery.refetch();
      sentQuery.refetch();
    },
  };
}

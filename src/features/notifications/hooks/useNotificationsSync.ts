import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../../lib/api';
import { AppNotification } from '../services/createNotification';

// Polled rather than pushed live — notifications already show up
// instantly for the actions that matter (friend accept, etc. fire a
// beep + toast at the moment they happen client-side); this poll is
// just for keeping the notifications LIST itself in sync across
// devices/tabs, so a 20s interval is plenty.
export function useNotificationsSync(enabled: boolean) {
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    enabled,
    refetchInterval: 20_000,
  });

  // Backend uses isRead; the app's existing UI (getGroupedNotifications,
  // etc.) expects isUnread — mapped here once instead of touching every
  // consumer.
  const notifications: AppNotification[] = useMemo(
    () =>
      (query.data ?? []).map((n) => ({
        id: n.id,
        userId: n.userId,
        senderId: n.senderId ?? undefined,
        type: n.type as AppNotification['type'],
        title: n.title,
        message: n.message,
        isUnread: !n.isRead,
        createdAt: n.createdAt,
      })),
    [query.data],
  );

  return { notifications, refetch: query.refetch };
}

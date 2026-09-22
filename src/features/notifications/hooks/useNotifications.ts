import { useEffect, useState } from 'react';
import { notificationsApi } from '../../../lib/api';
import { AppNotification } from '../services/createNotification';
import { useNotificationsSync } from './useNotificationsSync';

/**
 * Backend notifications
 *
 * The notification list, its unread count and the four actions the UI performs on it. The list is polled from the backend; the local copy exists so the badge and the list update the instant a user taps, without waiting for the next poll.
 *
 * Every value this block reads is declared in `UseNotificationsDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseNotificationsDeps {
  appUser: any;
  currentUser: any;
  triggerBeep: any;
}

export function useNotifications(deps: UseNotificationsDeps) {
  const {
  
    appUser,
    currentUser,
    triggerBeep,} = deps;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

// Notifications now come from the backend (polled — see
// useNotificationsSync). setNotifications/setUnreadNotificationsCount
// stay as local state the UI reads from, kept in sync via this effect.
const { notifications: syncedNotifications, refetch: refetchNotifications } = useNotificationsSync(
  Boolean(currentUser) && Boolean(appUser),
);

useEffect(() => {
  setNotifications(syncedNotifications);
  setUnreadNotificationsCount(syncedNotifications.filter(n => n.isUnread).length);
}, [syncedNotifications]);

const handleMarkAllNotificationsRead = async () => {
  if (!currentUser) return;
  triggerBeep(520, 0.05);
  try {
    setNotifications(prev => prev.map(n => ({ ...n, isUnread: false })));
    setUnreadNotificationsCount(0);
    await notificationsApi.markAllRead();
    refetchNotifications();
  } catch (err) {
    console.error("Error marking all read:", err);
  }
};

const handleClearAllNotifications = async () => {
  if (!currentUser) return;
  triggerBeep(420, 0.05);
  try {
    setNotifications([]);
    setUnreadNotificationsCount(0);
    await notificationsApi.deleteAll();
  } catch (err) {
    console.error("Error clearing all notifications:", err);
  }
};

const handleDeleteNotification = async (id: string) => {
  triggerBeep(380, 0.05);
  try {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await notificationsApi.delete(id);
  } catch (err) {
    console.error("Error deleting notification:", err);
  }
};

const handleToggleReadNotification = async (id: string, currentUnread: boolean) => {
  triggerBeep(500, 0.05);
  try {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isUnread: !currentUnread } : n));
    await notificationsApi.toggleRead(id, currentUnread); // currentUnread=true means we're marking it READ now
  } catch (err) {
    console.error("Error toggling read status:", err);
  }
};

  return {
    notifications,
    unreadNotificationsCount,
    setNotifications,
    setUnreadNotificationsCount,
    handleMarkAllNotificationsRead,
    handleClearAllNotifications,
    handleDeleteNotification,
    handleToggleReadNotification,
  };
}

export default useNotifications;

import { useMemo } from 'react';
import type { DirectMessage, Neighbor } from '../../../types';
import { AppNotification } from '../../notifications/services/createNotification';

/**
 * Chat-list ordering and notification grouping.
 *
 * Split out of `useMessages` because it reads the radar-filtered neighbour list,
 * which is derived near the end of the controller — while `useMessages` itself
 * has to be built much earlier, because the send path consumes it. Needing to
 * sit in two different places in the file is the honest signal that these are
 * two different concerns.
 *
 * ## Dependency interface
 *
 * 7 parameters, all read-only.
 */
export interface UseChatListDeps {
  archivedNeighborIds: any;
  chatFilter: any;
  chatMessages: any;
  filteredNeighbors: any;
  notifications: any;
  searchWideSop: any;
  showArchivedOnly: any;
}

export function useChatList(deps: UseChatListDeps) {
  const {
    archivedNeighborIds,
    chatFilter,
    chatMessages,
    filteredNeighbors,
    notifications,
    searchWideSop,
    showArchivedOnly,
  } = deps;

      const getGroupedNotifications = () => {
        const today: AppNotification[] = [];
        const yesterday: AppNotification[] = [];
        const earlier: AppNotification[] = [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

        notifications.forEach(notif => {
          const notifTime = notif.createdAt ? new Date(notif.createdAt).getTime() : 0;
          if (notifTime >= todayStart) {
            today.push(notif);
          } else if (notifTime >= yesterdayStart) {
            yesterday.push(notif);
          } else {
            earlier.push(notif);
          }
        });

        return { today, yesterday, earlier };
      };

    // ── moved from src/app/hooks/useNearbyController.ts lines 3121-3170 ──

      const sortedChatList = useMemo(() => {
        const sortedList = [...filteredNeighbors].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          if (a.pinned && b.pinned) {
            return (b.pinTime || 0) - (a.pinTime || 0);
          }
          return 0;
        });

        let displayList = sortedList.filter(n => {
          if (!searchWideSop) return true;
          return n.name.toLowerCase().includes(searchWideSop.toLowerCase()) || 
                 n.username.toLowerCase().includes(searchWideSop.toLowerCase());
        });

        if (showArchivedOnly) {
          displayList = displayList.filter(nb => archivedNeighborIds.includes(nb.id));
        } else {
          displayList = displayList.filter(nb => !archivedNeighborIds.includes(nb.id));
        }

        displayList = displayList.filter(nb => {
          const msgs = chatMessages[nb.id] || [];
          if (msgs.length === 0) return true;
      
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.timestamp) {
            const msgTime = new Date(lastMsg.timestamp).getTime();
            const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
            const ageMs = Date.now() - msgTime;
        
            if (ageMs > twoWeeksMs && !nb.meetupHappened) {
              return false;
            }
          }
          return true;
        });

        if (chatFilter === 'unread') {
          displayList = displayList.filter(nb => {
            const msgs = chatMessages[nb.id] || [];
            const hasUnreadMsgs = msgs.some(m => m.isUnread === true);
            return hasUnreadMsgs || nb.id === 'nb-1' || nb.id === 'nb-3';
          });
        } else if (chatFilter === 'favorites') {
          displayList = displayList.filter(nb => nb.pinned);
        }
        return displayList;
      }, [filteredNeighbors, searchWideSop, showArchivedOnly, archivedNeighborIds, chatMessages, chatFilter]);

  return {
    getGroupedNotifications,
    sortedChatList,
  };
}

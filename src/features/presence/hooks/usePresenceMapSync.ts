import { useEffect } from 'react';

/**
 * Merging live presence into the presence map
 *
 * Folds the realtime online/offline feed into the map the UI reads. Merges rather than replaces, so a neighbour missing from one payload is not briefly shown as offline.
 *
 * Every value this block reads is declared in `UsePresenceMapSyncDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UsePresenceMapSyncDeps {
  onlineStatusByUserId: any;
  setPresenceMap: any;
}

export function usePresenceMapSync(deps: UsePresenceMapSyncDeps) {
  const {
  
    onlineStatusByUserId,
    setPresenceMap,} = deps;

useEffect(() => {
  setPresenceMap(prev => {
    const next = { ...prev };
    for (const [userId, isOnline] of Object.entries(onlineStatusByUserId)) {
      next[userId] = {
        online: isOnline,
        status: isOnline ? 'active' : 'offline',
        typing: next[userId]?.typing || '',
        lastSeen: next[userId]?.lastSeen || '',
        currentConversation: next[userId]?.currentConversation || '',
      };
    }
    return next;
  });
}, [onlineStatusByUserId]);
}

export default usePresenceMapSync;

import { useEffect } from 'react';
import { mergePresenceMap } from '../presenceMerge';

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
  // mergePresenceMap returns the SAME reference when nothing changed, which is
  // how React is told to skip the re-render. See presenceMerge.ts — this is the
  // fix for a render loop, not a micro-optimisation.
  setPresenceMap(prev => mergePresenceMap(prev, onlineStatusByUserId));
}, [onlineStatusByUserId]);
}

export default usePresenceMapSync;

import { useEffect } from 'react';
import { StorySnap } from '../../../types';

/**
 * The signed-in user's own highlights
 *
 * Projects the backend's highlights into the local shape, caches them so the profile renders instantly on the next cold start, and publishes the refetch function through the ref the upload path holds.
 *
 * Every value this block reads is declared in `UseMyHighlightsDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseMyHighlightsDeps {
  appUser: any;
  myBackendHighlights: any;
  refetchMyContent: any;
  refetchMyContentRef: any;
  setMyStorySnaps: any;
  setUserHighlights: any;
}

export function useMyHighlights(deps: UseMyHighlightsDeps) {
  const {
  
    appUser,
    myBackendHighlights,
    refetchMyContent,
    refetchMyContentRef,
    setMyStorySnaps,
    setUserHighlights,} = deps;

refetchMyContentRef.current = refetchMyContent;

useEffect(() => {
  if (!appUser) return;

  const loadedHighlights = myBackendHighlights.map((h) => ({
    id: h.id,
    name: h.caption || 'Highlight',
    mediaUrl: h.mediaUrl,
  }));
  setUserHighlights(loadedHighlights);
  try { localStorage.setItem('nearby_cached_highlights', JSON.stringify(loadedHighlights)); } catch (_) {}

  // Highlights double as "status" snaps for the 24h ring.
  const snaps: StorySnap[] = myBackendHighlights.map((h) => ({
    id: h.id,
    userId: appUser.id,
    username: appUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'me',
    name: appUser.displayName || 'Me',
    mediaUrl: h.mediaUrl,
    type: (h.mediaType === 'video' ? 'video' : 'image') as 'image' | 'video',
    caption: h.caption || '',
    timestamp: 'Just now',
    viewed: false,
    createdAt: new Date(h.createdAt).getTime(),
    viewers: [],
    reactions: [],
    replies: [],
    privacy: 'everyone' as const,
    customList: [],
  })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  setMyStorySnaps(snaps);
}, [appUser, myBackendHighlights]);
}

export default useMyHighlights;

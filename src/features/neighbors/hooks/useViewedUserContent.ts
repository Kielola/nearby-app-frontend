import { useEffect } from 'react';

/**
 * Posts and highlights for a real (non-demo) neighbour
 *
 * The backend-backed path for a neighbour who actually exists, kept separate from the demo-data path so a missing row reads as 'nothing yet' rather than falling back to invented content.
 *
 * Every value this block reads is declared in `UseViewedUserContentDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseViewedUserContentDeps {
  setNeighborHighlights: any;
  setNeighborPosts: any;
  viewedUserHighlights: any;
  viewedUserPosts: any;
  viewingRealProfileId: any;
}

export function useViewedUserContent(deps: UseViewedUserContentDeps) {
  const {
  
    setNeighborHighlights,
    setNeighborPosts,
    viewedUserHighlights,
    viewedUserPosts,
    viewingRealProfileId,} = deps;

useEffect(() => {
  if (!viewingRealProfileId) return;
  setNeighborPosts(viewedUserPosts.map(p => ({
    id: p.id,
    mediaUrl: p.mediaUrl || '',
    caption: p.caption || '',
    timestamp: p.createdAt,
    type: (p.mediaType as 'image' | 'video') || 'image',
  })));
  setNeighborHighlights(viewedUserHighlights.map(h => ({
    id: h.id,
    name: h.caption || 'Highlight',
    mediaUrl: h.mediaUrl,
  })));
}, [viewingRealProfileId, viewedUserPosts, viewedUserHighlights]);
}

export default useViewedUserContent;

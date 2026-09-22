import { useEffect } from 'react';

/**
 * Opening and closing the story viewer
 *
 * Builds the playlist when a story is opened and clears all playback state when it closes, so the next story opened does not start mid-way through the previous one.
 *
 * Every value this block reads is declared in `UseStoryViewerPlaybackDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseStoryViewerPlaybackDeps {
  myStorySnaps: any;
  neighborStories: any;
  setPlayingSnapIndex: any;
  setPlayingStorySnaps: any;
  setStoryProgress: any;
  storyViewer: any;
}

export function useStoryViewerPlayback(deps: UseStoryViewerPlaybackDeps) {
  const {
  
    myStorySnaps,
    neighborStories,
    setPlayingSnapIndex,
    setPlayingStorySnaps,
    setStoryProgress,
    storyViewer,} = deps;

useEffect(() => {
  if (!storyViewer) {
    setPlayingStorySnaps([]);
    setPlayingSnapIndex(0);
    setStoryProgress(0);
    return;
  }

  const snaps = storyViewer === 'me' 
    ? myStorySnaps 
    : (neighborStories[storyViewer.id] || []);

  setPlayingStorySnaps(snaps);
  setPlayingSnapIndex(0);
  setStoryProgress(0);
}, [storyViewer, myStorySnaps, neighborStories]);
}

export default useStoryViewerPlayback;

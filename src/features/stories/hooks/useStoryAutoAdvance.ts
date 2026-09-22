import { useEffect } from 'react';

/**
 * Advancing stories on a timer
 *
 * Moves to the next snap when the current one has been on screen for its full duration, and stops cleanly on pause and unmount.
 *
 * Every value this block reads is declared in `UseStoryAutoAdvanceDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseStoryAutoAdvanceDeps {
  isStoryPaused: any;
  markStoryAsViewedInFirestore: any;
  playingSnapIndex: any;
  playingStorySnaps: any;
  setPlayingSnapIndex: any;
  setStoryProgress: any;
  setStoryViewer: any;
  storyViewer: any;
}

export function useStoryAutoAdvance(deps: UseStoryAutoAdvanceDeps) {
  const {
  
    isStoryPaused,
    markStoryAsViewedInFirestore,
    playingSnapIndex,
    playingStorySnaps,
    setPlayingSnapIndex,
    setStoryProgress,
    setStoryViewer,
    storyViewer,} = deps;

useEffect(() => {
  if (playingStorySnaps.length === 0 || isStoryPaused) return;

  const currentSnap = playingStorySnaps[playingSnapIndex];
  if (currentSnap && storyViewer && storyViewer !== 'me') {
    markStoryAsViewedInFirestore(storyViewer.id, currentSnap.id, currentSnap);
  }

  const interval = setInterval(() => {
    setStoryProgress(prev => {
      if (prev >= 100) {
        if (playingSnapIndex < playingStorySnaps.length - 1) {
          setPlayingSnapIndex(idx => idx + 1);
          return 0;
        } else {
          setStoryViewer(null);
          return 0;
        }
      }
      return prev + 1.25; // 4 seconds duration
    });
  }, 50);

  return () => clearInterval(interval);
}, [playingStorySnaps, playingSnapIndex, isStoryPaused, storyViewer]);
}

export default useStoryAutoAdvance;

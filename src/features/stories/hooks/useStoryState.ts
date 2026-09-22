import type { Dispatch, SetStateAction } from 'react';
import { Neighbor, StorySnap } from '../../../types';
import { useState } from 'react';

/**
 * Story playback and composition state
 *
 * Which stories are playing, where the viewer is in the playlist, whether playback is paused, the reply box, and the composition form for posting one. The data comes from the backend; this is the playback and editing state around it.
 *
 * ## Dependency interface
 *
 * 0 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseStoryStateDeps {

}

export function useStoryState(deps: UseStoryStateDeps) {
  const {

  } = deps;

    const [myStorySnaps, setMyStorySnaps] = useState<StorySnap[]>([]);
    const [neighborStories, setNeighborStories] = useState<Record<string, StorySnap[]>>({});
    const [mutedStoryUserIds, setMutedStoryUserIds] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('muted_stories_uids') || '[]');
      } catch (_) {
        return [];
      }
    });

    const [storyUploadData, setStoryUploadData] = useState<{
      mediaUrl: string;
      type: 'image' | 'video';
    } | null>(null);
    const [storyCompositionCaption, setStoryCompositionCaption] = useState<string>('');
    const [storyCompositionPrivacy, setStoryCompositionPrivacy] = useState<'everyone' | 'friends' | 'custom'>('everyone');
    const [storyCompositionCustomList, setStoryCompositionCustomList] = useState<string[]>([]);
    const [isPublishingStory, setIsPublishingStory] = useState<boolean>(false);
    const [playingStorySnaps, setPlayingStorySnaps] = useState<StorySnap[]>([]);
    const [playingSnapIndex, setPlayingSnapIndex] = useState<number>(0);
    const [isStoryPaused, setIsStoryPaused] = useState<boolean>(false);
    const [storyViewerReplies, setStoryViewerReplies] = useState<string>('');
    const [isMutedStoriesExpanded, setIsMutedStoriesExpanded] = useState<boolean>(false);

    const [storyViewer, setStoryViewer] = useState<Neighbor | 'me' | null>(null);
    const [storyPlaylist, setStoryPlaylist] = useState<any[]>([]);
    const [storyPlaylistIndex, setStoryPlaylistIndex] = useState<number>(0);

  return {
    isMutedStoriesExpanded,
    isPublishingStory,
    isStoryPaused,
    mutedStoryUserIds,
    myStorySnaps,
    neighborStories,
    playingSnapIndex,
    playingStorySnaps,
    setIsMutedStoriesExpanded,
    setIsPublishingStory,
    setIsStoryPaused,
    setMutedStoryUserIds,
    setMyStorySnaps,
    setNeighborStories,
    setPlayingSnapIndex,
    setPlayingStorySnaps,
    setStoryCompositionCaption,
    setStoryCompositionCustomList,
    setStoryCompositionPrivacy,
    setStoryPlaylist,
    setStoryPlaylistIndex,
    setStoryUploadData,
    setStoryViewer,
    setStoryViewerReplies,
    storyCompositionCaption,
    storyCompositionCustomList,
    storyCompositionPrivacy,
    storyPlaylist,
    storyPlaylistIndex,
    storyUploadData,
    storyViewer,
    storyViewerReplies,
  };
}

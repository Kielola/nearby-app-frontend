import type { Dispatch, SetStateAction } from 'react';
import { db, doc, updateDoc, arrayUnion } from '../../../firebase';
import { StorySnap } from '../../../types';
import { useRef } from 'react';

/**
 * Stories, notes and the story viewer
 *
 * The 24-hour story feed: one Firestore subscription per neighbour, view receipts, the playlist cursor, mute, and posting a note.
 *
 * ## Dependency interface
 *
 * 17 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseStoriesDeps {
  activeNotes: any;
  currentUser: any;
  neighbors: any;
  playingSnapIndex: any;
  setActiveNotes: Dispatch<SetStateAction<any>>;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setMutedStoryUserIds: Dispatch<SetStateAction<any>>;
  setPlayingSnapIndex: Dispatch<SetStateAction<any>>;
  setShowNoteModal: Dispatch<SetStateAction<any>>;
  setStoryPlaylist: Dispatch<SetStateAction<any>>;
  setStoryPlaylistIndex: Dispatch<SetStateAction<any>>;
  setStoryProgress: Dispatch<SetStateAction<any>>;
  setStoryViewer: Dispatch<SetStateAction<any>>;
  setUserNoteText: Dispatch<SetStateAction<any>>;
  userDisplayName: any;
  userNoteText: any;
  userUsername: any;
  myUploadedStory: any;
  triggerBeep: any;
}

export function useStories(deps: UseStoriesDeps) {
  const {
    activeNotes,
    currentUser,
    neighbors,
    playingSnapIndex,
    setActiveNotes,
    setAudioFeedback,
    setMutedStoryUserIds,
    setPlayingSnapIndex,
    setShowNoteModal,
    setStoryPlaylist,
    setStoryPlaylistIndex,
    setStoryProgress,
    setStoryViewer,
    setUserNoteText,
    userDisplayName,
    userNoteText,
    userUsername,
    myUploadedStory,
    triggerBeep,
  } = deps;

    const toggleMuteNeighborStories = (neighborId: string) => {
      setMutedStoryUserIds(prev => {
        const isMuted = prev.includes(neighborId);
        let updated: string[];
        if (isMuted) {
          updated = prev.filter(id => id !== neighborId);
          setAudioFeedback("🔊 Neighbor status unmuted!");
        } else {
          updated = [...prev, neighborId];
          setAudioFeedback("🔕 Neighbor status muted!");
        }
        setTimeout(() => setAudioFeedback(""), 2000);
        localStorage.setItem('muted_stories_uids', JSON.stringify(updated));
        return updated;
      });
      triggerBeep(450, 0.08);
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 1790-1790 ──

    const neighborStoryUnsubsRef = useRef<Record<string, () => void>>({});

  // ── moved from src/app/hooks/useNearbyController.ts lines 2191-2215 ──

    const markStoryAsViewedInFirestore = async (storyOwnerId: string, storyId: string, currentStory: StorySnap) => {
      if (!currentUser || storyOwnerId === currentUser.uid || storyOwnerId === 'me') return;
    
      const currentViewers = currentStory.viewers || [];
      const alreadyViewed = currentViewers.some(v => v.userId === currentUser.uid);
      if (alreadyViewed) return;

      try {
        const storyDocRef = doc(db, 'users', storyOwnerId, 'stories', storyId);
        const newViewer = {
          userId: currentUser.uid,
          username: userUsername || 'anonymous',
          name: userDisplayName || 'Anonymous User',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Appends this viewer to the owner's story. The Firestore rules allow a
        // non-owner to touch exactly one key on this document, and this is it.
        //
        // Story REACTIONS are deliberately not written here: persisting them
        // needs a backend endpoint, and a half-migration that looks like it
        // worked while writing nowhere is worse than not offering it at all.
        await updateDoc(storyDocRef, { viewers: arrayUnion(newViewer) });

      } catch (e) {
        console.warn("Failed to mark story as viewed in Firestore:", e);
      }
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 2227-2235 ──

    const handleStoryViewerPrev = () => {
      triggerBeep(350, 0.05);
      if (playingSnapIndex > 0) {
        setPlayingSnapIndex(idx => idx - 1);
        setStoryProgress(0);
      } else {
        setStoryViewer(null);
      }
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 2798-2882 ──

    const handleAddMyNote = () => {
      if (!userNoteText.trim()) return;
      triggerBeep(520, 0.1, 'sine');
    
      const exists = activeNotes.some(n => n.id === 'user-note-me');
      let updatedNotes;
      if (exists) {
        updatedNotes = activeNotes.map(n => {
          if (n.id === 'user-note-me') {
            return { ...n, text: userNoteText };
          }
          return n;
        });
      } else {
        updatedNotes = [
          {
            id: 'user-note-me',
            name: 'Your note',
            avatarColor: 'bg-neutral-800 border border-neutral-700',
            avatarEmoji: '🙋‍♂️',
            text: userNoteText
          },
          ...activeNotes
        ];
      }
      setActiveNotes(updatedNotes);
      setUserNoteText('');
      setShowNoteModal(false);
    };

    // -----------------------------------------
    // Playlist Player Launcher with Auto-advance Looping o!
    // -----------------------------------------
    const startStoryPlaylist = (startNeighborId?: string) => {
      const playlist: any[] = [];

      // 1. Add my active story if exists!
      if (myUploadedStory) {
        playlist.push({
          id: "user-me",
          neighborId: "me",
          name: "Your Story",
          avatarColor: "bg-neutral-800 border border-neutral-700",
          avatarEmoji: "🙋‍♂️",
          mediaUrl: myUploadedStory.mediaUrl,
          caption: myUploadedStory.caption,
          type: "image"
        });
      }

      // 2. Add neighbors' active stories o!
      neighbors.forEach(nb => {
        if (nb.activeStory && nb.activeStory.length > 0) {
          nb.activeStory.forEach(story => {
            playlist.push({
              id: story.id,
              neighborId: nb.id,
              name: nb.name,
              avatarColor: nb.avatarColor,
              avatarEmoji: nb.avatarEmoji,
              mediaUrl: story.mediaUrl,
              caption: story.caption,
              type: story.type || "image"
            });
          });
        }
      });

      if (playlist.length > 0) {
        let startIndex = 0;
        if (startNeighborId) {
          const idx = playlist.findIndex(p => p.neighborId === startNeighborId);
          if (idx !== -1) startIndex = idx;
        }
      
        setStoryPlaylist(playlist);
        setStoryPlaylistIndex(startIndex);
        const startItem = playlist[startIndex];
        const startViewerTarget = startItem.neighborId === 'me' ? 'me' : neighbors.find(n => n.id === startItem.neighborId) || null;
        setStoryViewer(startViewerTarget);
      } else {
        setAudioFeedback("No updates available.");
        setTimeout(() => setAudioFeedback(""), 2500);
      }
    };

  return {
    handleAddMyNote,
    handleStoryViewerPrev,
    markStoryAsViewedInFirestore,
    neighborStoryUnsubsRef,
    startStoryPlaylist,
    toggleMuteNeighborStories,
  };
}

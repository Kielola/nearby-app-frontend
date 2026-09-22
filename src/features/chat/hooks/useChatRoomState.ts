import type { Dispatch, SetStateAction } from 'react';
import { DirectMessage, Neighbor } from '../../../types';
import { useState } from 'react';

/**
 * Chat room interaction state
 *
 * Message selection, in-conversation search, the emoji picker and the per-neighbour list flags. All of it belongs to an open conversation, which is why it is one module rather than thirty lines scattered through the controller.
 *
 * ## Dependency interface
 *
 * 0 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseChatRoomStateDeps {

}

export function useChatRoomState(deps: UseChatRoomStateDeps) {
  const {

  } = deps;

    const [replyingToMessage, setReplyingToMessage] = useState<DirectMessage | null>(null);
    const [activeChatSearchQuery, setActiveChatSearchQuery] = useState<string>('');
    const [simulatedTypingMap, setSimulatedTypingMap] = useState<Record<string, boolean>>({});

    // Redesigned Chat States
    const [blockedNeighborIds, setBlockedNeighborIds] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('whatsapp_blocked_neighbors') || '[]');
      } catch { return []; }
    });
    const [mutedNeighborIds, setMutedNeighborIds] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('whatsapp_muted_neighbors') || '[]');
      } catch { return []; }
    });
    const [unreadNeighborIds, setUnreadNeighborIds] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('whatsapp_unread_neighbors') || '[]');
      } catch { return []; }
    });
    const [longPressedNeighborForMenu, setLongPressedNeighborForMenu] = useState<Neighbor | null>(null);
    const [emojiCategory, setEmojiCategory] = useState<string>('smileys');
    const [emojiSearchQuery, setEmojiSearchQuery] = useState<string>('');
    const [recentlyUsedEmojis, setRecentlyUsedEmojis] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('whatsapp_recent_emojis') || '["👍", "❤️", "😂", "😮", "😢", "🙏"]');
      } catch { return ["👍", "❤️", "😂", "😮", "😢", "🙏"]; }
    });
    const [selectedSkinTone, setSelectedSkinTone] = useState<string>(''); // '', '🏻', '🏼', '🏽', '🏾', '🏿'
    const [isLockVoiceRecording, setIsLockVoiceRecording] = useState<boolean>(false);
    const [voicePlaybackSpeedMap, setVoicePlaybackSpeedMap] = useState<Record<string, number>>({});
    const [activeMediaGalleryTab, setActiveMediaGalleryTab] = useState<'photos' | 'videos' | 'documents' | 'links' | 'voice'>('photos');
    const [currentSearchMatchIndex, setCurrentSearchMatchIndex] = useState<number>(-1);
    const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
    const [isMessageSelectMode, setIsMessageSelectMode] = useState<boolean>(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
    const [editingMessage, setEditingMessage] = useState<DirectMessage | null>(null);

  return {
    activeChatSearchQuery,
    activeMediaGalleryTab,
    blockedNeighborIds,
    currentSearchMatchIndex,
    editingMessage,
    emojiCategory,
    emojiSearchQuery,
    isLockVoiceRecording,
    isMessageSelectMode,
    longPressedNeighborForMenu,
    mutedNeighborIds,
    recentlyUsedEmojis,
    replyingToMessage,
    searchMatchIds,
    selectedMessageIds,
    selectedSkinTone,
    setActiveChatSearchQuery,
    setActiveMediaGalleryTab,
    setBlockedNeighborIds,
    setCurrentSearchMatchIndex,
    setEditingMessage,
    setEmojiCategory,
    setEmojiSearchQuery,
    setIsLockVoiceRecording,
    setIsMessageSelectMode,
    setLongPressedNeighborForMenu,
    setMutedNeighborIds,
    setRecentlyUsedEmojis,
    setReplyingToMessage,
    setSearchMatchIds,
    setSelectedMessageIds,
    setSelectedSkinTone,
    setSimulatedTypingMap,
    setUnreadNeighborIds,
    setVoicePlaybackSpeedMap,
    simulatedTypingMap,
    unreadNeighborIds,
    voicePlaybackSpeedMap,
  };
}

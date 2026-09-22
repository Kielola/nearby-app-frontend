import type { Dispatch, SetStateAction } from 'react';
import { auth } from '../../../firebase';
import { DirectMessage, Neighbor } from '../../../types';
import { useCallback } from 'react';

/**
 * Conversation list management
 *
 * Pin, archive, block, mute, mark unread, delete, export, edit, star and bulk operations.
 *
 * ## Dependency interface
 *
 * 20 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern —
 * if it keeps growing, split the hook instead.
 */
export interface UseChatManagementDeps {
  _setChatMessages: any;
  chatMessages: any;
  currentUser: any;
  friendIds: any;
  neighbors: any;
  saveOrUpdateMessageInFirestore: any;
  selectedMessageIds: any;
  selectedNeighbor: any;
  setActiveTab: Dispatch<SetStateAction<any>>;
  setArchivedNeighborIds: Dispatch<SetStateAction<any>>;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setBlockedNeighborIds: Dispatch<SetStateAction<any>>;
  setEditingMessage: Dispatch<SetStateAction<any>>;
  setIsMessageSelectMode: Dispatch<SetStateAction<any>>;
  setMutedNeighborIds: Dispatch<SetStateAction<any>>;
  setNeighbors: Dispatch<SetStateAction<any>>;
  setSelectedMessageIds: Dispatch<SetStateAction<any>>;
  setSelectedNeighbor: Dispatch<SetStateAction<any>>;
  setUnreadNeighborIds: Dispatch<SetStateAction<any>>;
  triggerBeep: any;
}

export function useChatManagement(deps: UseChatManagementDeps) {
  const {
    _setChatMessages,
    chatMessages,
    currentUser,
    friendIds,
    neighbors,
    saveOrUpdateMessageInFirestore,
    selectedMessageIds,
    selectedNeighbor,
    setActiveTab,
    setArchivedNeighborIds,
    setAudioFeedback,
    setBlockedNeighborIds,
    setEditingMessage,
    setIsMessageSelectMode,
    setMutedNeighborIds,
    setNeighbors,
    setSelectedMessageIds,
    setSelectedNeighbor,
    setUnreadNeighborIds,
    triggerBeep,
  } = deps;

    const sendPrivateMessageToNeighbor = useCallback(async (neighborId: string, text: string) => {
      if (!neighborId.startsWith('nb-') && !friendIds.includes(neighborId)) {
        setAudioFeedback("⚠️ You can only message friends. Add them as a friend first.");
        setTimeout(() => setAudioFeedback(""), 3500);
        return;
      }

      const msgId = `msg-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newMsg: DirectMessage = {
        id: msgId,
        senderId: 'user',
        receiverId: neighborId,
        chatThreadId: neighborId,
        timestamp: new Date().toISOString(),
        type: 'text',
        text: text,
        status: 'sending'
      };

      _setChatMessages(prev => {
        const existing = prev[neighborId] || [];
        return { ...prev, [neighborId]: [...existing, newMsg] };
      });

      try {
        await saveOrUpdateMessageInFirestore(newMsg, neighborId);
      } catch (e) {
        console.warn("Offline fallback registered or direct message stored locally.");
      }
    }, [friendIds]);

    const onOpenNeighborChat = useCallback((neighborId: string) => {
      const nb = neighbors.find(n => n.id === neighborId);
      if (nb) {
        setSelectedNeighbor(nb);
        setActiveTab('chat');
      }
    }, [neighbors]);

    // 3. Pinning control (free)
    const handleTogglePinChat = (neighborId: string) => {
      actuallyPinChat(neighborId);
    };

    const actuallyPinChat = (neighborId: string) => {
      setNeighbors(prev => prev.map(n => {
        if (n.id === neighborId) {
          const pinState = !n.pinned;
          return {
            ...n,
            pinned: pinState,
            pinTime: pinState ? Date.now() : undefined
          };
        }
        return n;
      }));
      triggerBeep(500, 0.08, 'sine');
    };

    const handleToggleArchiveChat = (neighborId: string) => {
      setArchivedNeighborIds(prev => {
        const isArchived = prev.includes(neighborId);
        if (isArchived) {
          setAudioFeedback("Chat unarchived.");
          return prev.filter(id => id !== neighborId);
        } else {
          setAudioFeedback("Chat archived.");
          return [...prev, neighborId];
        }
      });
      setTimeout(() => setAudioFeedback(""), 2200);
      triggerBeep(480, 0.08, 'sine');
    };

    // Redesigned Direct Messaging action helpers
    const handleToggleBlockNeighbor = (neighborId: string) => {
      setBlockedNeighborIds(prev => {
        const isBlocked = prev.includes(neighborId);
        let next;
        if (isBlocked) {
          next = prev.filter(id => id !== neighborId);
          setAudioFeedback("User unblocked.");
        } else {
          next = [...prev, neighborId];
          setAudioFeedback("User blocked.");
        }
        localStorage.setItem('whatsapp_blocked_neighbors', JSON.stringify(next));
        return next;
      });
      triggerBeep(380, 0.08);
    };

    const handleToggleMuteNeighbor = (neighborId: string) => {
      setMutedNeighborIds(prev => {
        const isMuted = prev.includes(neighborId);
        let next;
        if (isMuted) {
          next = prev.filter(id => id !== neighborId);
          setAudioFeedback("Notifications unmuted.");
        } else {
          next = [...prev, neighborId];
          setAudioFeedback("Notifications muted.");
        }
        localStorage.setItem('whatsapp_muted_neighbors', JSON.stringify(next));
        return next;
      });
      triggerBeep(380, 0.08);
    };

    const handleToggleUnreadNeighbor = (neighborId: string) => {
      setUnreadNeighborIds(prev => {
        const isUnread = prev.includes(neighborId);
        let next;
        if (isUnread) {
          next = prev.filter(id => id !== neighborId);
          setAudioFeedback("Marked as read.");
        } else {
          next = [...prev, neighborId];
          setAudioFeedback("Marked as unread.");
        }
        localStorage.setItem('whatsapp_unread_neighbors', JSON.stringify(next));
        return next;
      });
      triggerBeep(380, 0.08);
    };

    const handleDeleteChat = (neighborId: string) => {
      _setChatMessages(prev => {
        const copy = { ...prev };
        delete copy[neighborId];
        return copy;
      });
      setAudioFeedback("Chat conversation deleted.");
      triggerBeep(330, 0.08);
    };

    const handleExportChat = (neighbor: Neighbor) => {
      const messages = chatMessages[neighbor.id] || [];
      if (messages.length === 0) {
        setAudioFeedback("No messages to export.");
        return;
      }
      const lines = messages.map(msg => {
        const time = new Date(msg.timestamp).toLocaleString();
        const sender = msg.senderId === 'user' ? 'You' : neighbor.name;
        const text = msg.text || `[Media: ${msg.type}]`;
        return `[${time}] ${sender}: ${text}`;
      });
      const content = lines.join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat_with_${neighbor.username || neighbor.name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setAudioFeedback("Chat exported.");
      triggerBeep(450, 0.08);
    };

    const handleEditMessage = async (msgId: string, newText: string) => {
      if (!selectedNeighbor) return;
      _setChatMessages(prev => {
        const list = prev[selectedNeighbor.id] || [];
        const idx = list.findIndex(m => m.id === msgId);
        if (idx > -1) {
          const copy = [...list];
          const updated = { ...copy[idx], text: newText, isEdited: true };
          copy[idx] = updated;
          const fUser = auth.currentUser;
          if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
            saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
          }
          return { ...prev, [selectedNeighbor.id]: copy };
        }
        return prev;
      });
      setEditingMessage(null);
      setAudioFeedback("Message edited.");
      triggerBeep(420, 0.08);
    };

    const handleToggleStarMessage = (msg: DirectMessage) => {
      if (!selectedNeighbor) return;
      _setChatMessages(prev => {
        const list = prev[selectedNeighbor.id] || [];
        const idx = list.findIndex(m => m.id === msg.id);
        if (idx > -1) {
          const copy = [...list];
          const updated = { ...copy[idx], isStarred: !copy[idx].isStarred };
          copy[idx] = updated;
          const fUser = auth.currentUser;
          if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
            saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
          }
          setAudioFeedback(updated.isStarred ? "Message starred." : "Message unstarred.");
          return { ...prev, [selectedNeighbor.id]: copy };
        }
        return prev;
      });
      triggerBeep(450, 0.05);
    };

    const handleBulkDeleteMessages = () => {
      if (!selectedNeighbor || selectedMessageIds.length === 0) return;
      const currentUid = currentUser?.uid || 'user';
      _setChatMessages(prev => {
        const list = prev[selectedNeighbor.id] || [];
        const copy = list.map(msg => {
          if (selectedMessageIds.includes(msg.id)) {
            const deletedUsers = msg.deletedForUsers || [];
            const updated = { ...msg, deletedForUsers: [...deletedUsers, currentUid] };
            const fUser = auth.currentUser;
            if (fUser && !selectedNeighbor.id.startsWith('nb-')) {
              saveOrUpdateMessageInFirestore(updated, selectedNeighbor.id);
            }
            return updated;
          }
          return msg;
        });
        return { ...prev, [selectedNeighbor.id]: copy };
      });
      setSelectedMessageIds([]);
      setIsMessageSelectMode(false);
      setAudioFeedback("Messages deleted.");
      triggerBeep(330, 0.08);
    };

    const handleBulkForwardMessages = (targetNeighbor: Neighbor) => {
      if (!selectedNeighbor || selectedMessageIds.length === 0) return;
      const list = chatMessages[selectedNeighbor.id] || [];
      const messagesToForward = list.filter(msg => selectedMessageIds.includes(msg.id));
    
      messagesToForward.forEach((msg, index) => {
        setTimeout(() => {
          const msgId = `msg-forwarded-${auth.currentUser?.uid || 'anon'}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
          const forwardedMsg: DirectMessage = {
            id: msgId,
            senderId: 'user',
            receiverId: targetNeighbor.id,
            chatThreadId: targetNeighbor.id,
            timestamp: new Date().toISOString(),
            type: msg.type,
            text: msg.text,
            mediaUrl: msg.mediaUrl,
            audioDurationSec: msg.audioDurationSec,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            isForwarded: true,
            status: 'sent' as const
          };
        
          _setChatMessages(prev => ({
            ...prev,
            [targetNeighbor.id]: [...(prev[targetNeighbor.id] || []), forwardedMsg]
          }));
        
          const fUser = auth.currentUser;
          if (fUser && !targetNeighbor.id.startsWith('nb-')) {
            saveOrUpdateMessageInFirestore(forwardedMsg, targetNeighbor.id);
          }
        }, index * 200);
      });
    
      setSelectedMessageIds([]);
      setIsMessageSelectMode(false);
      setAudioFeedback(`Forwarded ${messagesToForward.length} messages to ${targetNeighbor.name}.`);
      triggerBeep(450, 0.08);
    };

  return {
    actuallyPinChat,
    handleBulkDeleteMessages,
    handleBulkForwardMessages,
    handleDeleteChat,
    handleEditMessage,
    handleExportChat,
    handleToggleArchiveChat,
    handleToggleBlockNeighbor,
    handleToggleMuteNeighbor,
    handleTogglePinChat,
    handleToggleStarMessage,
    handleToggleUnreadNeighbor,
    onOpenNeighborChat,
    sendPrivateMessageToNeighbor,
  };
}

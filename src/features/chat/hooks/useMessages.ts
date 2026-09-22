import type { Dispatch, SetStateAction } from 'react';
import { OperationType, auth, handleFirestoreError, uploadToStorage } from '../../../firebase';
import { chatApi } from '../../../lib/api';
import { DirectMessage } from '../../../types';
import { createNotification } from '../../notifications/services/createNotification';

/**
 * Message state, persistence and read receipts
 *
 * The message array and thread bookkeeping: writing to Firestore, marking read, the local failure path, the touch handler that opens a chat, and the scroll anchor.
 *
 * ## Dependency interface
 *
 * 22 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseMessagesDeps {
  /**
   * The wrapped setter over the shared message array. It is declared in
   * the controller rather than here because `useCallSignaling` and three
   * other hooks consume it too, and they run before this one.
   */
  /** Declared in the controller; see the note there. */
  setChatMessages: any;
  _setChatMessages: any;
  chatMessages: any;
  chatMessagesEndRef: any;
  currentUser: any;
  neighbors: any;
  notifications: any;
  notifiedMessageIdsRef: any;
  selectedNeighbor: any;
  selectedNeighborId: any;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setReplyingToMessage: Dispatch<SetStateAction<any>>;
  setSwipeOffsetAmount: Dispatch<SetStateAction<any>>;
  setSwipeOffsetMsgId: Dispatch<SetStateAction<any>>;
  swipeOffsetAmount: any;
  swipeOffsetMsgId: any;
  triggerBeep: any;
  userDisplayName: any;
}

export function useMessages(deps: UseMessagesDeps) {
  const {
    _setChatMessages,
    chatMessages,
    chatMessagesEndRef,
    currentUser,
    neighbors,
    notifications,
    notifiedMessageIdsRef,
    selectedNeighbor,
    selectedNeighborId,
    setAudioFeedback,
    setReplyingToMessage,
    setSwipeOffsetAmount,
    setSwipeOffsetMsgId,
    swipeOffsetAmount,
    swipeOffsetMsgId,
    triggerBeep,
    userDisplayName,
  } = deps;

  // ── moved from src/app/hooks/useNearbyController.ts lines 1112-1119 ──

    const handleMessageTouchEnd = (msg: DirectMessage) => {
      if (swipeOffsetMsgId === msg.id && swipeOffsetAmount > 45) {
        setReplyingToMessage(msg);
        triggerBeep(520, 0.05);
      }
      setSwipeOffsetMsgId(null);
      setSwipeOffsetAmount(0);
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 1397-1401 ──

    const scrollToLastMessage = (behavior: 'smooth' | 'auto' = 'smooth') => {
      if (chatMessagesEndRef.current) {
        chatMessagesEndRef.current.scrollIntoView({ behavior });
      }
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 1427-1582 ──

    const markMessageFailed = (threadId: string, msgId: string) => {
      _setChatMessages(prev => {
        const list = prev[threadId] || [];
        const idx = list.findIndex(m => m.id === msgId);
        if (idx === -1) return prev;
        const copy = [...list];
        copy[idx] = { ...copy[idx], status: 'failed' as const };
        return { ...prev, [threadId]: copy };
      });
    };

    const saveOrUpdateMessageInFirestore = async (msg: DirectMessage, threadId: string) => {
      const fUser = auth.currentUser;
      if (!fUser) {
        // Was a silent `return`: the message sat on screen looking "sent" forever
        // while nothing was ever written. Surface it instead.
        markMessageFailed(threadId, msg.id);
        setAudioFeedback("⚠️ You're signed out - message not sent.");
        setTimeout(() => setAudioFeedback(""), 4000);
        return;
      }
      const isGroupThread = threadId.startsWith('group-') || threadId.startsWith('sim-group-');

      let finalMediaUrl = msg.mediaUrl;
      if (finalMediaUrl && finalMediaUrl.startsWith('data:')) {
        try {
          let folder = 'documents';
          let fileExtension = 'bin';
          if (msg.type === 'image') {
            folder = 'chat-images';
            fileExtension = finalMediaUrl.includes('image/png') ? 'png' : finalMediaUrl.includes('image/gif') ? 'gif' : 'jpeg';
          } else if (msg.type === 'video') {
            folder = 'chat-videos';
            fileExtension = finalMediaUrl.includes('video/mp4') ? 'mp4' : 'mov';
          } else if (msg.type === 'voice') {
            folder = 'voice-notes';
            fileExtension = 'mp3';
          } else {
            folder = 'documents';
            fileExtension = 'pdf';
          }
          const storagePath = `${folder}/${fUser.uid}/${Date.now()}.${fileExtension}`;
          finalMediaUrl = await uploadToStorage(finalMediaUrl, storagePath);
        } catch (uploadErr) {
          console.warn("Storage upload failed, using original url:", uploadErr);
        }
      }

      const msgBody = {
        id: msg.id,
        senderId: msg.senderId === 'user' ? fUser.uid : (msg.senderId || fUser.uid),
        receiverId: msg.receiverId || threadId,
        chatThreadId: msg.chatThreadId || threadId,
        timestamp: msg.timestamp || new Date().toISOString(),
        type: msg.type || 'text',
        ...(msg.text ? { text: msg.text } : {}),
        ...(finalMediaUrl ? { mediaUrl: finalMediaUrl } : {}),
        ...(msg.audioDurationSec !== undefined ? { audioDurationSec: msg.audioDurationSec } : {}),
        ...(msg.fileName ? { fileName: msg.fileName } : {}),
        ...(msg.fileSize ? { fileSize: msg.fileSize } : {}),
        ...(msg.isUnread !== undefined ? { isUnread: msg.isUnread } : {}),
        ...(msg.status ? { status: msg.status } : {}),
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
        ...(msg.reactions ? { reactions: msg.reactions } : {}),
        ...(msg.deletedForEveryone !== undefined ? { deletedForEveryone: msg.deletedForEveryone } : {}),
        ...(msg.deletedForUsers ? { deletedForUsers: msg.deletedForUsers } : {}),
        ...(msg.isForwarded !== undefined ? { isForwarded: msg.isForwarded } : {})
      };

      try {
        // Messages are persisted by the backend (ChatService.sendMessage via
        // the `send_message` socket event) — that write used to be mirrored
        // here into Firestore as well, which is exactly what produced
        // one-sided delivery: two independent writers, two orderings, two
        // different thread-id conventions.
        if (isGroupThread) {
          // Group threads are not backed by the new API yet; nothing to mirror.
        } else {
          const participants = [fUser.uid, threadId].sort();
          const chatThreadId = participants.join('_');
        
          const dmBody = {
            ...msgBody,
            chatThreadId,
            participants,
            senderId: msgBody.senderId === 'user' ? fUser.uid : msgBody.senderId,
            receiverId: msgBody.receiverId === 'user' ? threadId : msgBody.receiverId,
          };

          void dmBody; // retained for the notification payload below

          // Add real-time notification.
          //
          // This helper is ALSO the update path (edits, reactions, stars, delete-for-me,
          // read receipts), so unguarded it fired a brand-new "New Message" notification
          // every single time an existing message was touched - the recipient got a fresh
          // ping for a message they'd already read, every edit. Notify exactly once, on
          // the first write of a given message id, and only when *we* are the sender
          // (the notifications rule requires senderId == auth.uid, so notifying on
          // someone else's message was a guaranteed permission-denied anyway).
          const alreadyNotified = notifiedMessageIdsRef.current.has(msg.id);
          if (
            msgBody.type !== 'call_log' &&
            !alreadyNotified &&
            dmBody.senderId === fUser.uid &&
            dmBody.receiverId !== fUser.uid &&
            !msg.reactions &&
            !msg.deletedForEveryone
          ) {
            notifiedMessageIdsRef.current.add(msg.id);
            const senderName = dmBody.senderId === fUser.uid
              ? (userDisplayName || currentUser?.displayName || 'User')
              : (neighbors.find(n => n.id === dmBody.senderId)?.name || 'A neighbor');
            const previewText = msgBody.text || 'Sent media';
            await createNotification({
              userId: dmBody.receiverId,
              senderId: dmBody.senderId,
              senderName,
              type: 'message',
              title: 'New Message',
              message: `${senderName}: ${previewText}`
            });
          }
        }
      } catch (err) {
        console.warn("Firestore message write avoided/failed (quota/offline fallback):", err);
        handleFirestoreError(err, OperationType.WRITE, 'direct_messages');
        // Show the real Firestore error text on-screen (not just a generic "check your
        // connection") so this is diagnosable without needing to open devtools - especially
        // important on mobile where the console usually isn't reachable at all.
        const errMsg = err instanceof Error ? err.message : String(err);
        markMessageFailed(threadId, msg.id);
        setAudioFeedback(`⚠️ Message failed to send: ${errMsg}`);
        setTimeout(() => setAudioFeedback(""), 6000);
      }
    };

    const markMessagesAsRead = async (neighborId: string) => {
      const fUser = auth.currentUser;
      if (!fUser || neighborId.startsWith('nb-')) return;
      const msgs = chatMessages[neighborId] || [];
      const unreadMsgs = msgs.filter(m => m.senderId !== 'user' && m.senderId !== fUser.uid && m.status !== 'read');
      if (unreadMsgs.length === 0) return;

      if (selectedNeighbor?.isGroup) return;

      try {
        // Read state is a per-conversation watermark on the backend rather
        // than a flag on each message — so this is ONE call, instead of a
        // Firestore write per unread message every time a chat is opened.
        const { conversationId } = await chatApi.startConversation(selectedNeighborId);
        await chatApi.markRead(conversationId);
      } catch (err) {
        console.warn("Error marking conversation read:", err);
      }
    };

  // ── moved from src/app/hooks/useNearbyController.ts lines 1782-1803 ──

  return {
    handleMessageTouchEnd,
    markMessageFailed,
    markMessagesAsRead,
    saveOrUpdateMessageInFirestore,
    scrollToLastMessage,
  };
}

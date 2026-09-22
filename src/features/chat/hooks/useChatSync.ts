import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { chatApi } from '../../../lib/api';
import { ChatMessage } from '../../../lib/api/types';
import { getChatSocket } from '../../../lib/socket/chatSocket';
import { DirectMessage } from '../../../types';

function toDirectMessage(m: ChatMessage, myUserId: string): DirectMessage {
  return {
    id: m.id,
    // Only set on live socket broadcasts. The sender uses it to replace its
    // optimistic bubble rather than adding a duplicate.
    clientId: m.clientId || undefined,
    senderId: m.senderId === myUserId ? 'user' : m.senderId,
    receiverId: '', // filled in by caller per-thread; the grouping key carries this
    timestamp: m.createdAt,
    type: (m.mediaType as DirectMessage['type']) || 'text',
    text: m.content || undefined,
    mediaUrl: m.mediaUrl || undefined,
    audioDurationSec: m.audioDurationSec || undefined,
    fileName: m.fileName || undefined,
    fileSize: m.fileSize || undefined,
    status: 'delivered',
  };
}

interface UseChatSyncOptions {
  myUserId: string | null;
  enabled: boolean;
  // Whichever thread the user currently has open — messages arriving for
  // this thread don't bump the unread badge (same as WhatsApp: a chat
  // that's open on screen is implicitly "read").
  activeNeighborId: string | null;
  onMessagesForThread: (neighborId: string, messages: DirectMessage[]) => void;
  onIncomingMessage: (neighborId: string, message: DirectMessage) => void;
}

// Replaces the old single Firestore query across ALL messages
// (`array-contains` on participants). Loads each conversation's history
// once via REST, then a single Socket.IO connection joins every
// conversation's "room" and receives new messages pushed in real time —
// both participants get the SAME event from the SAME source of truth,
// which is what fixes one-sided delivery for good (no per-client
// listener race to get out of sync).
export function useChatSync({ myUserId, enabled, activeNeighborId, onMessagesForThread, onIncomingMessage }: UseChatSyncOptions) {
  const [isReady, setIsReady] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  // conversationId -> neighborId, so an incoming socket event (which only
  // carries conversationId) can be routed to the right thread.
  const conversationToNeighborRef = useRef<Record<string, string>>({});
  const neighborToConversationRef = useRef<Record<string, string>>({});
  const activeNeighborIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeNeighborIdRef.current = activeNeighborId;
  }, [activeNeighborId]);

  useEffect(() => {
    if (!enabled || !myUserId) return;
    let cancelled = false;

    async function setup() {
      const conversations = await chatApi.listConversations();
      if (cancelled) return;

      const socket = await getChatSocket();
      socketRef.current = socket;

      const initialUnread: Record<string, number> = {};

      for (const convo of conversations) {
        conversationToNeighborRef.current[convo.conversation_id] = convo.other_user_id;
        neighborToConversationRef.current[convo.other_user_id] = convo.conversation_id;
        initialUnread[convo.other_user_id] = Number(convo.unread_count) || 0;

        const history = await chatApi.getMessages(convo.conversation_id);
        if (cancelled) return;
        onMessagesForThread(
          convo.other_user_id,
          history.map((m) => toDirectMessage(m, myUserId)),
        );

        socket.emit('join_conversation', { conversationId: convo.conversation_id });
      }

      setUnreadCounts(initialUnread);

      socket.on('new_message', (message: ChatMessage) => {
        const neighborId = conversationToNeighborRef.current[message.conversationId];
        if (!neighborId) return; // a conversation we haven't loaded yet — safe to ignore

        const isFromMe = message.senderId === myUserId;
        if (!isFromMe && neighborId !== activeNeighborIdRef.current) {
          setUnreadCounts((prev) => ({ ...prev, [neighborId]: (prev[neighborId] || 0) + 1 }));
        }

        onIncomingMessage(neighborId, toDirectMessage(message, myUserId));
      });

      setIsReady(true);
    }

    setup();

    return () => {
      cancelled = true;
      socketRef.current?.off('new_message');
    };
  }, [enabled, myUserId]);

  // Opening a thread marks it read, same as WhatsApp — one call to the
  // backend to move the watermark forward, and zero the local badge.
  useEffect(() => {
    if (!activeNeighborId) return;
    const conversationId = neighborToConversationRef.current[activeNeighborId];
    if (!conversationId) return;

    setUnreadCounts((prev) => (prev[activeNeighborId] ? { ...prev, [activeNeighborId]: 0 } : prev));
    chatApi.markRead(conversationId).catch((err) => console.warn('Failed to mark conversation read:', err));
  }, [activeNeighborId]);

  // Sends a message to a neighbor, starting a conversation on first
  // contact. Returns the conversationId so the caller can optimistically
  // track it.
  async function sendChatMessage(
    neighborId: string,
    data: {
      // Idempotency key from the caller. Echoed back by the server so the
      // sender can reconcile its optimistic bubble — see useNearbyController's
      // onIncomingMessage. Without it the sender renders the message twice.
      clientId?: string;
      content?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'voice' | 'document';
      audioDurationSec?: number;
      fileName?: string;
      fileSize?: string;
    },
  ) {
    let conversationId = neighborToConversationRef.current[neighborId];
    if (!conversationId) {
      const result = await chatApi.startConversation(neighborId);
      conversationId = result.conversationId;
      neighborToConversationRef.current[neighborId] = conversationId;
      conversationToNeighborRef.current[conversationId] = neighborId;
      const socket = socketRef.current ?? (await getChatSocket());
      socket.emit('join_conversation', { conversationId });
    }

    const socket = socketRef.current ?? (await getChatSocket());
    socket.emit('send_message', { conversationId, ...data });
  }

  const totalUnread = Object.values(unreadCounts).reduce((sum: number, n: number) => sum + n, 0);

  return { isReady, sendChatMessage, unreadCounts, totalUnread };
}

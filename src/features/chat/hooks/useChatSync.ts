import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Called when the server refuses a message outright, so the bubble can be
  // shown as "Not sent" instead of sitting there looking delivered.
  onMessageFailed?: (neighborId: string, clientId: string) => void;
}

/** How many times to retry the initial load before giving up until the next
 *  mount. A free-tier backend that has spun down can take ~30-60s to answer, so
 *  a few slow attempts are the difference between "chat works" and "chat never
 *  loads on the first open of the day". */
const SETUP_MAX_ATTEMPTS = 5;
const SETUP_RETRY_MS = 4000;

/**
 * Loads each conversation's history once via REST, then keeps one Socket.IO
 * connection joined to every conversation's "room" so both participants receive
 * the SAME event from the SAME source of truth. That is what fixed one-sided
 * delivery: there is no per-client listener to fall out of sync.
 *
 * ## Why rooms are re-joined on every `connect`
 *
 * Socket.IO room membership lives on the server and is **not** restored when a
 * socket reconnects — a reconnect is a brand-new connection with a new socket
 * id and no rooms. This hook's setup effect only runs when `enabled`/`myUserId`
 * change, so it never ran again after a drop.
 *
 * The result was the exact bug reported from live testing: a phone whose socket
 * had reconnected — which happens on every background/foreground, every network
 * change, and every time the free-tier backend spins down — sat there with a
 * *connected* socket that was a member of **zero rooms**. It received nothing,
 * and the other person's messages never arrived.
 *
 * Worse, it was invisible from the outside: `socket.connected` was true, so the
 * app looked healthy. And because the server broadcasts new messages to the
 * whole room *including the sender*, the sender's own echo also stopped
 * arriving — so the optimistic bubble never reconciled and stayed on a single
 * tick forever. "Only one account could send and receive" and "the messages that
 * didn't deliver had only one tick" are the same fault seen from two phones.
 *
 * `socket.on('connect')` fires on the first connection AND on every subsequent
 * reconnect, which makes it the correct place to (re)join. Joining is
 * idempotent server-side.
 */
export function useChatSync({
  myUserId,
  enabled,
  activeNeighborId,
  onMessagesForThread,
  onIncomingMessage,
  onMessageFailed,
}: UseChatSyncOptions) {
  const [isReady, setIsReady] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  // conversationId -> neighborId, so an incoming socket event (which only
  // carries conversationId) can be routed to the right thread.
  const conversationToNeighborRef = useRef<Record<string, string>>({});
  const neighborToConversationRef = useRef<Record<string, string>>({});
  const activeNeighborIdRef = useRef<string | null>(null);
  /** True once the first history load has completed. Read by the connect
   *  handler, which must not re-sync while the initial load is still running. */
  const isReadyRef = useRef(false);

  // The callbacks are recreated on every controller render. Holding them in refs
  // keeps the setup effect's dependency list at `[enabled, myUserId]` — without
  // this, listing them would tear the socket down and re-run the whole history
  // load on every render.
  const onMessagesForThreadRef = useRef(onMessagesForThread);
  const onIncomingMessageRef = useRef(onIncomingMessage);
  const onMessageFailedRef = useRef(onMessageFailed);
  useEffect(() => {
    onMessagesForThreadRef.current = onMessagesForThread;
    onIncomingMessageRef.current = onIncomingMessage;
    onMessageFailedRef.current = onMessageFailed;
  });

  useEffect(() => {
    activeNeighborIdRef.current = activeNeighborId;
  }, [activeNeighborId]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  /** Join every conversation we know about. Idempotent, so calling it on every
   *  connect (including reconnects) is cheap and always correct. */
  const joinAllRooms = useCallback((socket: Socket | null) => {
    if (!socket) return;
    for (const conversationId of Object.keys(conversationToNeighborRef.current)) {
      socket.emit('join_conversation', { conversationId });
    }
    // On the very first run there is nothing to join yet — the initial load
    // calls this again once the conversation list has arrived.
  }, []);

  useEffect(() => {
    if (!enabled || !myUserId) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    /** Re-read every conversation's history. Also used after a reconnect, so a
     *  message sent while this device was offline is picked up immediately
     *  instead of waiting for the next app launch. */
    async function syncHistories() {
      const conversations = await chatApi.listConversations();
      if (cancelled) return;

      const initialUnread: Record<string, number> = {};

      // Build the routing maps for EVERY conversation before fetching anything.
      // They must be complete before a single live event can arrive, or a
      // message for a thread we haven't reached yet is dropped by the
      // `if (!neighborId) return` guard in the listener.
      for (const convo of conversations) {
        conversationToNeighborRef.current[convo.conversation_id] = convo.other_user_id;
        neighborToConversationRef.current[convo.other_user_id] = convo.conversation_id;
        initialUnread[convo.other_user_id] = Number(convo.unread_count) || 0;
      }

      for (const convo of conversations) {
        const history = await chatApi.getMessages(convo.conversation_id);
        if (cancelled) return;
        onMessagesForThreadRef.current(
          convo.other_user_id,
          history.map((m) => toDirectMessage(m, myUserId)),
        );
      }

      // `...prev` last: a badge the user already cleared by opening the thread
      // while this was in flight must not be un-cleared by the server snapshot.
      setUnreadCounts((prev) => ({ ...initialUnread, ...prev }));
    }

    function handleConnect() {
      // Fires on the first connection and on EVERY reconnect. Re-joining here is
      // the fix described in the hook doc comment above.
      joinAllRooms(socketRef.current);
      // Re-sync so anything sent while we were offline appears without an app
      // restart. Skipped during the initial load, which is already doing it.
      if (isReadyRef.current) {
        syncHistories().catch((err) => {
          console.warn('[chat] history re-sync after reconnect failed:', err);
        });
      }
    }

    function handleConnectError(err: Error) {
      // Silence here was the other half of the invisible failure: a wrong
      // VITE_SOCKET_URL or a rejected token produced nothing at all in the
      // console, just a chat that quietly never received anything.
      console.error('[chat] socket connect_error:', err?.message || err);
    }

    function handleNewMessage(message: ChatMessage) {
      const neighborId = conversationToNeighborRef.current[message.conversationId];
      if (!neighborId) return; // a conversation we haven't loaded yet — safe to ignore

      const isFromMe = message.senderId === myUserId;
      if (!isFromMe && neighborId !== activeNeighborIdRef.current) {
        setUnreadCounts((prev) => ({ ...prev, [neighborId]: (prev[neighborId] || 0) + 1 }));
      }

      onIncomingMessageRef.current(neighborId, toDirectMessage(message, myUserId));
    }

    function handleMessageError(payload: { conversationId?: string; clientId?: string }) {
      const neighborId = payload?.conversationId
        ? conversationToNeighborRef.current[payload.conversationId]
        : undefined;
      if (!neighborId || !payload?.clientId) return;
      // The server refused the message. Without this the bubble stayed on a
      // single tick, claiming it had been sent, when nothing had been stored.
      onMessageFailedRef.current?.(neighborId, payload.clientId);
    }

    async function setup() {
      const socket = await getChatSocket();
      if (cancelled) return;
      socketRef.current = socket;

      // Listeners are attached BEFORE any await that fetches data, so a message
      // arriving mid-load is still routed.
      socket.off('connect', handleConnect);
      socket.on('connect', handleConnect);
      socket.off('new_message', handleNewMessage);
      socket.on('new_message', handleNewMessage);
      socket.off('message:error', handleMessageError);
      socket.on('message:error', handleMessageError);
      socket.off('connect_error', handleConnectError);
      socket.on('connect_error', handleConnectError);

      // If the socket is already connected when we get here (the usual case on a
      // warm app), `connect` will never fire again, so join explicitly.
      joinAllRooms(socket);

      await syncHistories();
      if (cancelled) return;

      // Join once more now that the conversation list is known.
      joinAllRooms(socket);
      setIsReady(true);
    }

    function attemptSetup() {
      attempts += 1;
      setup().catch((err) => {
        // Previously this was an unhandled rejection: if listConversations() or
        // getChatSocket() failed — a free-tier backend still waking up, or a
        // mobile network blip — the hook died silently with no listener, no
        // rooms and `isReady` false. The user saw a chat that simply never
        // received anything, with nothing in the console to explain it.
        console.error(
          `[chat] setup failed (attempt ${attempts}/${SETUP_MAX_ATTEMPTS}):`,
          err,
        );
        if (cancelled || attempts >= SETUP_MAX_ATTEMPTS) return;
        retryTimer = setTimeout(attemptSetup, SETUP_RETRY_MS);
      });
    }

    attemptSetup();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      const socket = socketRef.current;
      if (socket) {
        socket.off('new_message', handleNewMessage);
        socket.off('message:error', handleMessageError);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
      }
    };
  }, [enabled, myUserId, joinAllRooms]);

  // Opening a thread marks it read, same as WhatsApp — one call to the
  // backend to move the watermark forward, and zero the local badge.
  // `isReady` is a dependency so the thread the user is already looking at when
  // the load finishes still gets marked: the routing map is empty until then.
  useEffect(() => {
    if (!activeNeighborId) return;
    const conversationId = neighborToConversationRef.current[activeNeighborId];
    if (!conversationId) return;

    setUnreadCounts((prev) => (prev[activeNeighborId] ? { ...prev, [activeNeighborId]: 0 } : prev));
    chatApi.markRead(conversationId).catch((err) => console.warn('Failed to mark conversation read:', err));
  }, [activeNeighborId, isReady]);

  // Sends a message to a neighbor, starting a conversation on first contact.
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
    }

    const socket = socketRef.current ?? (await getChatSocket());
    socketRef.current = socket;

    // ALWAYS join before sending, not just on first contact.
    //
    // The old version only joined when the conversation was new. The sender also
    // receives its own message back through the room, so after a reconnect the
    // send path could not repair the missing membership either — the message
    // went out, the echo never came back, and the bubble sat on one tick. Joining
    // is idempotent, so doing it every time costs nothing.
    socket.emit('join_conversation', { conversationId });

    socket.emit('send_message', { conversationId, ...data });
  }

  const totalUnread = Object.values(unreadCounts).reduce((sum: number, n: number) => sum + n, 0);

  return { isReady, sendChatMessage, unreadCounts, totalUnread };
}

import { useEffect } from 'react';
import { getChatSocket } from '../../../lib/socket/chatSocket';

/**
 * Telling the other side that you are typing
 *
 * Sends typing state over the chat socket rather than writing a presence document on every keystroke — the Firestore writes this replaced were the single most expensive thing the app did while a chat was open.
 *
 * Every value this block reads is declared in `UseTypingIndicatorPublisherDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseTypingIndicatorPublisherDeps {
  currentUser: any;
  selectedNeighbor: any;
  selectedNeighborId: any;
  textInput: any;
}

export function useTypingIndicatorPublisher(deps: UseTypingIndicatorPublisherDeps) {
  const {
  
    currentUser,
    selectedNeighbor,
    selectedNeighborId,
    textInput,} = deps;

// Typing indicator over the chat socket — replaces the per-keystroke
// setDoc(presence) write the old implementation did.
useEffect(() => {
  if (!currentUser) return;
  const typingTarget =
    selectedNeighborId && !selectedNeighbor?.isGroup && textInput.trim()
      ? selectedNeighborId
      : '';

  let cancelled = false;
  const timer = window.setTimeout(async () => {
    try {
      const socket = await getChatSocket();
      socket.emit('typing', { conversationId: typingTarget, isTyping: Boolean(typingTarget) });
    } catch {
      // Not connected yet — typing is a nice-to-have, never worth an error.
    }
  }, 250);

  return () => {
    cancelled = true;
    clearTimeout(timer);
    void cancelled;
  };
}, [textInput, selectedNeighborId, selectedNeighbor?.isGroup, currentUser?.uid]);
}

export default useTypingIndicatorPublisher;

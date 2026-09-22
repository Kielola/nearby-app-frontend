import { useEffect } from 'react';

/**
 * Marking a conversation as read
 *
 * Fires when a thread is opened or grows so the sender's ticks update and the unread badge clears.
 *
 * Every value this block reads is declared in `UseChatReadReceiptsDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseChatReadReceiptsDeps {
  chatMessages: any;
  currentUser: any;
  markMessagesAsRead: any;
  selectedNeighborId: any;
}

export function useChatReadReceipts(deps: UseChatReadReceiptsDeps) {
  const {
  
    chatMessages,
    currentUser,
    markMessagesAsRead,
    selectedNeighborId,} = deps;

// Typing is now sent over the chat socket (see the effect above) rather
// than written to a Firestore presence document on every keystroke.

// -----------------------------------------
// Core WhatsApp Synced Persistence Helpers o!
// -----------------------------------------

useEffect(() => {
  if (selectedNeighborId && currentUser) {
    markMessagesAsRead(selectedNeighborId);
  }
}, [selectedNeighborId, chatMessages[selectedNeighborId]?.length, currentUser]);
}

export default useChatReadReceipts;

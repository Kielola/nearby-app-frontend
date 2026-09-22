import { useEffect } from 'react';

/**
 * Keeping the message list pinned to the newest message
 *
 * Anchors the scroll position when a conversation opens and again when a message arrives, without fighting a user who has scrolled up to read history.
 *
 * Every value this block reads is declared in `UseChatScrollAnchoringDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseChatScrollAnchoringDeps {
  chatMessages: any;
  scrollToLastMessage: any;
  selectedNeighborId: any;
  setChatLimit: any;
}

export function useChatScrollAnchoring(deps: UseChatScrollAnchoringDeps) {
  const {
  
    chatMessages,
    scrollToLastMessage,
    selectedNeighborId,
    setChatLimit,} = deps;

// Automatic Message Stream Scroll Anchoring o!
// -----------------------------------------

useEffect(() => {
  if (selectedNeighborId) {
    setChatLimit(50);
    scrollToLastMessage('auto');
    const timer = setTimeout(() => scrollToLastMessage('auto'), 150);
    return () => clearTimeout(timer);
  }
}, [selectedNeighborId]);

useEffect(() => {
  if (selectedNeighborId) {
    const msgs = chatMessages[selectedNeighborId] || [];
    if (msgs.length > 0) {
      scrollToLastMessage('smooth');
    }
  }
}, [chatMessages, selectedNeighborId]);
}

export default useChatScrollAnchoring;

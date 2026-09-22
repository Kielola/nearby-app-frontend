import { useEffect } from 'react';

/**
 * In-conversation search results
 *
 * Recomputes which messages in the open thread match the search box, and parks the cursor on the newest hit. Re-runs only when the query, the thread or the message list changes.
 *
 * Every value this block reads is declared in `UseChatSearchMatchesDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseChatSearchMatchesDeps {
  activeChatSearchQuery: any;
  chatMessages: any;
  currentUser: any;
  selectedNeighborId: any;
  setCurrentSearchMatchIndex: any;
  setSearchMatchIds: any;
}

export function useChatSearchMatches(deps: UseChatSearchMatchesDeps) {
  const {
  
    activeChatSearchQuery,
    chatMessages,
    currentUser,
    selectedNeighborId,
    setCurrentSearchMatchIndex,
    setSearchMatchIds,} = deps;

useEffect(() => {
  if (!selectedNeighborId || !activeChatSearchQuery.trim()) {
    setSearchMatchIds([]);
    setCurrentSearchMatchIndex(-1);
    return;
  }
  const currentUid = currentUser?.uid || 'user';
  const list = chatMessages[selectedNeighborId] || [];
  const query = activeChatSearchQuery.toLowerCase();
  const matches = list
    .filter(m => {
      if (m.deletedForUsers?.includes(currentUid)) return false;
      if (m.deletedForEveryone) return false;
      return m.text && m.text.toLowerCase().includes(query);
    })
    .map(m => m.id);

  setSearchMatchIds(matches);
  setCurrentSearchMatchIndex(matches.length > 0 ? matches.length - 1 : -1);
}, [activeChatSearchQuery, selectedNeighborId, chatMessages, currentUser]);
}

export default useChatSearchMatches;

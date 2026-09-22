import { useEffect } from 'react';

/**
 * Expiring the user's own status story
 *
 * Clears a status update 24 hours after it was posted and tells the user it has gone. The check runs on a timer, so a tab left open overnight still expires it.
 *
 * Every value this block reads is declared in `UseStoryExpiryDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseStoryExpiryDeps {
  currentUser: any;
  myUploadedStory: any;
  setAudioFeedback: any;
  setMyUploadedStory: any;
}

export function useStoryExpiry(deps: UseStoryExpiryDeps) {
  const {
  
    currentUser,
    myUploadedStory,
    setAudioFeedback,
    setMyUploadedStory,} = deps;

// -----------------------------------------
// Real-time Status Story Expiration Check (24-Hour lifetime o!)
// -----------------------------------------
useEffect(() => {
  const checkExpiration = async () => {
    if (!myUploadedStory || !currentUser) return;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const createdTime = myUploadedStory.createdAt || Date.now();
    
    if (Date.now() - createdTime > oneDayMs) {
      setMyUploadedStory(null);
      setAudioFeedback("⏰ Your status update has expired after 24 hours.");
      setTimeout(() => setAudioFeedback(""), 3000);
      setMyUploadedStory(null);
      // No client-side deletion: highlight expiry is the server's job, so
      // two devices can't disagree about whether a status is still live.
    }
  };

  checkExpiration();
  const interval = setInterval(checkExpiration, 30000); // 30 seconds interval

  return () => clearInterval(interval);
}, [myUploadedStory, currentUser]);
}

export default useStoryExpiry;

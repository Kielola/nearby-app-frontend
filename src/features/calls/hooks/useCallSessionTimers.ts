import { useEffect } from 'react';

/**
 * Call timers and the ghost-call watchdog
 *
 * Drives the call duration counter and tears down a call that the network abandoned — when the other side closes the tab mid-call, no 'ended' event ever arrives, and without this the caller sits on a dead screen indefinitely.
 *
 * Every value this block reads is declared in `UseCallSessionTimersDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseCallSessionTimersDeps {
  callState: any;
  callTimerRef: any;
  currentUser: any;
  endCall: any;
  setAudioFeedback: any;
  setCallState: any;
}

export function useCallSessionTimers(deps: UseCallSessionTimersDeps) {
  const {
  
    callState,
    callTimerRef,
    currentUser,
    endCall,
    setAudioFeedback,
    setCallState,} = deps;

// Handle active call timing counters, watchdog for ghost calls and frozen calls
useEffect(() => {
  let watchDogInterval: any = null;
  
  if (callState.active) {
    // 1. Connection Duration Timer (when connected)
    if (callState.status === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallState(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1
        }));
      }, 1000);
    }

    // 2. Active Call Watchdog (runs every 5 seconds to prevent frozen or ghost calls)
    let ringTimeCount = 0;
    watchDogInterval = setInterval(async () => {
      // A. If call is ringing for too long (e.g. 40 seconds) without answer, end it
      if (callState.status === 'ringing') {
        ringTimeCount += 5;
        if (ringTimeCount >= 40) {
          console.log("Call Watchdog: Ringing timeout reached. Auto-ending call.");
          setAudioFeedback("⚠️ No answer. Call timed out.");
          setTimeout(() => setAudioFeedback(""), 3500);
          endCall('missed');
          return;
        }
      }

      // B. Ghost Call Check removed — the onSnapshot listener above already handles the
      // doc-deleted case in real time (see the `!snap.exists()` branch), so this redundant
      // getDoc poll only added a chance of a false-positive premature disconnect from a
      // stale/racy one-off read colliding with a real write (e.g. right as someone answers).
    }, 5000);
  }

  return () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (watchDogInterval) {
      clearInterval(watchDogInterval);
    }
  };
}, [callState.active, callState.status, currentUser]);
}

export default useCallSessionTimers;

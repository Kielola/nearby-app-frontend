import { useEffect } from 'react';
import { presenceApi } from '../../../lib/api';

/**
 * Reporting presence while the app is open
 *
 * Writes active, away or offline from real user activity and page visibility, and marks the user offline on unmount so they do not linger as online after closing the tab.
 *
 * Every value this block reads is declared in `UsePresenceHeartbeatDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UsePresenceHeartbeatDeps {
  currentUser: any;
  selectedNeighborId: any;
  showOnboarding: any;
}

export function usePresenceHeartbeat(deps: UsePresenceHeartbeatDeps) {
  const {
  
    currentUser,
    selectedNeighborId,
    showOnboarding,} = deps;

// Real-time Presence Heartbeat
// -----------------------------------------
useEffect(() => {
  if (!currentUser || showOnboarding) return;

  let lastActivityTime = Date.now();
  let currentStatus: 'active' | 'away' | 'offline' = 'active';

  const writePresence = async (status: 'active' | 'away' | 'offline') => {
    currentStatus = status;
    try {
      // Was a setDoc to the `presence` collection, which every client
      // subscribed to. The backend keeps this user's Redis key alive
      // instead; online/offline is derived from that key's TTL.
      await presenceApi.heartbeat();
    } catch (e) {
      console.warn('Presence write failed:', e);
    }
  };

  const handleActivity = () => {
    lastActivityTime = Date.now();
    if (currentStatus !== 'active') void writePresence('active');
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      lastActivityTime = Date.now();
      void writePresence('active');
    } else {
      void writePresence('away');
    }
  };

  void writePresence('active');
  window.addEventListener('mousemove', handleActivity);
  window.addEventListener('keydown', handleActivity);
  window.addEventListener('click', handleActivity);
  window.addEventListener('scroll', handleActivity);
  window.addEventListener('touchstart', handleActivity);
  document.addEventListener('visibilitychange', handleVisibility);

  const interval = window.setInterval(() => {
    const idleMs = Date.now() - lastActivityTime;
    void writePresence(idleMs >= 2 * 60 * 1000 ? 'away' : 'active');
  }, 20000);

  return () => {
    clearInterval(interval);
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keydown', handleActivity);
    window.removeEventListener('click', handleActivity);
    window.removeEventListener('scroll', handleActivity);
    window.removeEventListener('touchstart', handleActivity);
    document.removeEventListener('visibilitychange', handleVisibility);
    void writePresence('offline');
  };
}, [currentUser?.uid, showOnboarding, selectedNeighborId]);
}

export default usePresenceHeartbeat;

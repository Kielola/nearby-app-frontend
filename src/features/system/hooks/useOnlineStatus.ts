import { useEffect } from 'react';

/**
 * Browser connectivity
 *
 * Tracks navigator.onLine so the UI can distinguish 'no connection' from 'no results nearby' — two states that used to look identical to a user on a flaky mobile network.
 *
 * Every value this block reads is declared in `UseOnlineStatusDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseOnlineStatusDeps {
  setIsOnline: any;
  triggerBeep: any;
}

export function useOnlineStatus(deps: UseOnlineStatusDeps) {
  const {
  
    setIsOnline,
    triggerBeep,} = deps;

useEffect(() => {
  const handleOnline = () => {
    setIsOnline(true);
    triggerBeep(600, 0.1);
  };
  const handleOffline = () => {
    setIsOnline(false);
    triggerBeep(300, 0.15);
  };
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);
}

export default useOnlineStatus;

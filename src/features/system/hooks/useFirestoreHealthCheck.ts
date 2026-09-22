import { useEffect } from 'react';

/**
 * Surfacing a Firestore failure to the user
 *
 * Listens for the global error events Firebase raises when a project runs out of quota or loses billing, so the app can explain what happened instead of silently showing empty lists.
 *
 * Every value this block reads is declared in `UseFirestoreHealthCheckDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseFirestoreHealthCheckDeps {
  setFirestoreQuotaExceeded: any;
}

export function useFirestoreHealthCheck(deps: UseFirestoreHealthCheckDeps) {
  const {
  
    setFirestoreQuotaExceeded,} = deps;

useEffect(() => {
  const handleFirestoreErr = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent?.detail) {
      if (customEvent.detail.isQuota) {
        console.warn("Firestore Quota Exceeded. Fallback operating o!");
        setFirestoreQuotaExceeded(true);
      }
    }
  };
  window.addEventListener('firestore-error-event', handleFirestoreErr);
  return () => window.removeEventListener('firestore-error-event', handleFirestoreErr);
}, []);
}

export default useFirestoreHealthCheck;

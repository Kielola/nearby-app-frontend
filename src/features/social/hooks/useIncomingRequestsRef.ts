import { useEffect } from 'react';

/**
 * A ref mirror of the incoming friend requests
 *
 * The friend-request badges are read from callbacks that must not re-create on every poll, so the latest value is mirrored into a ref instead of being closed over.
 *
 * Every value this block reads is declared in `UseIncomingRequestsRefDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseIncomingRequestsRefDeps {
  incomingRequestsByUserId: any;
  incomingRequestsByUserIdRef: any;
}

export function useIncomingRequestsRef(deps: UseIncomingRequestsRefDeps) {
  const {
  
    incomingRequestsByUserId,
    incomingRequestsByUserIdRef,} = deps;

useEffect(() => {
  incomingRequestsByUserIdRef.current = incomingRequestsByUserId;
}, [incomingRequestsByUserId]);
}

export default useIncomingRequestsRef;

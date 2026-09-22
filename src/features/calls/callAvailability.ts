/**
 * Voice/video calling master switch.
 *
 * WHY THIS FILE EXISTS
 *
 * Calling is being taken out of the user-facing product for now and shown as
 * "coming soon" instead. The app had a real signalling path (Socket.IO on the
 * `/calls` namespace) plus a real WebRTC handshake, and it was still failing on
 * live devices for reasons that were never reproducible from the logs available.
 * Debugging it in production costs real testers real trust, so the honest
 * position is to stop promising something that does not reliably work, ship
 * everything else, and switch calling on when it has been proven end to end.
 *
 * HOW TO TURN CALLS BACK ON
 *
 * Flip CALLS_ENABLED to `true`. That is the entire change. The WebRTC code, the
 * signalling hook, the TURN configuration and the call UI are all untouched and
 * still wired up — nothing was deleted, so there is no rebuild to do.
 *
 * The gate lives at the choke points in `useCallSignaling` (outgoing invite,
 * incoming invite, simulated invite) rather than on the individual buttons,
 * because four different components render call buttons and a per-button check
 * would need editing again the moment a fifth is added.
 */

/**
 * `false` = every call action shows the "coming soon" notice and no media is
 * ever requested, no socket event is emitted, and no call screen appears.
 */
export const CALLS_ENABLED = false;

export const CALL_COMING_SOON_TITLE = 'Voice & video calls are coming soon';

export const CALL_COMING_SOON_BODY =
  'We are putting the finishing touches on secure, end-to-end calling. ' +
  'Keep chatting, posting and meeting up in the meantime — calling switches ' +
  'on for everyone the moment it is ready.';

type CallKind = 'audio' | 'video';
type Listener = (kind: CallKind) => void;

const listeners = new Set<Listener>();

/**
 * Ask the UI to show the "coming soon" notice.
 *
 * Deliberately a plain module-level event rather than React state threaded
 * through the controller: the call buttons live in the chat components, the
 * modal is rendered once at the composition root, and routing a signal between
 * them through `useNearbyController`'s ~2,400 lines and its ~200-key return
 * object would be far more risk than the feature is worth.
 */
export function showCallComingSoon(kind: CallKind): void {
  listeners.forEach((listener) => {
    try {
      listener(kind);
    } catch (err) {
      // A listener throwing must never take down the click that triggered it.
      console.error('[calls] coming-soon listener failed:', err);
    }
  });
}

/** Subscribe to the notice. Returns the unsubscribe function. */
export function subscribeToCallComingSoon(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

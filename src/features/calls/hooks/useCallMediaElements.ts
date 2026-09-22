import { useEffect } from 'react';

/**
 * Rendering the call's media streams
 *
 * Binds the local and remote MediaStreams to their video elements and applies the speaker-preview volume. These run on stream/call transitions, not on a render loop.
 *
 * Every value this block reads is declared in `UseCallMediaElementsDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseCallMediaElementsDeps {
  callState: any;
  isSpeakerOn: any;
  localStream: any;
  localVideoRef: any;
  remoteStream: any;
  remoteVideoRef: any;
  videoOff: any;
}

export function useCallMediaElements(deps: UseCallMediaElementsDeps) {
  const {
    callState,
    isSpeakerOn,
    localStream,
    localVideoRef,
    remoteStream,
    remoteVideoRef,
    videoOff,
  } = deps;

// -----------------------------------------
// WebRTC Media Stream Rendering & Speaker volume adjustments
// -----------------------------------------
useEffect(() => {
  if (localVideoRef.current && localStream) {
    localVideoRef.current.srcObject = localStream;
  }
}, [localStream, callState.status, callState.active, videoOff]);

useEffect(() => {
  if (remoteVideoRef.current && remoteStream) {
    remoteVideoRef.current.srcObject = remoteStream;
  }
}, [remoteStream, callState.status, callState.active]);

useEffect(() => {
  if (remoteVideoRef.current) {
    remoteVideoRef.current.volume = isSpeakerOn ? 1.0 : 0.2;
  }
}, [isSpeakerOn, remoteStream]);
}

export default useCallMediaElements;

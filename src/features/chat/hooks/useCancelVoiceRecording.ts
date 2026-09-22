/**
 * Discarding a voice note
 *
 * Releases the microphone and resets the timer without uploading anything.
 *
 * Every value this block reads is declared in `UseCancelVoiceRecordingDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseCancelVoiceRecordingDeps {
  mediaRecorderRef: any;
  setIsRecordingVoice: any;
  setVoiceDuration: any;
  setVoiceRecordingLocked: any;
  triggerBeep: any;
  voiceRecorderTimerRef: any;
}

export function useCancelVoiceRecording(deps: UseCancelVoiceRecordingDeps) {
  const {
  
    mediaRecorderRef,
    setIsRecordingVoice,
    setVoiceDuration,
    setVoiceRecordingLocked,
    triggerBeep,
    voiceRecorderTimerRef,} = deps;

const cancelRecordingVoice = () => {
  if (voiceRecorderTimerRef.current) {
    clearInterval(voiceRecorderTimerRef.current);
  }
  setIsRecordingVoice(false);
  setVoiceRecordingLocked(false);
  setVoiceDuration(0);
  const mediaRecorder = mediaRecorderRef.current;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => {
      try {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (_) {}
    };
    mediaRecorder.stop();
  }
  triggerBeep(250, 0.2, 'triangle');
};

  return { cancelRecordingVoice };
}

export default useCancelVoiceRecording;

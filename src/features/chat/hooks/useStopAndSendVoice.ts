/**
 * Sending a voice note
 *
 * Stops the recorder, assembles the clip and uploads it, with the timer torn down first so a failed upload cannot leave an interval running.
 *
 * Every value this block reads is declared in `UseStopAndSendVoiceDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseStopAndSendVoiceDeps {
  audioChunksRef: any;
  mediaRecorderRef: any;
  sendMessage: any;
  setIsRecordingVoice: any;
  setVoiceDuration: any;
  triggerBeep: any;
  voiceDuration: any;
  voiceRecorderTimerRef: any;
}

export function useStopAndSendVoice(deps: UseStopAndSendVoiceDeps) {
  const {
  
    audioChunksRef,
    mediaRecorderRef,
    sendMessage,
    setIsRecordingVoice,
    setVoiceDuration,
    triggerBeep,
    voiceDuration,
    voiceRecorderTimerRef,} = deps;

const stopAndSendVoice = () => {
  if (voiceRecorderTimerRef.current) {
    clearInterval(voiceRecorderTimerRef.current);
  }
  setIsRecordingVoice(false);
  
  const duration = voiceDuration;
  setVoiceDuration(0);

  const mediaRecorder = mediaRecorderRef.current;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        if (duration >= 1) {
          sendMessage(undefined, base64Audio, duration, 'voice');
        } else {
          triggerBeep(250, 0.2, 'triangle');
        }
      };
      reader.readAsDataURL(audioBlob);
      
      try {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (_) {}
    };
    mediaRecorder.stop();
  } else {
    triggerBeep(250, 0.2, 'triangle');
  }
};

  return { stopAndSendVoice };
}

export default useStopAndSendVoice;

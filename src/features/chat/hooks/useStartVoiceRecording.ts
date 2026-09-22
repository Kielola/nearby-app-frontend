/**
 * Starting a voice note
 *
 * Requests the microphone at the moment the user holds the button — a gesture-driven call, which is the only kind iOS Safari will honour for this permission.
 *
 * Every value this block reads is declared in `UseStartVoiceRecordingDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseStartVoiceRecordingDeps {
  audioChunksRef: any;
  mediaRecorderRef: any;
  setIsRecordingVoice: any;
  setVoiceDuration: any;
  triggerBeep: any;
  voiceRecorderTimerRef: any;
}

export function useStartVoiceRecording(deps: UseStartVoiceRecordingDeps) {
  const {
  
    audioChunksRef,
    mediaRecorderRef,
    setIsRecordingVoice,
    setVoiceDuration,
    triggerBeep,
    voiceRecorderTimerRef,} = deps;

// -----------------------------------------
// Real voice recording parameters (Microphone Stream)
// -----------------------------------------
const startRecordingVoice = async () => {
  setIsRecordingVoice(true);
  setVoiceDuration(0);
  triggerBeep(440, 0.1, 'sine');
  
  voiceRecorderTimerRef.current = setInterval(() => {
    setVoiceDuration(prev => prev + 1);
  }, 1000);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    mediaRecorder.start();
  } catch (err) {
    console.warn("Failed recording mic session o:", err);
  }
};

  return { startRecordingVoice };
}

export default useStartVoiceRecording;

import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Neighbor } from '../../../types';

/**
 * Camera capture and voice-note recording
 *
 * Opens the device camera, applies the canvas filter pass, and records voice notes.
 *
 * ## Dependency interface
 *
 * 22 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern —
 * if it keeps growing, split the hook instead.
 */
export interface UseCameraAndVoiceDeps {
  activeFilter: any;
  audioChunksRef: any;
  brushColor: any;
  canvasDrawing: any;
  canvasRef: any;
  capturedImage: any;
  isDrawing: any;
  mediaRecorderRef: any;
  photoCaption: any;
  setAudioFeedback: Dispatch<SetStateAction<any>>;
  setCameraActive: Dispatch<SetStateAction<any>>;
  setCanvasDrawing: Dispatch<SetStateAction<any>>;
  setCapturedImage: Dispatch<SetStateAction<any>>;
  setIsDrawing: Dispatch<SetStateAction<any>>;
  setIsRecordingVoice: Dispatch<SetStateAction<any>>;
  setStoryUploadData: Dispatch<SetStateAction<any>>;
  setVoiceDuration: Dispatch<SetStateAction<any>>;
  setVoiceRecordingLocked: Dispatch<SetStateAction<any>>;
  triggerBeep: any;
  videoRef: any;
  voiceDuration: any;
  /**
   * From `useChatActions`. A captured snap or voice note is sent straight into
   * the conversation, so this domain does not own its own send path.
   */
  sendMessage: any;
  voiceRecorderTimerRef: any;
}

export function useCameraAndVoice(deps: UseCameraAndVoiceDeps) {
  const {
    activeFilter,
    audioChunksRef,
    brushColor,
    canvasDrawing,
    canvasRef,
    capturedImage,
    isDrawing,
    mediaRecorderRef,
    photoCaption,
    setAudioFeedback,
    setCameraActive,
    setCanvasDrawing,
    setCapturedImage,
    setIsDrawing,
    setIsRecordingVoice,
    setStoryUploadData,
    setVoiceDuration,
    setVoiceRecordingLocked,
    triggerBeep,
    videoRef,
    voiceDuration,
    voiceRecorderTimerRef,
    /**
     * From `useChatActions`. A captured snap or voice note is sent straight into
     * the conversation, so this domain does not own its own send path.
     */
    sendMessage,
  } = deps;

    const startCamera = async () => {
      setCapturedImage(null);
      setCanvasDrawing(null);
      setCameraActive(true);
      triggerBeep(600, 0.12, 'triangle');
    
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch {
        setAudioFeedback("Using simulated camera sensor.");
        setTimeout(() => setAudioFeedback(""), 3000);
      }
    };

    const capturePhoto = () => {
      triggerBeep(700, 0.15, 'sine');
    
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
    
      if (ctx) {
        if (videoRef.current && videoRef.current.srcObject) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        } else {
          // Draw elegant placeholder with background and custom filters
          ctx.fillStyle = activeFilter === 'golden' ? '#d97706' : activeFilter === 'spicy' ? '#b91c1c' : '#1e1b4b';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText("📸 Nearby Snap Capture", 320, 200);
          ctx.font = '16px Inter, sans-serif';
          ctx.fillText(`Filter applied: ${activeFilter.toUpperCase()}`, 320, 240);
          ctx.fillText("Ready to doodle & send!", 320, 270);
        }
      
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      
        // Stop webcam trail
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };

    // Close camera block
    const closeCamera = () => {
      setCameraActive(false);
      setCapturedImage(null);
      setCanvasDrawing(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };

    // Doodle Drawing Support on Captured Image
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
    
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      setIsDrawing(true);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
    
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
    
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleCanvasMouseUp = () => {
      setIsDrawing(false);
      if (canvasRef.current) {
        setCanvasDrawing(canvasRef.current.toDataURL('image/png'));
      }
    };

    // Upload taken picture to your public story (Snapshot style!)
    const postToMyStory = () => {
      if (!capturedImage) return;
      const finalSrc = canvasDrawing || capturedImage;
      setStoryUploadData({
        mediaUrl: finalSrc,
        type: 'image'
      });
      closeCamera();
    };

    const sendCapturedSnapDirectly = (neighbor: Neighbor) => {
      if (!capturedImage) return;
      const finalSrc = canvasDrawing || capturedImage;
    
      // Add direct message with caption
      const textDesc = photoCaption ? `[Snap]: ${photoCaption}` : "[Sent a Snap 📸]";
      sendMessage(textDesc, finalSrc);
    
      setAudioFeedback(`Snap sent to ${neighbor.name}!`);
      setTimeout(() => setAudioFeedback(""), 3000);
      closeCamera();
    };

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

  return {
    cancelRecordingVoice,
    capturePhoto,
    closeCamera,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    postToMyStory,
    sendCapturedSnapDirectly,
    startCamera,
    startRecordingVoice,
    stopAndSendVoice,
  };
}

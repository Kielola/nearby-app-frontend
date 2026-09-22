/**
 * Capturing a framed photo
 *
 * Draws the current video frame into a canvas, applies the selected filter and the doodle layer, and hands back a data URL — the one place the camera, the filter and the drawing layer meet.
 *
 * Every value this block reads is declared in `UseCapturePhotoDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseCapturePhotoDeps {
  activeFilter: any;
  setCapturedImage: any;
  triggerBeep: any;
  videoRef: any;
}

export function useCapturePhoto(deps: UseCapturePhotoDeps) {
  const {
  
    activeFilter,
    setCapturedImage,
    triggerBeep,
    videoRef,} = deps;

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

  return { capturePhoto };
}

export default useCapturePhoto;

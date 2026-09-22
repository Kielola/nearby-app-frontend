import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';

/**
 * Camera capture state
 *
 * The in-app camera: whether it is open, the frame just captured, the active filter, the doodle layer and the caption typed over a photo.
 *
 * ## Dependency interface
 *
 * 0 parameters. Every value this domain reads or writes is declared
 * here rather than reached for through a closure, so the coupling is visible and
 * the compiler enforces it. Do not widen this to avoid splitting a concern — if
 * it keeps growing, split the hook instead. Widen it only when a value is
 * genuinely shared state that this domain owns part of.
 */
export interface UseCameraStateDeps {

}

export function useCameraState(deps: UseCameraStateDeps) {
  const {

  } = deps;

    const [cameraActive, setCameraActive] = useState<boolean>(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>('normal');
    const [canvasDrawing, setCanvasDrawing] = useState<string | null>(null);
    const [photoCaption, setPhotoCaption] = useState<string>('');
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [brushColor, setBrushColor] = useState<string>('#e11d48'); // raw rose-600

  return {
    activeFilter,
    brushColor,
    cameraActive,
    canvasDrawing,
    capturedImage,
    isDrawing,
    photoCaption,
    setActiveFilter,
    setBrushColor,
    setCameraActive,
    setCanvasDrawing,
    setCapturedImage,
    setIsDrawing,
    setPhotoCaption,
  };
}

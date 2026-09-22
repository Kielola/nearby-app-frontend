import type * as React from 'react';

/**
 * Drawing on a captured photo
 *
 * Pointer handling for the doodle layer: start a stroke, extend it, finish it. Kept out of the controller because it is the only part of the photo flow that cares about cursor coordinates and brush colour.
 *
 * Every value this block reads is declared in `UseDoodleCanvasDeps`
 * rather than reached for through a closure, so the coupling is visible
 * and the compiler enforces it.
 */
export interface UseDoodleCanvasDeps {
  brushColor: any;
  canvasRef: any;
  isDrawing: any;
  setCanvasDrawing: any;
  setIsDrawing: any;
}

export function useDoodleCanvas(deps: UseDoodleCanvasDeps) {
  const {
  
    brushColor,
    canvasRef,
    isDrawing,
    setCanvasDrawing,
    setIsDrawing,
  } = deps;

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

  return { handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp };
}

export default useDoodleCanvas;

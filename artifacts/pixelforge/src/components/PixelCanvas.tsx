import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { pixelEngine } from '../lib/pixelEngine';
import { humanizer } from '../lib/humanizer';

interface PixelCanvasProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ editor }) => {
  const { 
    project, activeFrameId, activeLayerId, 
    currentTool, fgColor, bgColor, zoom, setZoom, showGrid, onionSkin,
    updateLayerData, saveHistory, setFgColor
  } = editor;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeFrame = project.frames.find(f => f.id === activeFrameId) || project.frames[0];
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{x: number, y: number} | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{x: number, y: number}[]>([]);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

  // Helper to load ImageData from dataUrl
  const loadLayerData = async (dataUrl: string, ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!dataUrl) {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.src = dataUrl;
    });
  };

  // Render everything to main canvas
  useEffect(() => {
    const render = async () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const { width, height } = project;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      ctx.clearRect(0, 0, width, height);

      // Onion skin
      if (onionSkin) {
        const frameIndex = project.frames.findIndex(f => f.id === activeFrameId);
        if (frameIndex > 0) {
          const prevFrame = project.frames[frameIndex - 1];
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = width;
          tempCanvas.height = height;
          const tCtx = tempCanvas.getContext('2d')!;
          
          for (const layer of [...prevFrame.layers].reverse()) {
            if (!layer.visible) continue;
            tCtx.globalAlpha = layer.opacity;
            await loadLayerData(layer.data, tCtx, width, height);
            ctx.globalAlpha = 0.3;
            ctx.drawImage(tempCanvas, 0, 0);
          }
          ctx.globalAlpha = 1.0;
        }
      }

      // Draw layers
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d')!;

      for (const layer of [...activeFrame.layers].reverse()) {
        if (!layer.visible) continue;
        await loadLayerData(layer.data, tCtx, width, height);
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(tempCanvas, 0, 0);
      }
      ctx.globalAlpha = 1.0;

      // Draw preview for line/rect/ellipse
      if (previewPoints.length > 0) {
        ctx.fillStyle = fgColor;
        previewPoints.forEach(p => {
          ctx.fillRect(p.x, p.y, 1, 1);
        });
      }
    };
    render();
  }, [project, activeFrameId, previewPoints, onionSkin, fgColor]);

  // Convert mouse/touch event to canvas coordinates
  const getEventPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Adjust for pan and zoom based on the CSS transform applied to the canvas container
    // Since we apply transform: scale() and translate() on a wrapper, getBoundingClientRect() handles it!
    const x = Math.floor((clientX - rect.left) / (rect.width / project.width));
    const y = Math.floor((clientY - rect.top) / (rect.height / project.height));

    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return null;
    return { x, y };
  };

  const commitDrawing = async (points: {x: number, y: number}[], color: string) => {
    if (!activeLayer || activeLayer.locked || !activeLayer.visible || points.length === 0) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = project.width;
    tempCanvas.height = project.height;
    const ctx = tempCanvas.getContext('2d')!;
    
    await loadLayerData(activeLayer.data, ctx, project.width, project.height);
    
    ctx.fillStyle = color;
    if (color === 'erase') {
      points.forEach(p => ctx.clearRect(p.x, p.y, 1, 1));
    } else {
      points.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
    }

    updateLayerData(activeFrame.id, activeLayer.id, tempCanvas.toDataURL());
  };

  const handlePointerDown = async (e: React.MouseEvent | React.TouchEvent) => {
    // Pan mode (Spacebar + Click or Middle Click)
    if ((e as React.MouseEvent).button === 1 || ((e as any).nativeEvent instanceof MouseEvent && (e as any).nativeEvent.button === 1)) {
      setIsPanning(true);
      return;
    }

    const pos = getEventPos(e);
    if (!pos) return;
    
    if (currentTool === 'eyedropper') {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      if (pixel[3] > 0) {
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('');
        setFgColor(hex);
      }
      return;
    }

    if (currentTool === 'fill') {
      if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;
      saveHistory();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = project.width;
      tempCanvas.height = project.height;
      const ctx = tempCanvas.getContext('2d')!;
      await loadLayerData(activeLayer.data, ctx, project.width, project.height);
      
      const points = pixelEngine.floodFill(ctx, pos.x, pos.y, fgColor);
      if (points.length > 0) {
        commitDrawing(points, fgColor);
      }
      return;
    }

    saveHistory();
    setIsDrawing(true);
    setStartPos(pos);
    setLastPos(pos);

    if (currentTool === 'pencil') {
      commitDrawing([pos], fgColor);
    } else if (currentTool === 'eraser') {
      commitDrawing([pos], 'erase');
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) {
      const movementX = 'movementX' in e ? e.movementX : 0;
      const movementY = 'movementY' in e ? e.movementY : 0;
      if (movementX !== 0 || movementY !== 0) {
        setPan(p => ({ x: p.x + movementX, y: p.y + movementY }));
      }
      return;
    }

    if (!isDrawing || !startPos) return;
    const pos = getEventPos(e);
    if (!pos) return;

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      if (lastPos && (lastPos.x !== pos.x || lastPos.y !== pos.y)) {
        const points = pixelEngine.drawLine(lastPos.x, lastPos.y, pos.x, pos.y);
        commitDrawing(points, currentTool === 'pencil' ? fgColor : 'erase');
        setLastPos(pos);
      }
    } else if (currentTool === 'line') {
      setPreviewPoints(pixelEngine.drawLine(startPos.x, startPos.y, pos.x, pos.y));
    } else if (currentTool === 'rect') {
      setPreviewPoints(pixelEngine.drawRect(startPos.x, startPos.y, pos.x, pos.y, false)); // outline only for now
    } else if (currentTool === 'ellipse') {
      setPreviewPoints(pixelEngine.drawEllipse(startPos.x, startPos.y, pos.x, pos.y, false));
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (isDrawing && previewPoints.length > 0) {
      commitDrawing(previewPoints, fgColor);
      setPreviewPoints([]);
    }
    
    setIsDrawing(false);
    setStartPos(null);
    setLastPos(null);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(1, Math.min(32, z * zoomFactor)));
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 w-full h-full overflow-hidden bg-[#0d0d12] flex items-center justify-center relative select-none touch-none"
      onWheel={handleWheel}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
    >
      <div 
        className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        style={{
          width: project.width,
          height: project.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          imageRendering: 'pixelated',
          cursor: isPanning ? 'grab' : currentTool === 'eyedropper' ? 'crosshair' : 'crosshair'
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
      >
        {/* Checkerboard background */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)`,
            backgroundSize: '2px 2px',
          }}
        />
        
        {/* Main Canvas */}
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 z-10 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Grid Overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '1px 1px',
              width: '100%',
              height: '100%'
            }}
          />
        )}
      </div>
      
      {/* HUD */}
      <div className="absolute bottom-4 right-4 text-xs font-pixel text-white/50 pointer-events-none">
        {project.width}x{project.height} | Zoom {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { pixelEngine } from '../lib/pixelEngine';

interface PixelCanvasProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ editor }) => {
  const {
    project, activeFrameId, activeLayerId,
    currentTool, fgColor, zoom, setZoom, showGrid, onionSkin,
    updateLayerData, saveHistory, setFgColor
  } = editor;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeFrame = project.frames.find(f => f.id === activeFrameId) || project.frames[0];
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Multi-pointer tracking (for pinch-to-zoom & two-finger pan)
  const pointerMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidRef = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef = useRef(false);

  // Stable refs so pointer handlers don't go stale
  const isPanningRef = useRef(false);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const previewPointsRef = useRef<{ x: number; y: number }[]>([]);
  const currentToolRef = useRef(currentTool);
  const fgColorRef = useRef(fgColor);

  useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { lastPosRef.current = lastPos; }, [lastPos]);
  useEffect(() => { startPosRef.current = startPos; }, [startPos]);
  useEffect(() => { previewPointsRef.current = previewPoints; }, [previewPoints]);
  useEffect(() => { currentToolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { fgColorRef.current = fgColor; }, [fgColor]);

  // Spacebar pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.code === 'Space' && !e.repeat && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const loadLayerData = async (dataUrl: string, ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!dataUrl) { ctx.clearRect(0, 0, width, height); return; }
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0); resolve(); };
      img.src = dataUrl;
    });
  };

  // Composite render
  useEffect(() => {
    const render = async () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const { width, height } = project;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      ctx.clearRect(0, 0, width, height);

      if (onionSkin) {
        const frameIndex = project.frames.findIndex(f => f.id === activeFrameId);
        if (frameIndex > 0) {
          const prevFrame = project.frames[frameIndex - 1];
          const tc = document.createElement('canvas');
          tc.width = width; tc.height = height;
          const tCtx = tc.getContext('2d')!;
          for (const layer of [...prevFrame.layers].reverse()) {
            if (!layer.visible) continue;
            tCtx.globalAlpha = layer.opacity;
            await loadLayerData(layer.data, tCtx, width, height);
            ctx.globalAlpha = 0.3;
            ctx.drawImage(tc, 0, 0);
          }
          ctx.globalAlpha = 1.0;
        }
      }

      const tc = document.createElement('canvas');
      tc.width = width; tc.height = height;
      const tCtx = tc.getContext('2d')!;
      for (const layer of [...activeFrame.layers].reverse()) {
        if (!layer.visible) continue;
        await loadLayerData(layer.data, tCtx, width, height);
        ctx.globalAlpha = layer.opacity;
        ctx.drawImage(tc, 0, 0);
      }
      ctx.globalAlpha = 1.0;

      if (previewPoints.length > 0) {
        ctx.fillStyle = fgColor;
        previewPoints.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
      }
    };
    render();
  }, [project, activeFrameId, previewPoints, onionSkin, fgColor, activeFrame.layers]);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / (rect.width / project.width));
    const y = Math.floor((clientY - rect.top) / (rect.height / project.height));
    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return null;
    return { x, y };
  }, [project.width, project.height]);

  const commitDrawing = useCallback(async (points: { x: number; y: number }[], color: string) => {
    if (!activeLayer || activeLayer.locked || !activeLayer.visible || points.length === 0) return;
    const tc = document.createElement('canvas');
    tc.width = project.width; tc.height = project.height;
    const ctx = tc.getContext('2d')!;
    await loadLayerData(activeLayer.data, ctx, project.width, project.height);
    if (color === 'erase') {
      points.forEach(p => ctx.clearRect(p.x, p.y, 1, 1));
    } else {
      ctx.fillStyle = color;
      points.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
    }
    updateLayerData(activeFrame.id, activeLayer.id, tc.toDataURL());
  }, [activeLayer, activeFrame.id, project.width, project.height, updateLayerData]);

  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    // Capture so move/up fire even when pointer leaves element
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointerMapRef.current.size >= 2) {
      // Multi-touch: start pinch/pan, cancel any drawing
      setIsDrawing(false);
      setPreviewPoints([]);
      const pts = Array.from(pointerMapRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastPinchMidRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      return;
    }

    // Middle mouse or spacebar = pan
    if (e.button === 1 || spaceHeldRef.current) {
      setIsPanning(true);
      return;
    }

    const pos = getCanvasPos(e.clientX, e.clientY);
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
      const tc = document.createElement('canvas');
      tc.width = project.width; tc.height = project.height;
      const ctx = tc.getContext('2d')!;
      await loadLayerData(activeLayer.data, ctx, project.width, project.height);
      const points = pixelEngine.floodFill(ctx, pos.x, pos.y, fgColor);
      if (points.length > 0) commitDrawing(points, fgColor);
      return;
    }

    saveHistory();
    setIsDrawing(true);
    setStartPos(pos);
    setLastPos(pos);

    if (currentTool === 'pencil') commitDrawing([pos], fgColor);
    else if (currentTool === 'eraser') commitDrawing([pos], 'erase');
  }, [currentTool, fgColor, activeLayer, project.width, project.height, getCanvasPos, commitDrawing, saveHistory, setFgColor]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const prevXY = pointerMapRef.current.get(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch/pan
    if (pointerMapRef.current.size >= 2 && lastPinchDistRef.current !== null) {
      const pts = Array.from(pointerMapRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const newDist = Math.sqrt(dx * dx + dy * dy);

      // Zoom
      if (lastPinchDistRef.current > 0) {
        const ratio = newDist / lastPinchDistRef.current;
        setZoom(z => Math.max(1, Math.min(32, z * ratio)));
      }
      lastPinchDistRef.current = newDist;

      // Pan (midpoint movement)
      const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (lastPinchMidRef.current) {
        const midDx = newMid.x - lastPinchMidRef.current.x;
        const midDy = newMid.y - lastPinchMidRef.current.y;
        setPan(p => ({ x: p.x + midDx, y: p.y + midDy }));
      }
      lastPinchMidRef.current = newMid;
      return;
    }

    // Single pointer pan (middle click or space)
    if (isPanning && prevXY) {
      const mdx = e.clientX - prevXY.x;
      const mdy = e.clientY - prevXY.y;
      setPan(p => ({ x: p.x + mdx, y: p.y + mdy }));
      return;
    }

    if (!isDrawing || !startPos) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
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
      setPreviewPoints(pixelEngine.drawRect(startPos.x, startPos.y, pos.x, pos.y, false));
    } else if (currentTool === 'ellipse') {
      setPreviewPoints(pixelEngine.drawEllipse(startPos.x, startPos.y, pos.x, pos.y, false));
    }
  }, [isPanning, isDrawing, startPos, lastPos, currentTool, fgColor, getCanvasPos, commitDrawing, setZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerMapRef.current.delete(e.pointerId);

    if (pointerMapRef.current.size < 2) {
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }

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
  }, [isPanning, isDrawing, previewPoints, fgColor, commitDrawing]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    setZoom(z => Math.max(1, Math.min(32, z * factor)));
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full overflow-hidden bg-[#0d0d12] flex items-center justify-center relative select-none"
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
    >
      <div
        className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        style={{
          width: project.width,
          height: project.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          imageRendering: 'pixelated',
          cursor: isPanning ? 'grab' : 'crosshair',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Checkerboard transparency */}
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
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '1px 1px',
              width: '100%',
              height: '100%',
            }}
          />
        )}
      </div>

      {/* HUD */}
      <div className="absolute bottom-2 right-2 text-[9px] font-pixel text-white/40 pointer-events-none leading-tight">
        {project.width}x{project.height} | {Math.round(zoom * 100)}%
      </div>
    </div>
  );
};

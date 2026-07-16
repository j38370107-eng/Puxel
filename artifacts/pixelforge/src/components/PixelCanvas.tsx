import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { pixelEngine } from '../lib/pixelEngine';
import { Selection } from '../types';

interface PixelCanvasProps {
  editor: ReturnType<typeof usePixelEditor>;
}

// Expand a single point to a NxN brush block
function brushPoints(
  cx: number, cy: number, size: number,
  w: number, h: number
): { x: number; y: number }[] {
  if (size <= 1) return [{ x: cx, y: cy }];
  const r = Math.floor(size / 2);
  const pts: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < w && y >= 0 && y < h) {
        const k = `${x},${y}`;
        if (!seen.has(k)) { seen.add(k); pts.push({ x, y }); }
      }
    }
  }
  return pts;
}

// Shift all pixels in an ImageData by (dx, dy) with wrap-around
function shiftImageData(src: ImageData, dx: number, dy: number): ImageData {
  const w = src.width, h = src.height;
  const dst = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = ((x - dx) % w + w) % w;
      const sy = ((y - dy) % h + h) % h;
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      dst.data[di]     = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ editor }) => {
  const {
    project, activeFrameId, activeLayerId,
    currentTool, fgColor, zoom, setZoom, showGrid, onionSkin,
    brushSize, selection, setSelection,
    updateLayerData, saveHistory, setFgColor,
  } = editor;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const activeFrame = project.frames.find(f => f.id === activeFrameId) || project.frames[0];
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId);

  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning]   = useState(false);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [lastPos, setLastPos]       = useState<{ x: number; y: number } | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPos, setStartPos]     = useState<{ x: number; y: number } | null>(null);

  // Selection dragging
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart]       = useState<{ x: number; y: number } | null>(null);
  const [liveSelection, setLiveSelection] = useState<Selection | null>(null);

  // Move tool
  const [isMoveActive, setIsMoveActive]   = useState(false);
  const [moveStart, setMoveStart]         = useState<{ x: number; y: number } | null>(null);
  const [moveOffset, setMoveOffset]       = useState<{ x: number; y: number } | null>(null);
  const moveSnapshotRef = useRef<string>('');

  // Multi-pointer
  const pointerMapRef      = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef   = useRef<number | null>(null);
  const lastPinchMidRef    = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef       = useRef(false);

  // Stable refs for pointer handlers
  const isPanningRef    = useRef(false);
  const isDrawingRef    = useRef(false);
  const lastPosRef      = useRef<{ x: number; y: number } | null>(null);
  const startPosRef     = useRef<{ x: number; y: number } | null>(null);
  const previewRef      = useRef<{ x: number; y: number }[]>([]);
  const toolRef         = useRef(currentTool);
  const fgColorRef      = useRef(fgColor);
  const brushSizeRef    = useRef(brushSize);
  const zoomRef         = useRef(zoom);

  useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { lastPosRef.current = lastPos; }, [lastPos]);
  useEffect(() => { startPosRef.current = startPos; }, [startPos]);
  useEffect(() => { previewRef.current = previewPoints; }, [previewPoints]);
  useEffect(() => { toolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { fgColorRef.current = fgColor; }, [fgColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Spacebar pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.code === 'Space' && !e.repeat && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); spaceHeldRef.current = true;
      }
      if (e.key === 'Escape') { setSelection(null); setLiveSelection(null); setSelStart(null); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeldRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [setSelection]);

  const loadLayerData = async (dataUrl: string, ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!dataUrl) { ctx.clearRect(0, 0, w, h); return; }
    return new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0); resolve(); };
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
        const fi = project.frames.findIndex(f => f.id === activeFrameId);
        if (fi > 0) {
          const prev = project.frames[fi - 1];
          const tc = document.createElement('canvas');
          tc.width = width; tc.height = height;
          const tCtx = tc.getContext('2d')!;
          for (const layer of [...prev.layers].reverse()) {
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
        // Apply move offset preview if active
        if (moveOffset && layer.id === activeLayerId) {
          ctx.drawImage(tc, moveOffset.x, moveOffset.y);
        } else {
          ctx.drawImage(tc, 0, 0);
        }
      }
      ctx.globalAlpha = 1.0;

      if (previewPoints.length > 0) {
        ctx.fillStyle = fgColor;
        previewPoints.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
      }
    };
    render();
  }, [project, activeFrameId, previewPoints, onionSkin, fgColor, activeFrame.layers, moveOffset, activeLayerId]);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / (rect.width  / project.width));
    const y = Math.floor((clientY - rect.top)  / (rect.height / project.height));
    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return null;
    return { x, y };
  }, [project.width, project.height]);

  const commitDrawing = useCallback(async (points: { x: number; y: number }[], color: string) => {
    if (!activeLayer || activeLayer.locked || !activeLayer.visible || points.length === 0) return;
    // Expand by brush size
    const expanded: { x: number; y: number }[] = [];
    const seen = new Set<string>();
    for (const pt of points) {
      for (const bp of brushPoints(pt.x, pt.y, brushSizeRef.current, project.width, project.height)) {
        const k = `${bp.x},${bp.y}`;
        if (!seen.has(k)) { seen.add(k); expanded.push(bp); }
      }
    }
    const tc = document.createElement('canvas');
    tc.width = project.width; tc.height = project.height;
    const ctx = tc.getContext('2d')!;
    await loadLayerData(activeLayer.data, ctx, project.width, project.height);
    if (color === 'erase') {
      expanded.forEach(p => ctx.clearRect(p.x, p.y, 1, 1));
    } else {
      ctx.fillStyle = color;
      expanded.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
    }
    updateLayerData(activeFrame.id, activeLayer.id, tc.toDataURL());
  }, [activeLayer, activeFrame.id, project.width, project.height, updateLayerData]);

  const commitMove = useCallback(async (dx: number, dy: number) => {
    if (!activeLayer || activeLayer.locked) return;
    if (dx === 0 && dy === 0) return;
    const tc = document.createElement('canvas');
    tc.width = project.width; tc.height = project.height;
    const ctx = tc.getContext('2d')!;
    await loadLayerData(moveSnapshotRef.current || activeLayer.data, ctx, project.width, project.height);
    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const shifted = shiftImageData(imgData, dx, dy);
    ctx.clearRect(0, 0, project.width, project.height);
    ctx.putImageData(shifted, 0, 0);
    updateLayerData(activeFrame.id, activeLayer.id, tc.toDataURL());
  }, [activeLayer, activeFrame.id, project.width, project.height, updateLayerData]);

  const handlePointerDown = useCallback(async (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointerMapRef.current.size >= 2) {
      setIsDrawing(false); setPreviewPoints([]);
      const pts = Array.from(pointerMapRef.current.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastPinchMidRef.current  = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      return;
    }

    if (e.button === 1 || spaceHeldRef.current) { setIsPanning(true); return; }

    const pos = getCanvasPos(e.clientX, e.clientY);
    if (!pos) return;

    const tool = toolRef.current;

    // Select tool
    if (tool === 'select') {
      setIsSelecting(true);
      setSelStart(pos);
      setLiveSelection({ x: pos.x, y: pos.y, w: 1, h: 1 });
      return;
    }

    // Move tool
    if (tool === 'move') {
      if (!activeLayer || activeLayer.locked) return;
      setIsMoveActive(true);
      setMoveStart(pos);
      setMoveOffset({ x: 0, y: 0 });
      moveSnapshotRef.current = activeLayer.data;
      saveHistory();
      return;
    }

    if (tool === 'eyedropper') {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d')!;
      const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      if (pixel[3] > 0) {
        setFgColor('#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join(''));
      }
      return;
    }

    if (tool === 'fill') {
      if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;
      saveHistory();
      const tc = document.createElement('canvas');
      tc.width = project.width; tc.height = project.height;
      const ctx = tc.getContext('2d')!;
      await loadLayerData(activeLayer.data, ctx, project.width, project.height);
      const pts = pixelEngine.floodFill(ctx, pos.x, pos.y, fgColorRef.current);
      if (pts.length > 0) commitDrawing(pts, fgColorRef.current);
      return;
    }

    saveHistory();
    setIsDrawing(true);
    setStartPos(pos);
    setLastPos(pos);

    if (tool === 'pencil') commitDrawing(brushPoints(pos.x, pos.y, brushSizeRef.current, project.width, project.height), fgColorRef.current);
    else if (tool === 'eraser') commitDrawing(brushPoints(pos.x, pos.y, brushSizeRef.current, project.width, project.height), 'erase');
  }, [activeLayer, project.width, project.height, getCanvasPos, commitDrawing, saveHistory, setFgColor]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const prevXY = pointerMapRef.current.get(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointerMapRef.current.size >= 2 && lastPinchDistRef.current !== null) {
      const pts = Array.from(pointerMapRef.current.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDistRef.current > 0) setZoom(z => Math.max(1, Math.min(32, z * (newDist / lastPinchDistRef.current!))));
      lastPinchDistRef.current = newDist;
      const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (lastPinchMidRef.current) setPan(p => ({ x: p.x + newMid.x - lastPinchMidRef.current!.x, y: p.y + newMid.y - lastPinchMidRef.current!.y }));
      lastPinchMidRef.current = newMid;
      return;
    }

    if (isPanning && prevXY) {
      setPan(p => ({ x: p.x + e.clientX - prevXY.x, y: p.y + e.clientY - prevXY.y }));
      return;
    }

    // Selection drag
    if (isSelecting && selStart) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      if (pos) {
        const x = Math.min(selStart.x, pos.x);
        const y = Math.min(selStart.y, pos.y);
        const w = Math.abs(pos.x - selStart.x) + 1;
        const h = Math.abs(pos.y - selStart.y) + 1;
        setLiveSelection({ x, y, w, h });
      }
      return;
    }

    // Move drag
    if (isMoveActive && moveStart) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      if (pos) {
        const dx = pos.x - moveStart.x;
        const dy = pos.y - moveStart.y;
        setMoveOffset({ x: dx, y: dy });
      }
      return;
    }

    if (!isDrawing || !startPos) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (!pos) return;

    const tool = toolRef.current;
    if (tool === 'pencil' || tool === 'eraser') {
      if (lastPos && (lastPos.x !== pos.x || lastPos.y !== pos.y)) {
        const linePoints = pixelEngine.drawLine(lastPos.x, lastPos.y, pos.x, pos.y);
        commitDrawing(linePoints, tool === 'pencil' ? fgColorRef.current : 'erase');
        setLastPos(pos);
      }
    } else if (tool === 'line') {
      setPreviewPoints(pixelEngine.drawLine(startPos.x, startPos.y, pos.x, pos.y));
    } else if (tool === 'rect') {
      setPreviewPoints(pixelEngine.drawRect(startPos.x, startPos.y, pos.x, pos.y, false));
    } else if (tool === 'ellipse') {
      setPreviewPoints(pixelEngine.drawEllipse(startPos.x, startPos.y, pos.x, pos.y, false));
    }
  }, [isPanning, isSelecting, selStart, isMoveActive, moveStart, isDrawing, startPos, lastPos, getCanvasPos, commitDrawing, setZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerMapRef.current.delete(e.pointerId);
    if (pointerMapRef.current.size < 2) {
      lastPinchDistRef.current = null; lastPinchMidRef.current = null;
    }

    // Finalize selection
    if (isSelecting) {
      setIsSelecting(false);
      if (liveSelection && liveSelection.w > 1 && liveSelection.h > 1) {
        setSelection(liveSelection);
      } else {
        setSelection(null);
      }
      setLiveSelection(null);
      setSelStart(null);
      return;
    }

    // Finalize move
    if (isMoveActive && moveOffset) {
      commitMove(moveOffset.x, moveOffset.y);
      setIsMoveActive(false);
      setMoveOffset(null);
      setMoveStart(null);
      moveSnapshotRef.current = '';
      return;
    }

    if (isPanning) { setIsPanning(false); return; }

    if (isDrawing && previewPoints.length > 0) {
      commitDrawing(previewPoints, fgColorRef.current);
      setPreviewPoints([]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setLastPos(null);
  }, [isPanning, isSelecting, liveSelection, setSelection, isMoveActive, moveOffset, commitMove, isDrawing, previewPoints, commitDrawing]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(1, Math.min(32, z * (e.deltaY > 0 ? 0.85 : 1.18))));
  };

  // Cursor style
  const cursor =
    isPanning ? 'grab' :
    currentTool === 'eyedropper' ? 'crosshair' :
    currentTool === 'select' ? 'crosshair' :
    currentTool === 'move' ? (isMoveActive ? 'grabbing' : 'grab') :
    'crosshair';

  // Displayed selection (committed or live)
  const displaySel = isSelecting ? liveSelection : selection;

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
          cursor,
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
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)`,
              backgroundSize: '1px 1px',
            }}
          />
        )}

        {/* Selection Overlay — in canvas-pixel space (within the scaled div) */}
        {displaySel && displaySel.w > 0 && displaySel.h > 0 && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: displaySel.x,
              top: displaySel.y,
              width: displaySel.w,
              height: displaySel.h,
              outline: '1px dashed rgba(255, 255, 255, 0.9)',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)',
              background: 'rgba(100, 180, 255, 0.08)',
            }}
          />
        )}
      </div>

      {/* HUD */}
      <div className="absolute bottom-2 right-2 text-[9px] font-pixel text-white/40 pointer-events-none leading-tight text-right">
        {project.width}×{project.height} | {Math.round(zoom * 100)}%
        {displaySel && <div className="text-amber-400/60">{displaySel.w}×{displaySel.h} sel</div>}
      </div>
    </div>
  );
};

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { pixelEngine } from '../lib/pixelEngine';
import { Selection } from '../types';

interface PixelCanvasProps {
  editor: ReturnType<typeof usePixelEditor>;
  onCursorMove?: (pos: { x: number; y: number } | null) => void;
}

function brushPoints(cx: number, cy: number, size: number, w: number, h: number) {
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

export const PixelCanvas: React.FC<PixelCanvasProps> = ({ editor, onCursorMove }) => {
  const {
    project, activeFrameId, activeLayerId,
    currentTool, fgColor, zoom, setZoom, showGrid, onionSkin,
    brushSize, selection, setSelection,
    updateLayerData, saveHistory, setFgColor,
  } = editor;

  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null);

  const activeFrame = project.frames.find(f => f.id === activeFrameId) || project.frames[0];
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId);

  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning]   = useState(false);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [lastPos, setLastPos]       = useState<{ x: number; y: number } | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPos, setStartPos]     = useState<{ x: number; y: number } | null>(null);

  const [isSelecting, setIsSelecting]     = useState(false);
  const [selStart, setSelStart]           = useState<{ x: number; y: number } | null>(null);
  const [liveSelection, setLiveSelection] = useState<Selection | null>(null);

  const [isMoveActive, setIsMoveActive]   = useState(false);
  const [moveStart, setMoveStart]         = useState<{ x: number; y: number } | null>(null);
  const [moveOffset, setMoveOffset]       = useState<{ x: number; y: number } | null>(null);
  const moveSnapshotRef = useRef<string>('');

  const pointerMapRef      = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef   = useRef<number | null>(null);
  const lastPinchMidRef    = useRef<{ x: number; y: number } | null>(null);
  const spaceHeldRef       = useRef(false);

  const isPanningRef    = useRef(false);
  const isDrawingRef    = useRef(false);
  const lastPosRef      = useRef<{ x: number; y: number } | null>(null);
  const startPosRef     = useRef<{ x: number; y: number } | null>(null);
  const previewRef      = useRef<{ x: number; y: number }[]>([]);
  const toolRef         = useRef(currentTool);
  const fgColorRef      = useRef(fgColor);
  const brushSizeRef    = useRef(brushSize);
  const zoomRef         = useRef(zoom);
  const panRef          = useRef(pan);

  useEffect(() => { isPanningRef.current = isPanning; }, [isPanning]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { lastPosRef.current = lastPos; }, [lastPos]);
  useEffect(() => { startPosRef.current = startPos; }, [startPos]);
  useEffect(() => { previewRef.current = previewPoints; }, [previewPoints]);
  useEffect(() => { toolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { fgColorRef.current = fgColor; }, [fgColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Space to pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (e.code === 'Space' && !e.repeat && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault(); spaceHeldRef.current = true;
      }
      if (e.key === 'Escape') {
        setSelection(null); setLiveSelection(null); setSelStart(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeldRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
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

      // Onion skin
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
            ctx.globalAlpha = 0.25;
            ctx.drawImage(tc, 0, 0);
          }
          ctx.globalAlpha = 1.0;
        }
      }

      // Active frame layers
      const tc = document.createElement('canvas');
      tc.width = width; tc.height = height;
      const tCtx = tc.getContext('2d')!;
      for (const layer of [...activeFrame.layers].reverse()) {
        if (!layer.visible) continue;
        await loadLayerData(layer.data, tCtx, width, height);
        ctx.globalAlpha = layer.opacity;
        if (moveOffset && layer.id === activeLayerId) {
          ctx.drawImage(tc, moveOffset.x, moveOffset.y);
        } else {
          ctx.drawImage(tc, 0, 0);
        }
      }
      ctx.globalAlpha = 1.0;

      // Preview pixels
      if (previewPoints.length > 0) {
        ctx.fillStyle = fgColor;
        previewPoints.forEach(p => ctx.fillRect(p.x, p.y, 1, 1));
      }
    };
    render();
  }, [project, activeFrameId, previewPoints, onionSkin, fgColor, activeFrame.layers, moveOffset, activeLayerId]);

  // Overlay: grid + selection
  useEffect(() => {
    if (!overlayRef.current || !canvasRef.current) return;
    const w = project.width;
    const h = project.height;
    const displayW = w * zoom;
    const displayH = h * zoom;
    overlayRef.current.width  = displayW;
    overlayRef.current.height = displayH;
    const ctx = overlayRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, displayW, displayH);

    // Grid
    if (showGrid && zoom >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom, 0);
        ctx.lineTo(x * zoom, displayH);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom);
        ctx.lineTo(displayW, y * zoom);
        ctx.stroke();
      }
    }

    // Selection
    const sel = liveSelection || selection;
    if (sel) {
      ctx.strokeStyle = 'rgba(124,58,237,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(sel.x * zoom, sel.y * zoom, sel.w * zoom, sel.h * zoom);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(124,58,237,0.08)';
      ctx.fillRect(sel.x * zoom, sel.y * zoom, sel.w * zoom, sel.h * zoom);
    }
  }, [project.width, project.height, zoom, showGrid, selection, liveSelection]);

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
    ctx.clearRect(0, 0, project.width, project.height);
    ctx.putImageData(shiftImageData(imgData, dx, dy), 0, 0);
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

    if (tool === 'select') {
      setIsSelecting(true); setSelStart(pos);
      setLiveSelection({ x: pos.x, y: pos.y, w: 1, h: 1 }); return;
    }
    if (tool === 'move') {
      if (!activeLayer || activeLayer.locked) return;
      setIsMoveActive(true); setMoveStart(pos); setMoveOffset({ x: 0, y: 0 });
      moveSnapshotRef.current = activeLayer.data; saveHistory(); return;
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
    setIsDrawing(true); setStartPos(pos); setLastPos(pos);
    if (tool === 'pencil') commitDrawing(brushPoints(pos.x, pos.y, brushSizeRef.current, project.width, project.height), fgColorRef.current);
    else if (tool === 'eraser') commitDrawing(brushPoints(pos.x, pos.y, brushSizeRef.current, project.width, project.height), 'erase');
  }, [activeLayer, project.width, project.height, getCanvasPos, commitDrawing, saveHistory, setFgColor]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const prevXY = pointerMapRef.current.get(e.pointerId);
    pointerMapRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Report cursor position
    const pos = getCanvasPos(e.clientX, e.clientY);
    onCursorMove?.(pos);

    // Pinch zoom
    if (pointerMapRef.current.size >= 2 && lastPinchDistRef.current !== null) {
      const pts = Array.from(pointerMapRef.current.values());
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDistRef.current > 0) {
        setZoom(z => Math.max(1, Math.min(32, z * (newDist / lastPinchDistRef.current!))));
      }
      lastPinchDistRef.current = newDist;
      return;
    }

    // Pan
    if (isPanningRef.current && prevXY) {
      setPan(p => ({ x: p.x + e.clientX - prevXY.x, y: p.y + e.clientY - prevXY.y }));
      return;
    }

    if (!pos) return;

    // Select drag
    if (isSelecting && selStart) {
      const x = Math.min(pos.x, selStart.x);
      const y = Math.min(pos.y, selStart.y);
      const w = Math.abs(pos.x - selStart.x) + 1;
      const h = Math.abs(pos.y - selStart.y) + 1;
      setLiveSelection({ x, y, w, h }); return;
    }

    // Move tool
    if (isMoveActive && moveStart) {
      const dx = pos.x - moveStart.x, dy = pos.y - moveStart.y;
      setMoveOffset({ x: dx, y: dy }); return;
    }

    if (!isDrawingRef.current) return;
    const tool = toolRef.current;
    const sp = startPosRef.current;

    if (tool === 'pencil') {
      if (lastPosRef.current) {
        const line = pixelEngine.drawLine(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
        commitDrawing(line, fgColorRef.current);
      }
      setLastPos(pos);
    } else if (tool === 'eraser') {
      if (lastPosRef.current) {
        const line = pixelEngine.drawLine(lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y);
        commitDrawing(line, 'erase');
      }
      setLastPos(pos);
    } else if (sp) {
      let pts: { x: number; y: number }[] = [];
      if (tool === 'line')    pts = pixelEngine.drawLine(sp.x, sp.y, pos.x, pos.y);
      if (tool === 'rect')    pts = pixelEngine.drawRect(sp.x, sp.y, pos.x, pos.y, false);
      if (tool === 'ellipse') pts = pixelEngine.drawEllipse(sp.x, sp.y, pos.x, pos.y, false);
      setPreviewPoints(pts);
    }
  }, [getCanvasPos, onCursorMove, isSelecting, selStart, isMoveActive, moveStart, commitDrawing, setZoom]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    pointerMapRef.current.delete(e.pointerId);
    lastPinchDistRef.current = null;

    if (isPanningRef.current) { setIsPanning(false); return; }

    if (isSelecting) {
      setIsSelecting(false);
      setSelection(liveSelection); setLiveSelection(null); setSelStart(null); return;
    }

    if (isMoveActive && moveOffset) {
      await commitMove(moveOffset.x, moveOffset.y);
      setIsMoveActive(false); setMoveStart(null); setMoveOffset(null); return;
    }

    if (!isDrawingRef.current) return;
    const sp = startPosRef.current;
    const pos = getCanvasPos(e.clientX, e.clientY);
    const tool = toolRef.current;

    if (sp && pos && (tool === 'line' || tool === 'rect' || tool === 'ellipse')) {
      let pts: { x: number; y: number }[] = [];
      if (tool === 'line')    pts = pixelEngine.drawLine(sp.x, sp.y, pos.x, pos.y);
      if (tool === 'rect')    pts = pixelEngine.drawRect(sp.x, sp.y, pos.x, pos.y, false);
      if (tool === 'ellipse') pts = pixelEngine.drawEllipse(sp.x, sp.y, pos.x, pos.y, false);
      await commitDrawing(pts, fgColorRef.current);
      setPreviewPoints([]);
    }

    setIsDrawing(false); setLastPos(null); setStartPos(null);
  }, [isSelecting, liveSelection, isMoveActive, moveOffset, commitMove, getCanvasPos, commitDrawing, setSelection]);

  const handlePointerLeave = useCallback(() => {
    onCursorMove?.(null);
  }, [onCursorMove]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(1, Math.min(32, z + (e.deltaY < 0 ? 1 : -1))));
  }, [setZoom]);

  const displayW = project.width  * zoom;
  const displayH = project.height * zoom;

  const cursor =
    currentTool === 'pencil'     ? 'crosshair' :
    currentTool === 'eraser'     ? 'cell' :
    currentTool === 'eyedropper' ? 'crosshair' :
    currentTool === 'fill'       ? 'cell' :
    currentTool === 'move'       ? 'move' :
    currentTool === 'select'     ? 'default' :
    'crosshair';

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden"
      onWheel={handleWheel}
    >
      <div
        className="relative"
        style={{
          width: displayW,
          height: displayH,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          cursor: isPanning ? 'grabbing' : spaceHeldRef.current ? 'grab' : cursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {/* Pixel canvas */}
        <canvas
          ref={canvasRef}
          style={{ width: displayW, height: displayH, display: 'block', position: 'absolute', top: 0, left: 0 }}
        />
        {/* Grid / selection overlay */}
        <canvas
          ref={overlayRef}
          style={{ width: displayW, height: displayH, display: 'block', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
};

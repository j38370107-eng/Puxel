import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, Trash2, Copy, Layers } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

interface AnimationTimelineProps {
  editor: ReturnType<typeof usePixelEditor>;
  expanded?: boolean;
}

export const AnimationTimeline: React.FC<AnimationTimelineProps> = ({ editor, expanded = false }) => {
  const {
    project, activeFrameId, setActiveFrameId,
    isPlaying, setIsPlaying, fps, setFps,
    addFrame, copyFrame, deleteFrame,
    onionSkin, setOnionSkin,
  } = editor;

  const thumbnailsRef  = useRef<Record<string, string>>({});
  const [tick, setTick] = useState(0); // force re-render after thumbnail gen

  // Generate thumbnails whenever frames change
  useEffect(() => {
    let cancelled = false;
    const { width, height } = project;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    (async () => {
      for (const frame of project.frames) {
        if (cancelled) return;
        ctx.clearRect(0, 0, width, height);
        // checkerboard bg
        ctx.fillStyle = '#050509';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#0d0d18';
        for (let y = 0; y < height; y += 4)
          for (let x = 0; x < width; x += 4)
            if ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0)
              ctx.fillRect(x, y, 4, 4);

        for (const layer of [...frame.layers].reverse()) {
          if (!layer.visible || !layer.data) continue;
          await new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => { ctx.globalAlpha = layer.opacity; ctx.drawImage(img, 0, 0); resolve(); };
            img.onerror = () => resolve();
            img.src = layer.data;
          });
          if (cancelled) return;
        }
        ctx.globalAlpha = 1;
        thumbnailsRef.current[frame.id] = canvas.toDataURL();
      }
      if (!cancelled) setTick(t => t + 1);
    })();

    return () => { cancelled = true; };
  }, [project.frames, project.width, project.height]);

  // Playback
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setActiveFrameId(prev => {
        const idx = project.frames.findIndex(f => f.id === prev);
        return project.frames[(idx + 1) % project.frames.length].id;
      });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [isPlaying, fps, project.frames, setActiveFrameId]);

  const thumbSize = expanded ? 80 : 56;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border/50 bg-background/30 shrink-0 flex-wrap gap-y-1">
        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-sm border transition-colors shrink-0',
            isPlaying
              ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]'
              : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-white hover:border-primary/40'
          )}
        >
          {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>

        {/* FPS */}
        <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-sm px-2 py-1 shrink-0">
          <span className="font-pixel text-[7px] text-muted-foreground">FPS</span>
          <input
            type="range" min="1" max="24" value={fps}
            onChange={e => setFps(parseInt(e.target.value))}
            className="w-16 sm:w-20"
          />
          <span className="font-mono text-[10px] text-foreground/70 w-4 text-center tabular-nums">{fps}</span>
        </div>

        {/* Onion skin */}
        <label className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-sm border cursor-pointer transition-colors shrink-0',
          onionSkin
            ? 'bg-accent/10 border-accent/40 text-accent shadow-[0_0_8px_rgba(167,139,250,0.2)]'
            : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-accent/30'
        )}>
          <input type="checkbox" checked={onionSkin} onChange={e => setOnionSkin(e.target.checked)} className="sr-only" />
          <Layers size={11} />
          <span className="font-pixel text-[7px] uppercase tracking-wider">Onion</span>
        </label>

        <div className="flex-1" />

        {/* Frame actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={copyFrame}
            className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/50 hover:border-primary/40 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Duplicate frame"
          >
            <Copy size={11} />
            <span className="font-pixel text-[7px] hidden sm:block">DUP</span>
          </button>
          <button
            onClick={addFrame}
            className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/30 hover:border-primary rounded-sm text-primary hover:text-white hover:bg-primary transition-colors"
            title="New frame"
          >
            <Plus size={11} />
            <span className="font-pixel text-[7px] hidden sm:block">NEW</span>
          </button>
          <button
            onClick={() => deleteFrame(activeFrameId)}
            className="flex items-center justify-center w-7 h-7 bg-muted/30 border border-border/50 hover:border-destructive/50 hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
            title="Delete frame"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Frame strip */}
      <div className={cn(
        'flex-1 overflow-x-auto p-2 flex gap-2 items-start',
        expanded ? 'flex-wrap content-start bg-[#040408]' : 'items-center bg-[#04040a]'
      )}>
        {project.frames.map((frame, index) => {
          const isActive = frame.id === activeFrameId;
          return (
            <div
              key={frame.id}
              onClick={() => setActiveFrameId(frame.id)}
              className={cn(
                'flex flex-col items-center gap-1 cursor-pointer transition-all shrink-0 group',
                isActive ? 'scale-105' : 'opacity-50 hover:opacity-90 hover:scale-[1.02]'
              )}
            >
              <span className="font-pixel text-[7px] text-muted-foreground group-hover:text-foreground transition-colors">
                {index + 1}
              </span>
              <div
                className={cn(
                  'overflow-hidden rounded-sm border-2 transition-all flex items-center justify-center',
                  isActive
                    ? 'border-primary shadow-[0_0_12px_rgba(124,58,237,0.5)]'
                    : 'border-border/40 group-hover:border-primary/30'
                )}
                style={{ width: thumbSize, height: thumbSize }}
              >
                {thumbnailsRef.current[frame.id] ? (
                  <img
                    src={thumbnailsRef.current[frame.id]}
                    alt={`Frame ${index + 1}`}
                    className="w-full h-full object-contain pixelated"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/20 animate-pulse" />
                )}
              </div>
              {expanded && (
                <span className={cn('font-mono text-[9px] tabular-nums', isActive ? 'text-primary/70' : 'text-muted-foreground/40')}>
                  {frame.duration}ms
                </span>
              )}
            </div>
          );
        })}

        {/* Add frame button */}
        <button
          onClick={addFrame}
          style={{ width: thumbSize, height: thumbSize }}
          className="shrink-0 border-2 border-dashed border-border/30 flex items-center justify-center text-muted-foreground/30 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all rounded-sm mt-[18px]"
          title="Add empty frame"
        >
          <Plus size={expanded ? 20 : 14} />
        </button>
      </div>
    </div>
  );
};

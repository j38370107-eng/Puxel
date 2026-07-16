import React, { useEffect, useRef } from 'react';
import { Play, Pause, Plus, Trash2 } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

interface AnimationTimelineProps {
  editor: ReturnType<typeof usePixelEditor>;
  compact?: boolean;
}

export const AnimationTimeline: React.FC<AnimationTimelineProps> = ({ editor, compact = false }) => {
  const {
    project, activeFrameId, setActiveFrameId,
    isPlaying, setIsPlaying, fps, setFps,
    addFrame, deleteFrame, onionSkin, setOnionSkin
  } = editor;

  const thumbnailsRef = useRef<Record<string, string>>({});
  const renderCountRef = useRef(0);

  useEffect(() => {
    const updateThumbnails = async () => {
      const { width, height } = project;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      for (const frame of project.frames) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#444';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#222';
        for (let y = 0; y < height; y += 4) {
          for (let x = 0; x < width; x += 4) {
            if ((x / 4 + y / 4) % 2 === 0) ctx.fillRect(x, y, 4, 4);
          }
        }
        for (const layer of [...frame.layers].reverse()) {
          if (!layer.visible || !layer.data) continue;
          await new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => {
              ctx.globalAlpha = layer.opacity;
              ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.src = layer.data;
          });
        }
        ctx.globalAlpha = 1;
        thumbnailsRef.current[frame.id] = canvas.toDataURL();
      }
      renderCountRef.current++;
    };
    updateThumbnails();
  }, [project.frames, project.width, project.height]);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalId = setInterval(() => {
      setActiveFrameId(prev => {
        const idx = project.frames.findIndex(f => f.id === prev);
        const nextIdx = (idx + 1) % project.frames.length;
        return project.frames[nextIdx].id;
      });
    }, 1000 / fps);
    return () => clearInterval(intervalId);
  }, [isPlaying, fps, project.frames, setActiveFrameId]);

  return (
    <div className={cn(
      'border-t border-border bg-card flex flex-col',
      compact ? '' : 'h-40'
    )}>
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            data-testid="timeline-play"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm font-pixel text-[9px] hover:bg-primary/90 active:opacity-80"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="font-pixel text-[8px]">FPS</span>
            <input
              type="range" min="1" max="24" value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-20 accent-primary"
            />
            <span className="w-4">{fps}</span>
          </div>

          <label className="flex items-center gap-1.5 font-pixel text-[9px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={onionSkin}
              onChange={(e) => setOnionSkin(e.target.checked)}
              className="accent-primary"
            />
            ONION
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            data-testid="frame-add"
            onClick={addFrame}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-white"
            title="New Frame"
          >
            <Plus size={15} />
          </button>
          <button
            data-testid="frame-delete"
            onClick={() => deleteFrame(activeFrameId)}
            className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
            title="Delete Frame"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Frames strip */}
      <div className="flex-1 overflow-x-auto p-3 flex items-center gap-2 bg-[#0d0d12]">
        {project.frames.map((frame, index) => (
          <div
            key={frame.id}
            data-testid={`frame-${frame.id}`}
            onClick={() => setActiveFrameId(frame.id)}
            className={cn(
              'flex flex-col items-center gap-1 cursor-pointer transition-all shrink-0',
              activeFrameId === frame.id ? 'scale-110 opacity-100' : 'opacity-50 hover:opacity-80'
            )}
          >
            <div className={cn(
              'w-14 h-14 bg-card border-2 flex items-center justify-center overflow-hidden rounded-sm',
              activeFrameId === frame.id ? 'border-primary' : 'border-border'
            )}>
              {thumbnailsRef.current[frame.id] && (
                <img
                  src={thumbnailsRef.current[frame.id]}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
            </div>
            <span className="font-pixel text-[8px] text-muted-foreground">{index + 1}</span>
          </div>
        ))}
        <button
          onClick={addFrame}
          className="w-14 h-14 border-2 border-dashed border-border rounded-sm flex items-center justify-center text-border hover:border-primary hover:text-primary transition-colors shrink-0"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

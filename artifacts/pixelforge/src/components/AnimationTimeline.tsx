import React, { useEffect, useRef } from 'react';
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
  const renderCountRef = useRef(0);

  useEffect(() => {
    const updateThumbnails = async () => {
      const { width, height } = project;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      for (const frame of project.frames) {
        ctx.clearRect(0, 0, width, height);
        // Dark checkboard for gothic vibe
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#0a0a0e';
        for (let y = 0; y < height; y += 4)
          for (let x = 0; x < width; x += 4)
            if ((x / 4 + y / 4) % 2 === 0) ctx.fillRect(x, y, 4, 4);

        for (const layer of [...frame.layers].reverse()) {
          if (!layer.visible || !layer.data) continue;
          await new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => { ctx.globalAlpha = layer.opacity; ctx.drawImage(img, 0, 0); resolve(); };
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
    const id = setInterval(() => {
      setActiveFrameId(prev => {
        const idx = project.frames.findIndex(f => f.id === prev);
        return project.frames[(idx + 1) % project.frames.length].id;
      });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [isPlaying, fps, project.frames, setActiveFrameId]);

  return (
    <div className="h-full flex flex-col">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#111118] bg-[#0a0a0e] shadow-md z-10 shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-sm transition-colors",
              isPlaying 
                ? "bg-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]" 
                : "bg-[#111118] border border-[#1a1a24] text-muted-foreground hover:bg-[#1a1a24] hover:text-white"
            )}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>

          <div className="flex items-center gap-3 bg-[#111118] border border-[#1a1a24] rounded-sm px-3 py-1">
            <span className="font-pixel text-[8px] text-muted-foreground">FPS</span>
            <input
              type="range" min="1" max="24" value={fps}
              onChange={e => setFps(parseInt(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="font-mono text-[10px] w-4 text-center">{fps}</span>
          </div>

          <label className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-sm border cursor-pointer transition-colors",
            onionSkin 
              ? "bg-primary/10 border-primary/50 text-primary shadow-[0_0_10px_rgba(124,58,237,0.2)]" 
              : "bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545]"
          )}>
            <input
              type="checkbox"
              checked={onionSkin}
              onChange={e => setOnionSkin(e.target.checked)}
              className="sr-only"
            />
            <Layers size={14} />
            <span className="font-pixel text-[8px] uppercase tracking-widest mt-0.5">Onion Skin</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyFrame}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111118] border border-[#1a1a24] hover:border-[#2a1545] rounded-sm text-muted-foreground hover:text-white transition-colors"
            title="Duplicate Current Frame"
          >
            <Copy size={12} /> <span className="font-pixel text-[8px] mt-0.5 hidden sm:inline">DUPLICATE</span>
          </button>
          <button
            onClick={addFrame}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a24] border border-[#2a2a35] hover:border-primary rounded-sm text-foreground hover:text-primary transition-colors"
            title="New Empty Frame"
          >
            <Plus size={12} /> <span className="font-pixel text-[8px] mt-0.5 hidden sm:inline">NEW FRAME</span>
          </button>
          <button
            onClick={() => deleteFrame(activeFrameId)}
            className="flex items-center justify-center w-8 h-8 bg-[#111118] border border-[#1a1a24] hover:border-destructive hover:bg-destructive/10 rounded-sm text-muted-foreground hover:text-destructive transition-colors ml-2"
            title="Delete Current Frame"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Frame Strip */}
      <div className={cn(
        "flex-1 overflow-x-auto p-4 flex gap-3 items-start",
        expanded ? "bg-[#08080a] flex-wrap content-start" : "bg-[#050505] items-center"
      )}>
        {project.frames.map((frame, index) => (
          <div
            key={frame.id}
            onClick={() => setActiveFrameId(frame.id)}
            className={cn(
              'flex flex-col items-center gap-2 cursor-pointer transition-all shrink-0 group',
              activeFrameId === frame.id ? 'scale-105' : 'hover:scale-105 opacity-60 hover:opacity-100'
            )}
          >
            <div className="font-pixel text-[8px] text-muted-foreground group-hover:text-foreground transition-colors">
              {index + 1}
            </div>
            <div className={cn(
              'bg-[#0d0d12] flex items-center justify-center overflow-hidden rounded-sm transition-all',
              expanded ? 'w-24 h-24 border-2' : 'w-16 h-16 border-2',
              activeFrameId === frame.id 
                ? 'border-primary shadow-[0_0_15px_rgba(124,58,237,0.4)]' 
                : 'border-[#1a1a24] group-hover:border-[#2a1545]'
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
            {expanded && activeFrameId === frame.id && (
              <div className="font-mono text-[9px] text-primary">{frame.duration}ms</div>
            )}
          </div>
        ))}
        
        <button
          onClick={addFrame}
          className={cn(
            "border-2 border-dashed border-[#1a1a24] rounded-sm flex items-center justify-center text-[#2a2a35] hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all shrink-0 mt-4",
            expanded ? "w-24 h-24" : "w-16 h-16"
          )}
          title="Add empty frame"
        >
          <Plus size={expanded ? 24 : 16} />
        </button>
      </div>
    </div>
  );
};

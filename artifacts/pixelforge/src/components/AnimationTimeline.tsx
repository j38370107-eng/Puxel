import React, { useEffect, useRef } from 'react';
import { Play, Pause, Plus, Copy, Trash2 } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

interface AnimationTimelineProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const AnimationTimeline: React.FC<AnimationTimelineProps> = ({ editor }) => {
  const { 
    project, activeFrameId, setActiveFrameId, 
    isPlaying, setIsPlaying, fps, setFps,
    addFrame, deleteFrame, onionSkin, setOnionSkin
  } = editor;

  // Render thumbnails
  const thumbnailsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Generate thumbnails for all frames when they change
    const updateThumbnails = async () => {
      const { width, height } = project;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      for (const frame of project.frames) {
        ctx.clearRect(0, 0, width, height);
        // Draw checkered bg for thumb
        ctx.fillStyle = '#444';
        ctx.fillRect(0,0,width,height);
        ctx.fillStyle = '#222';
        for(let y=0;y<height;y+=4) {
          for(let x=0;x<width;x+=4) {
            if((x/4+y/4)%2===0) ctx.fillRect(x,y,4,4);
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
        thumbnailsRef.current[frame.id] = canvas.toDataURL();
      }
    };
    updateThumbnails();
  }, [project.frames, project.width, project.height]);

  // Playback logic
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
    <div className="h-40 border-t border-border bg-card flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-sm font-pixel text-[10px] hover:bg-primary/90"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="font-pixel text-[8px]">FPS</span>
            <input 
              type="range" min="1" max="24" value={fps} 
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="w-4">{fps}</span>
          </div>

          <label className="flex items-center gap-2 font-pixel text-[10px] text-muted-foreground cursor-pointer ml-4">
            <input 
              type="checkbox" 
              checked={onionSkin} 
              onChange={(e) => setOnionSkin(e.target.checked)}
              className="accent-primary"
            />
            ONION SKIN
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={addFrame} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-white" title="New Frame"><Plus size={16} /></button>
          <button onClick={() => deleteFrame(activeFrameId)} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-destructive" title="Delete Frame"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 flex items-center gap-2 bg-[#0d0d12]">
        {project.frames.map((frame, index) => (
          <div 
            key={frame.id}
            onClick={() => setActiveFrameId(frame.id)}
            className={cn(
              "flex flex-col items-center gap-1 cursor-pointer transition-all",
              activeFrameId === frame.id ? "scale-110 opacity-100" : "opacity-50 hover:opacity-80"
            )}
          >
            <div className={cn(
              "w-16 h-16 bg-card border-2 flex items-center justify-center overflow-hidden rounded-sm",
              activeFrameId === frame.id ? "border-primary" : "border-border"
            )}>
              {thumbnailsRef.current[frame.id] && (
                <img 
                  src={thumbnailsRef.current[frame.id]} 
                  alt={`Frame ${index}`} 
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
          className="w-16 h-16 border-2 border-dashed border-border rounded-sm flex items-center justify-center text-border hover:border-primary hover:text-primary transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
};

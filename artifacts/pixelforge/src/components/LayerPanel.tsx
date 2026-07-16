import React from 'react';
import { Layers, Eye, EyeOff, Lock, Unlock, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

interface LayerPanelProps {
  editor: ReturnType<typeof usePixelEditor>;
  compact?: boolean;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ editor, compact = false }) => {
  const { project, activeFrameId, activeLayerId, setActiveLayerId, setProject, saveHistory } = editor;

  const frameIndex = project.frames.findIndex(f => f.id === activeFrameId);
  if (frameIndex === -1) return null;
  const frame = project.frames[frameIndex];
  const displayLayers = [...frame.layers].reverse();

  const updateLayer = (id: string, updates: Partial<typeof frame.layers[0]>) => {
    setProject(p => {
      const newFrames = [...p.frames];
      newFrames[frameIndex] = {
        ...frame,
        layers: frame.layers.map(l => l.id === id ? { ...l, ...updates } : l)
      };
      return { ...p, frames: newFrames };
    });
  };

  const addLayer = () => {
    saveHistory();
    setProject(p => {
      const newFrames = [...p.frames];
      const newLayer = {
        id: crypto.randomUUID(),
        name: `Layer ${frame.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
        data: ''
      };
      newFrames[frameIndex] = { ...frame, layers: [...frame.layers, newLayer] };
      return { ...p, frames: newFrames };
    });
  };

  const deleteLayer = (id: string) => {
    if (frame.layers.length <= 1) return;
    saveHistory();
    setProject(p => {
      const newFrames = [...p.frames];
      const filtered = frame.layers.filter(l => l.id !== id);
      newFrames[frameIndex] = { ...frame, layers: filtered };
      return { ...p, frames: newFrames };
    });
    if (activeLayerId === id) {
      setActiveLayerId(frame.layers.find(l => l.id !== id)!.id);
    }
  };

  const moveLayer = (id: string, dir: 1 | -1) => {
    const idx = frame.layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    if (dir === 1 && idx === frame.layers.length - 1) return;
    if (dir === -1 && idx === 0) return;
    saveHistory();
    setProject(p => {
      const newFrames = [...p.frames];
      const newLayers = [...frame.layers];
      const temp = newLayers[idx];
      newLayers[idx] = newLayers[idx + dir];
      newLayers[idx + dir] = temp;
      newFrames[frameIndex] = { ...frame, layers: newLayers };
      return { ...p, frames: newFrames };
    });
  };

  return (
    <div className={cn('flex flex-col border-b border-[#111118] bg-[#0d0d12] flex-1 min-h-[200px]')}>
      <div className="flex items-center justify-between p-3 border-b border-[#111118] bg-[#0a0a0e]">
        <div className="flex items-center gap-2 text-[10px] font-pixel text-primary uppercase tracking-wider drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
          <Layers size={14} /> Layers
        </div>
        <button
          onClick={addLayer}
          className="p-1.5 hover:bg-[#111118] border border-transparent hover:border-[#1a1a24] rounded-sm text-muted-foreground hover:text-primary transition-colors"
          title="Add Layer"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 bg-[#0a0a0e]/50">
        {displayLayers.map((layer) => (
          <div
            key={layer.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded-sm text-xs border transition-all cursor-pointer group',
              activeLayerId === layer.id
                ? 'bg-primary/10 border-primary shadow-[0_0_10px_rgba(124,58,237,0.2)] text-white'
                : 'bg-[#111118] border-[#1a1a24] hover:border-[#2a1545] text-muted-foreground'
            )}
            onClick={() => setActiveLayerId(layer.id)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
              className={cn("p-1 rounded-sm hover:bg-[#1a1a24] transition-colors", layer.visible ? "text-foreground" : "text-muted-foreground/50")}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
              className={cn("p-1 rounded-sm hover:bg-[#1a1a24] transition-colors", layer.locked ? "text-destructive" : "text-muted-foreground/50")}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            
            <span className="flex-1 font-mono text-[11px] truncate select-none">{layer.name}</span>
            
            {activeLayerId === layer.id && (
              <div className="flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1); }} className="p-1 hover:bg-[#1a1a24] hover:text-primary rounded-sm transition-colors"><ArrowUp size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1); }} className="p-1 hover:bg-[#1a1a24] hover:text-primary rounded-sm transition-colors"><ArrowDown size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="p-1 hover:bg-[#1a1a24] text-muted-foreground hover:text-destructive rounded-sm transition-colors ml-1"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

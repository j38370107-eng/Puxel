import React from 'react';
import { Layers, Eye, EyeOff, Lock, Unlock, Plus, Trash2, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

interface LayerPanelProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ editor }) => {
  const { project, activeFrameId, activeLayerId, setActiveLayerId, setProject, saveHistory } = editor;

  const frameIndex = project.frames.findIndex(f => f.id === activeFrameId);
  if (frameIndex === -1) return null;
  const frame = project.frames[frameIndex];
  
  // We reverse for display so top layer is at top of list
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
    <div className="flex flex-col h-1/2 border-b border-border bg-card">
      <div className="flex items-center justify-between p-2 border-b border-border text-[10px] font-pixel text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Layers size={14} /> Layers
        </div>
        <div className="flex gap-1">
          <button onClick={addLayer} className="p-1 hover:bg-muted rounded text-foreground"><Plus size={14}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {displayLayers.map((layer) => (
          <div 
            key={layer.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded text-xs border transition-colors cursor-pointer",
              activeLayerId === layer.id ? "bg-primary/20 border-primary text-white" : "bg-muted border-transparent hover:border-muted-foreground/30 text-muted-foreground"
            )}
            onClick={() => setActiveLayerId(layer.id)}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
              className="text-muted-foreground hover:text-white"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
              className="text-muted-foreground hover:text-white"
            >
              {layer.locked ? <Lock size={14} /> : <Unlock size={14} className="opacity-50" />}
            </button>
            
            <span className="flex-1 font-mono truncate">{layer.name}</span>
            
            {activeLayerId === layer.id && (
              <div className="flex items-center gap-1 opacity-50 hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 1); }}><ArrowUp size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, -1); }}><ArrowDown size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-destructive"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

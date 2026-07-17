import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
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
  const displayLayers = [...frame.layers].reverse();

  const updateLayer = (id: string, updates: Partial<typeof frame.layers[0]>) => {
    setProject(p => {
      const nf = [...p.frames];
      nf[frameIndex] = {
        ...frame,
        layers: frame.layers.map(l => l.id === id ? { ...l, ...updates } : l),
      };
      return { ...p, frames: nf };
    });
  };

  const addLayer = () => {
    saveHistory();
    setProject(p => {
      const nf = [...p.frames];
      const newLayer = {
        id: crypto.randomUUID(),
        name: `Layer ${frame.layers.length + 1}`,
        visible: true, locked: false, opacity: 1, data: '',
      };
      nf[frameIndex] = { ...frame, layers: [...frame.layers, newLayer] };
      return { ...p, frames: nf };
    });
  };

  const deleteLayer = (id: string) => {
    if (frame.layers.length <= 1) return;
    saveHistory();
    setProject(p => {
      const nf = [...p.frames];
      const filtered = frame.layers.filter(l => l.id !== id);
      nf[frameIndex] = { ...frame, layers: filtered };
      return { ...p, frames: nf };
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
      const nf = [...p.frames];
      const nl = [...frame.layers];
      [nl[idx], nl[idx + dir]] = [nl[idx + dir], nl[idx]];
      nf[frameIndex] = { ...frame, layers: nl };
      return { ...p, frames: nf };
    });
  };

  return (
    <div className="flex flex-col">
      {/* Add layer button */}
      <div className="flex items-center justify-between px-3 py-2 bg-background/30">
        <span className="font-pixel text-[7px] text-muted-foreground uppercase tracking-wider">
          {frame.layers.length} layer{frame.layers.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={addLayer}
          className="flex items-center gap-1 px-2 py-1 text-[8px] font-pixel text-muted-foreground hover:text-primary bg-muted/30 border border-border/50 hover:border-primary/40 rounded-sm transition-colors"
        >
          <Plus size={10} /> Add
        </button>
      </div>

      {/* Layer list */}
      <div className="flex flex-col gap-px px-2 pb-2 max-h-52 overflow-y-auto">
        {displayLayers.map((layer) => (
          <div
            key={layer.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-2 border cursor-pointer group transition-all rounded-sm',
              activeLayerId === layer.id
                ? 'bg-primary/10 border-primary/40 text-foreground shadow-[0_0_8px_rgba(124,58,237,0.15)]'
                : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/20 hover:text-foreground'
            )}
            onClick={() => setActiveLayerId(layer.id)}
          >
            {/* Visibility */}
            <button
              onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
              className={cn('p-0.5 rounded-sm hover:bg-muted/40 transition-colors shrink-0',
                layer.visible ? 'text-foreground/70' : 'text-muted-foreground/30')}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>

            {/* Lock */}
            <button
              onClick={e => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
              className={cn('p-0.5 rounded-sm hover:bg-muted/40 transition-colors shrink-0',
                layer.locked ? 'text-destructive/70' : 'text-muted-foreground/30')}
            >
              {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>

            {/* Name (editable) */}
            <input
              value={layer.name}
              onChange={e => updateLayer(layer.id, { name: e.target.value })}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-transparent text-[11px] font-mono focus:outline-none min-w-0 truncate"
            />

            {/* Opacity indicator */}
            <span className={cn('text-[9px] font-mono shrink-0 tabular-nums',
              activeLayerId === layer.id ? 'text-primary/60' : 'text-muted-foreground/40'
            )}>
              {Math.round(layer.opacity * 100)}%
            </span>

            {/* Move & delete (visible on hover / active) */}
            {activeLayerId === layer.id && (
              <div className="flex items-center gap-px shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); moveLayer(layer.id, 1); }}
                  className="p-0.5 hover:bg-muted/40 hover:text-primary rounded-sm transition-colors"
                  title="Move up"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); moveLayer(layer.id, -1); }}
                  className="p-0.5 hover:bg-muted/40 hover:text-primary rounded-sm transition-colors"
                  title="Move down"
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteLayer(layer.id); }}
                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded-sm transition-colors ml-0.5"
                  title="Delete layer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Opacity slider for active layer */}
      {(() => {
        const layer = frame.layers.find(l => l.id === activeLayerId);
        if (!layer) return null;
        return (
          <div className="flex items-center gap-2 px-3 pb-2 border-t border-border/40 pt-2">
            <span className="font-pixel text-[7px] text-muted-foreground uppercase shrink-0">Opacity</span>
            <input
              type="range" min="0" max="1" step="0.01"
              value={layer.opacity}
              onChange={e => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
              className="flex-1"
            />
            <span className="font-mono text-[10px] text-foreground/60 w-8 text-right tabular-nums">
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
        );
      })()}
    </div>
  );
};

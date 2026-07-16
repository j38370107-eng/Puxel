import React, { useState } from 'react';
import { Mode } from '../types';
import { cn } from '@/lib/utils';

interface Props {
  onConfirm: (width: number, height: number, mode: Mode) => void;
  onCancel: () => void;
}

const SIZE_PRESETS = [
  { w: 16,  h: 16,  label: '16×16',   desc: 'Icon / Micro' },
  { w: 32,  h: 32,  label: '32×32',   desc: 'Character / Sprite' },
  { w: 64,  h: 64,  label: '64×64',   desc: 'Detailed Sprite' },
  { w: 128, h: 128, label: '128×128', desc: 'Scene / Boss' },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'sprite',  label: 'Sprite',   desc: 'Single character or item' },
  { id: 'tilemap', label: 'Tilemap',  desc: 'Repeatable tile / map piece' },
];

export const NewProjectDialog: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const [sizeIdx, setSizeIdx] = useState(1);        // 32×32 default
  const [mode, setMode]       = useState<Mode>('sprite');

  const { w, h } = SIZE_PRESETS[sizeIdx];

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-card border-2 border-primary max-w-md w-full p-6 shadow-[0_0_60px_rgba(172,50,50,0.25)]"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-primary text-sm uppercase mb-5 text-center">New Project</h2>

        {/* Canvas Size */}
        <div className="mb-5">
          <div className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider mb-2">Canvas Size</div>
          <div className="grid grid-cols-4 gap-2">
            {SIZE_PRESETS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSizeIdx(i)}
                className={cn(
                  'flex flex-col items-center py-2 px-1 border rounded-sm transition-colors',
                  sizeIdx === i
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
                )}
              >
                <span className="font-pixel text-[9px]">{s.label}</span>
                <span className="font-mono text-[8px] opacity-70 mt-0.5">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="mb-6">
          <div className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider mb-2">Mode</div>
          <div className="flex gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex-1 flex flex-col items-center py-2 border rounded-sm transition-colors',
                  mode === m.id
                    ? 'bg-primary/20 border-primary text-white'
                    : 'bg-muted border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                <span className="font-pixel text-[9px] uppercase">{m.label}</span>
                <span className="font-mono text-[8px] opacity-60 mt-0.5">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 font-mono text-xs border border-border text-muted-foreground hover:bg-muted rounded-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(w, h, mode)}
            className="flex-1 py-2 bg-primary text-primary-foreground font-pixel text-[10px] uppercase hover:bg-primary/90 rounded-sm transition-colors"
          >
            Create {w}×{h}
          </button>
        </div>
      </div>
    </div>
  );
};

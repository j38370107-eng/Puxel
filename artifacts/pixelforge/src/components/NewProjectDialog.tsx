import React, { useState } from 'react';
import { Mode } from '../types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Props {
  onConfirm: (width: number, height: number, mode: Mode) => void;
  onCancel: () => void;
}

const SIZE_PRESETS = [
  { w: 16,  h: 16,  label: '16×16',   desc: 'Icon / Micro', example: '●' },
  { w: 32,  h: 32,  label: '32×32',   desc: 'Sprite',       example: '◉' },
  { w: 64,  h: 64,  label: '64×64',   desc: 'Detailed',     example: '◎' },
  { w: 128, h: 128, label: '128×128', desc: 'Scene / Boss', example: '○' },
];

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'sprite',  label: 'Sprite',  desc: 'Character or item' },
  { id: 'tilemap', label: 'Tilemap', desc: 'Repeatable tile' },
  { id: 'logo',    label: 'Logo',    desc: 'Title / UI art' },
];

export const NewProjectDialog: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const [sizeIdx, setSizeIdx] = useState(1);
  const [mode, setMode]       = useState<Mode>('sprite');
  const { w, h } = SIZE_PRESETS[sizeIdx];

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-card border border-primary/30 max-w-sm w-full shadow-[0_0_60px_rgba(124,58,237,0.25)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="font-pixel text-[11px] text-primary uppercase tracking-widest glow-purple">New Canvas</h2>
          <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Size */}
          <div>
            <p className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider mb-2.5">Canvas Size</p>
            <div className="grid grid-cols-4 gap-2">
              {SIZE_PRESETS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setSizeIdx(i)}
                  className={cn(
                    'flex flex-col items-center py-3 px-1 border transition-all',
                    sizeIdx === i
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                      : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  <span className="text-[16px] mb-1">{s.example}</span>
                  <span className="font-pixel text-[7px] tracking-wide">{s.label}</span>
                  <span className="font-mono text-[8px] opacity-60 mt-0.5">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div>
            <p className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider mb-2.5">Mode</p>
            <div className="flex gap-2">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center py-3 border transition-all',
                    mode === m.id
                      ? 'bg-accent/15 border-accent/60 text-accent shadow-[0_0_8px_rgba(167,139,250,0.2)]'
                      : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-accent/30 hover:text-foreground'
                  )}
                >
                  <span className="font-pixel text-[8px] uppercase tracking-wide">{m.label}</span>
                  <span className="font-mono text-[9px] opacity-60 mt-1">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/20 border border-border/40 px-3 py-2 font-mono text-[11px] text-muted-foreground text-center">
            {w}×{h} px · {mode}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 font-mono text-[11px] border border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(w, h, mode)}
              className="flex-1 py-2.5 bg-primary text-white font-pixel text-[9px] uppercase tracking-widest hover:bg-primary/90 transition-all shadow-[0_0_14px_rgba(124,58,237,0.3)] hover:shadow-[0_0_22px_rgba(124,58,237,0.5)]"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

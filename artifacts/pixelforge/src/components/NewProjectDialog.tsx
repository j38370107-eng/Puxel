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
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#0d0d12] border border-[#2a1545] max-w-md w-full p-6 shadow-[0_0_60px_rgba(124,58,237,0.25)] rounded-sm"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-pixel text-primary text-sm uppercase mb-6 text-center tracking-widest drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">New Canvas</h2>

        {/* Canvas Size */}
        <div className="mb-6">
          <div className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider mb-3">Canvas Size</div>
          <div className="grid grid-cols-4 gap-2">
            {SIZE_PRESETS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSizeIdx(i)}
                className={cn(
                  'flex flex-col items-center py-3 px-1 border rounded-sm transition-all',
                  sizeIdx === i
                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                    : 'bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545] hover:text-foreground'
                )}
              >
                <span className="font-pixel text-[8px] tracking-wider mb-1">{s.label}</span>
                <span className="font-mono text-[9px] opacity-70 mt-0.5">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="mb-8">
          <div className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider mb-3">Mode</div>
          <div className="flex gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex-1 flex flex-col items-center py-3 border rounded-sm transition-all',
                  mode === m.id
                    ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(167,139,250,0.3)]'
                    : 'bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545] hover:text-foreground'
                )}
              >
                <span className="font-pixel text-[8px] uppercase tracking-wider mb-1">{m.label}</span>
                <span className="font-mono text-[9px] opacity-60 mt-0.5">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 font-mono text-xs border border-[#1a1a24] bg-[#111118] text-muted-foreground hover:bg-[#1a1a24] hover:text-foreground rounded-sm transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={() => onConfirm(w, h, mode)}
            className="flex-1 py-3 bg-primary text-primary-foreground font-pixel text-[10px] uppercase hover:bg-primary/90 rounded-sm transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] tracking-widest"
          >
            CREATE
          </button>
        </div>
      </div>
    </div>
  );
};

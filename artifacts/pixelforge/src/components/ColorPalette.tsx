import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

// ── Palette presets ────────────────────────────────────────────────────────
const PALETTE_PRESETS: Record<string, { label: string; colors: string[] }> = {
  blasphemous: {
    label: 'Blasphemous',
    colors: [
      '#0d0d12','#1a1025','#2a1545','#3b1c60','#522187','#7c3aed','#a78bfa','#d8b4e2',
      '#050505','#110c11','#261214','#471216','#dc2626','#ef4444','#fca5a5','#fef2f2',
      '#0b1612','#11271e','#163e2e','#1c5b40','#22c55e','#4ade80','#86efac','#dcfce7',
      '#1f160b','#3d2a15','#63401d','#8c5a27','#d97706','#f59e0b','#fcd34d','#fef3c7'
    ],
  },
  gothic: {
    label: 'Dark Gothic',
    colors: [
      '#000000','#1a1a1a','#333333','#4d4d4d','#666666','#808080','#999999','#b3b3b3',
      '#1a0505','#330a0a','#4d0f0f','#661414','#801a1a','#991f1f','#b32424','#cc2929',
      '#050a1a','#0a1433','#0f1f4d','#142966','#1a3380','#1f3d99','#2447b3','#2952cc',
      '#1a1a05','#33330a','#4d4d0f','#666614','#80801a','#99991f','#b3b324','#cccc29'
    ],
  },
  pico8: {
    label: 'PICO-8',
    colors: [
      '#000000','#1D2B53','#7E2553','#008751','#AB5236','#5F574F','#C2C3C7','#FFF1E8',
      '#FF004D','#FFA300','#FFEC27','#00E436','#29ADFF','#83769C','#FF77A8','#FFCCAA',
    ],
  },
  gameboy: {
    label: 'Game Boy',
    colors: ['#0f380f','#306230','#8bac0f','#9bbc0f'],
  },
};

interface ColorPaletteProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ editor }) => {
  const { fgColor, setFgColor, bgColor, setBgColor, project, setProject } = editor;
  const [presetKey, setPresetKey] = useState<string>('blasphemous');
  const [showPresets, setShowPresets] = useState(false);

  const handleSwap = () => { setFgColor(bgColor); setBgColor(fgColor); };

  const addColor = (color: string) => {
    if (!project.palette.includes(color))
      setProject(p => ({ ...p, palette: [...p.palette, color] }));
  };

  const applyPreset = (key: string) => {
    const preset = PALETTE_PRESETS[key];
    if (preset) {
      setProject(p => ({ ...p, palette: [...preset.colors] }));
      setPresetKey(key);
    }
    setShowPresets(false);
  };

  return (
    <div className="p-4 border-t border-[#111118] bg-[#0a0a0e] shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-pixel text-primary uppercase tracking-wider drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">Palette</div>

        <div className="relative">
          <button
            onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-1.5 text-[8px] font-pixel text-muted-foreground hover:text-foreground bg-[#111118] border border-[#1a1a24] hover:border-[#2a1545] px-2 py-1.5 rounded-sm transition-colors"
          >
            {PALETTE_PRESETS[presetKey]?.label ?? 'Custom'} <ChevronDown size={10} />
          </button>
          {showPresets && (
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-[#111118] border border-[#1a1a24] shadow-[0_0_20px_rgba(0,0,0,0.8)] min-w-[120px] rounded-sm py-1">
              {Object.entries(PALETTE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "w-full text-left px-3 py-2 font-pixel text-[8px] transition-colors",
                    presetKey === key ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-[#1a1a24] hover:text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-12 h-12 shrink-0">
          <div
            className="absolute bottom-0 right-0 w-8 h-8 rounded-sm border-2 border-[#111118] cursor-pointer shadow-md"
            style={{ backgroundColor: bgColor }}
            onClick={() => setFgColor(bgColor)}
            title="Click to use as FG"
          />
          <div className="absolute top-0 left-0 w-8 h-8 rounded-sm border-2 border-[#111118] shadow-md z-10 overflow-hidden">
            <input
              type="color"
              value={fgColor}
              onChange={e => { setFgColor(e.target.value); addColor(e.target.value); }}
              className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer opacity-0"
            />
            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: fgColor }} />
          </div>
          <button
            className="absolute top-[-6px] right-[-6px] w-5 h-5 rounded-sm bg-[#1a1a24] border border-[#2a2a35] flex items-center justify-center text-[8px] z-20 hover:bg-primary hover:text-white transition-colors"
            onClick={handleSwap}
            title="Swap FG / BG"
          >⟲</button>
        </div>

        <div className="flex-1 font-mono text-[10px] flex flex-col gap-1">
          <div className="flex justify-between items-center bg-[#111118] px-2 py-1 rounded-sm border border-[#1a1a24]">
            <span className="text-muted-foreground">FG</span>
            <span className="uppercase text-foreground">{fgColor}</span>
          </div>
          <div className="flex justify-between items-center bg-[#111118] px-2 py-1 rounded-sm border border-[#1a1a24]">
            <span className="text-muted-foreground">BG</span>
            <span className="uppercase text-foreground">{bgColor}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1 p-2 bg-[#111118] border border-[#1a1a24] rounded-sm max-h-[140px] overflow-y-auto">
        {project.palette.map((color, i) => (
          <button
            key={i}
            title={`${color}\nLeft: FG  Right: BG`}
            className={cn(
              "w-full aspect-square rounded-sm border transition-transform cursor-pointer",
              fgColor === color ? 'border-white scale-110 z-10 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-[#111118] hover:scale-110 hover:z-10 hover:border-[#1a1a24]'
            )}
            style={{ backgroundColor: color }}
            onClick={() => setFgColor(color)}
            onContextMenu={e => { e.preventDefault(); setBgColor(color); }}
          />
        ))}
        <label className="w-full aspect-square rounded-sm border border-dashed border-[#2a2a35] flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors">
          +
          <input
            type="color"
            className="sr-only"
            onChange={e => addColor(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
};

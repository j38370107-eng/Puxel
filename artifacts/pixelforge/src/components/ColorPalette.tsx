import React, { useState } from 'react';
import { ChevronDown, ArrowLeftRight } from 'lucide-react';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { cn } from '@/lib/utils';

const PALETTE_PRESETS: Record<string, { label: string; colors: string[] }> = {
  blasphemous: {
    label: 'Blasphemous',
    colors: [
      '#0d0d12','#1a1025','#2a1545','#3b1c60','#522187','#7c3aed','#a78bfa','#d8b4e2',
      '#050505','#110c11','#261214','#471216','#dc2626','#ef4444','#fca5a5','#fef2f2',
      '#0b1612','#11271e','#163e2e','#1c5b40','#22c55e','#4ade80','#86efac','#dcfce7',
      '#1f160b','#3d2a15','#63401d','#8c5a27','#d97706','#f59e0b','#fcd34d','#fef3c7',
    ],
  },
  gothic: {
    label: 'Dark Gothic',
    colors: [
      '#000000','#111111','#222222','#333333','#444444','#666666','#999999','#cccccc',
      '#1a0505','#330a0a','#4d0f0f','#661414','#800000','#990000','#cc0000','#ff2222',
      '#05051a','#0a0a33','#0f0f4d','#141466','#1a1a99','#2222cc','#5555ff','#aaaaff',
      '#1a1a05','#33330a','#4d4d0f','#666600','#999900','#cccc00','#ffff00','#ffff99',
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
    colors: ['#0f380f','#306230','#8bac0f','#9bbc0f','#000000','#333333','#666666','#ffffff'],
  },
  nes: {
    label: 'NES',
    colors: [
      '#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400',
      '#503000','#007800','#006800','#005800','#004058','#000000','#000000','#000000',
      '#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10',
      '#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#000000','#000000',
    ],
  },
};

interface ColorPaletteProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ editor }) => {
  const { fgColor, setFgColor, bgColor, setBgColor, project, setProject } = editor;
  const [presetKey, setPresetKey] = useState<string>('blasphemous');
  const [showPresets, setShowPresets]     = useState(false);

  const handleSwap = () => { setFgColor(bgColor); setBgColor(fgColor); };

  const addColor = (color: string) => {
    if (!project.palette.includes(color))
      setProject(p => ({ ...p, palette: [...p.palette, color] }));
  };

  const applyPreset = (key: string) => {
    const preset = PALETTE_PRESETS[key];
    if (preset) { setProject(p => ({ ...p, palette: [...preset.colors] })); setPresetKey(key); }
    setShowPresets(false);
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Preset selector */}
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Preset</span>
        <div className="relative">
          <button
            onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-1.5 text-[8px] font-pixel text-muted-foreground hover:text-foreground bg-muted/40 border border-border hover:border-primary/40 px-2 py-1.5 rounded-sm transition-colors"
          >
            {PALETTE_PRESETS[presetKey]?.label ?? 'Custom'} <ChevronDown size={9} />
          </button>
          {showPresets && (
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-card border border-border shadow-[0_0_20px_rgba(0,0,0,0.8)] min-w-[130px] rounded-sm py-1">
              {Object.entries(PALETTE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    'w-full text-left px-3 py-2 font-pixel text-[8px] transition-colors',
                    presetKey === key
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Color slots: FG / BG */}
      <div className="flex items-center gap-3">
        <div className="relative w-11 h-11 shrink-0">
          {/* BG swatch */}
          <div
            className="absolute bottom-0 right-0 w-8 h-8 border-2 border-card cursor-pointer shadow-md"
            style={{ backgroundColor: bgColor }}
            onClick={() => setFgColor(bgColor)}
            title="Click to use as foreground"
          />
          {/* FG swatch (color input) */}
          <div className="absolute top-0 left-0 w-8 h-8 border-2 border-foreground/20 z-10 shadow-[0_0_8px_rgba(0,0,0,0.6)] overflow-hidden">
            <input
              type="color"
              value={fgColor}
              onChange={e => { setFgColor(e.target.value); addColor(e.target.value); }}
              className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer opacity-0"
            />
            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: fgColor }} />
          </div>
          {/* Swap */}
          <button
            onClick={handleSwap}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-sm bg-card border border-border flex items-center justify-center z-20 hover:bg-primary hover:border-primary hover:text-white text-muted-foreground transition-colors"
            title="Swap FG / BG"
          >
            <ArrowLeftRight size={9} />
          </button>
        </div>

        <div className="flex-1 font-mono text-[10px] flex flex-col gap-1 min-w-0">
          <div className="flex justify-between items-center bg-muted/30 border border-border px-2 py-1 rounded-sm">
            <span className="text-muted-foreground">FG</span>
            <span className="uppercase text-foreground/80 truncate ml-2">{fgColor}</span>
          </div>
          <div className="flex justify-between items-center bg-muted/30 border border-border px-2 py-1 rounded-sm">
            <span className="text-muted-foreground">BG</span>
            <span className="uppercase text-foreground/80 truncate ml-2">{bgColor}</span>
          </div>
        </div>
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-8 gap-[3px] p-2 bg-muted/20 border border-border rounded-sm max-h-36 overflow-y-auto">
        {project.palette.map((color, i) => (
          <button
            key={i}
            title={color}
            className={cn(
              'aspect-square rounded-sm border transition-transform',
              fgColor === color
                ? 'border-white scale-110 z-10 shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                : 'border-border/50 hover:scale-110 hover:z-10 hover:border-foreground/30'
            )}
            style={{ backgroundColor: color }}
            onClick={() => setFgColor(color)}
            onContextMenu={e => { e.preventDefault(); setBgColor(color); }}
          />
        ))}
        {/* Add custom */}
        <label className="aspect-square rounded-sm border border-dashed border-border/50 flex items-center justify-center text-muted-foreground/50 hover:border-primary hover:text-primary cursor-pointer transition-colors text-xs font-bold">
          +
          <input type="color" className="sr-only" onChange={e => addColor(e.target.value)} />
        </label>
      </div>

      <p className="font-pixel text-[7px] text-muted-foreground/50 text-center">
        Left-click = FG • Right-click = BG
      </p>
    </div>
  );
};

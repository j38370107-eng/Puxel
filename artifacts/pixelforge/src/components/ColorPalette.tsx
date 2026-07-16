import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { usePixelEditor, DEFAULT_PALETTE } from '../hooks/usePixelEditor';

// ── Palette presets ────────────────────────────────────────────────────────
const PALETTE_PRESETS: Record<string, { label: string; colors: string[] }> = {
  pico8: {
    label: 'PICO-8',
    colors: [
      '#000000','#1D2B53','#7E2553','#008751','#AB5236','#5F574F','#C2C3C7','#FFF1E8',
      '#FF004D','#FFA300','#FFEC27','#00E436','#29ADFF','#83769C','#FF77A8','#FFCCAA',
    ],
  },
  nes: {
    label: 'NES',
    colors: [
      '#000000','#fcfcfc','#f8f8f8','#bcbcbc','#7c7c7c','#a8a8a8','#343434','#0000fc',
      '#0000bc','#4428bc','#940084','#a80020','#a81000','#881400','#503000','#007800',
      '#006800','#005800','#004058','#000000','#bcbcbc','#f8f8f8','#3cbcfc','#6888fc',
      '#9878f8','#f878f8','#f85898','#f87858','#fca044','#f8b800','#b8f818','#58d854',
    ],
  },
  gameboy: {
    label: 'Game Boy',
    colors: ['#0f380f','#306230','#8bac0f','#9bbc0f'],
  },
  cga: {
    label: 'CGA',
    colors: [
      '#000000','#555555','#aaaaaa','#ffffff',
      '#ff5555','#ff00ff','#ffff55','#55ff55',
      '#5555ff','#55ffff','#aa0000','#aa00aa',
      '#aa5500','#00aa00','#0000aa','#00aaaa',
    ],
  },
  endesga32: {
    label: 'Endesga 32',
    colors: [
      '#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633',
      '#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e',
      '#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466',
      '#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569',
    ],
  },
  custom: {
    label: 'Custom',
    colors: [],
  },
};

interface ColorPaletteProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ editor }) => {
  const { fgColor, setFgColor, bgColor, setBgColor, project, setProject } = editor;
  const [presetKey, setPresetKey] = useState<string>('pico8');
  const [showPresets, setShowPresets] = useState(false);

  const handleSwap = () => { setFgColor(bgColor); setBgColor(fgColor); };

  const addColor = (color: string) => {
    if (!project.palette.includes(color))
      setProject(p => ({ ...p, palette: [...p.palette, color] }));
  };

  const applyPreset = (key: string) => {
    if (key === 'custom') return;
    const preset = PALETTE_PRESETS[key];
    setProject(p => ({ ...p, palette: [...preset.colors] }));
    setPresetKey(key);
    setShowPresets(false);
  };

  return (
    <div className="p-3 border-b border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-pixel text-muted-foreground uppercase tracking-wider">Colors</div>

        {/* Preset picker */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-1 text-[8px] font-pixel text-muted-foreground hover:text-foreground bg-muted px-2 py-1 rounded-sm"
          >
            {PALETTE_PRESETS[presetKey]?.label ?? 'Preset'} <ChevronDown size={9} />
          </button>
          {showPresets && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border shadow-lg min-w-[110px]">
              {Object.entries(PALETTE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`w-full text-left px-3 py-1.5 font-pixel text-[8px] hover:bg-muted transition-colors ${presetKey === key ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FG / BG swatches */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-12 h-12 shrink-0">
          <div
            className="absolute bottom-0 right-0 w-8 h-8 rounded-sm border-2 border-background cursor-pointer"
            style={{ backgroundColor: bgColor }}
            onClick={() => setFgColor(bgColor)}
            title="Click to use as FG"
          />
          <div className="absolute top-0 left-0 w-8 h-8 rounded-sm border-2 border-background shadow-md z-10 overflow-hidden">
            <input
              type="color"
              value={fgColor}
              onChange={e => { setFgColor(e.target.value); addColor(e.target.value); }}
              className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer opacity-0"
            />
            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: fgColor }} />
          </div>
          <button
            className="absolute top-[-5px] right-[-5px] w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] z-20 hover:bg-primary"
            onClick={handleSwap}
            title="Swap FG / BG"
          >⟲</button>
        </div>

        <div className="flex-1 font-mono text-xs leading-relaxed">
          <div>FG: <span className="text-muted-foreground uppercase">{fgColor}</span></div>
          <div>BG: <span className="text-muted-foreground uppercase">{bgColor}</span></div>
        </div>
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-8 gap-1">
        {project.palette.map((color, i) => (
          <button
            key={i}
            title={`${color}\nLeft: FG  Right: BG`}
            className={`w-6 h-6 rounded-sm border transition-transform ${fgColor === color ? 'border-white scale-110 z-10' : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: color }}
            onClick={() => setFgColor(color)}
            onContextMenu={e => { e.preventDefault(); setBgColor(color); }}
          />
        ))}
        {/* Add custom color */}
        <label className="w-6 h-6 rounded-sm border border-dashed border-border flex items-center justify-center text-border hover:border-primary hover:text-primary cursor-pointer text-xs">
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

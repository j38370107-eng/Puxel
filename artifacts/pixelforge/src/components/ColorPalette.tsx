import React from 'react';
import { usePixelEditor, DEFAULT_PALETTE } from '../hooks/usePixelEditor';

interface ColorPaletteProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ editor }) => {
  const { fgColor, setFgColor, bgColor, setBgColor, project, setProject } = editor;

  const handleSwap = () => {
    setFgColor(bgColor);
    setBgColor(fgColor);
  };

  const addColor = (color: string) => {
    if (!project.palette.includes(color)) {
      setProject(p => ({ ...p, palette: [...p.palette, color] }));
    }
  };

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="text-[10px] font-pixel text-muted-foreground mb-3 uppercase tracking-wider">Colors</div>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-12 h-12">
          {/* Background color */}
          <div 
            className="absolute bottom-0 right-0 w-8 h-8 rounded-sm border-2 border-background cursor-pointer"
            style={{ backgroundColor: bgColor }}
            onClick={() => setFgColor(bgColor)} // Quick pick bg to fg
          />
          {/* Foreground color */}
          <div 
            className="absolute top-0 left-0 w-8 h-8 rounded-sm border-2 border-background shadow-md z-10 overflow-hidden"
          >
            <input 
              type="color" 
              value={fgColor}
              onChange={(e) => {
                setFgColor(e.target.value);
                addColor(e.target.value);
              }}
              className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer opacity-0"
            />
            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: fgColor }} />
          </div>
          
          {/* Swap button */}
          <button 
            className="absolute top-[-5px] right-[-5px] w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] z-20 hover:bg-primary"
            onClick={handleSwap}
          >
            ⟲
          </button>
        </div>

        <div className="flex-1 font-mono text-xs">
          <div>FG: <span className="uppercase text-muted-foreground">{fgColor}</span></div>
          <div>BG: <span className="uppercase text-muted-foreground">{bgColor}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1">
        {project.palette.map((color, i) => (
          <button
            key={i}
            className={`w-6 h-6 rounded-sm border ${fgColor === color ? 'border-white scale-110 z-10' : 'border-transparent'}`}
            style={{ backgroundColor: color }}
            onClick={() => setFgColor(color)}
            onContextMenu={(e) => {
              e.preventDefault();
              setBgColor(color);
            }}
            title={`Left click: FG, Right click: BG\n${color}`}
          />
        ))}
      </div>
    </div>
  );
};

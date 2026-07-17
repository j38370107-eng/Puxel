import React from 'react';
import {
  Pencil, Eraser, PaintBucket, Pipette, Slash,
  Square, Circle, Stamp, Wand, MousePointer2, Move,
  ZoomIn, ZoomOut, Maximize, Grid, Layers as OnionIcon,
} from 'lucide-react';
import { Tool } from '../types';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editor: ReturnType<typeof usePixelEditor>;
  onHumanize: () => void;
  layout?: 'vertical' | 'horizontal';
}

const BRUSH_SIZES = [1, 2, 3, 4, 6];

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onHumanize, layout = 'vertical' }) => {
  const {
    currentTool, setCurrentTool,
    brushSize, setBrushSize,
    project, zoom, setZoom,
    showGrid, setShowGrid,
    onionSkin, setOnionSkin,
  } = editor;

  const isH = layout === 'horizontal';

  const btn = (active: boolean) => cn(
    'flex items-center justify-center rounded-sm border transition-all duration-100 shrink-0',
    isH ? 'w-10 h-10' : 'w-9 h-9',
    active
      ? 'bg-primary/20 text-primary border-primary/60 shadow-[0_0_10px_rgba(124,58,237,0.4),inset_0_0_8px_rgba(124,58,237,0.15)]'
      : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/40 hover:text-foreground active:bg-muted/60'
  );

  const renderTool = (id: Tool, Icon: React.FC<any>, label: string, shortcut?: string) => (
    <Tooltip key={id}>
      <TooltipTrigger asChild>
        <button onClick={() => setCurrentTool(id)} className={btn(currentTool === id)}>
          <Icon size={16} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] bg-card border-primary/20 flex items-center gap-2">
        {label} {shortcut && <kbd className="bg-primary/15 text-primary px-1 rounded text-[7px]">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );

  const renderAction = (Icon: React.FC<any>, label: string, onClick: () => void, active?: boolean) => (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        <button onClick={onClick} className={btn(!!active)}>
          <Icon size={15} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] bg-card border-primary/20">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  const fitCanvas = () => {
    const el = document.querySelector('.canvas-area');
    if (!el) return;
    const { width: vw, height: vh } = el.getBoundingClientRect();
    setZoom(Math.max(1, Math.min(32,
      Math.min(Math.floor((vw - 40) / project.width), Math.floor((vh - 40) / project.height))
    )));
  };

  const Sep = () => (
    <div className={cn('bg-border/60 shrink-0 rounded-full', isH ? 'w-px h-5 mx-1' : 'h-px w-5 my-1')} />
  );

  return (
    <div className={cn(
      'flex items-center',
      isH
        ? 'flex-row px-2 h-full gap-1 overflow-x-auto flex-wrap py-2 content-start'
        : 'flex-col gap-1 p-2 items-center py-3 h-full overflow-y-auto'
    )}>
      {/* Draw group */}
      {renderTool('pencil',     Pencil,       'Pencil',      'B')}
      {renderTool('eraser',     Eraser,       'Eraser',      'E')}
      {renderTool('eyedropper', Pipette,      'Eyedropper',  'I')}
      <Sep />

      {/* Fill */}
      {renderTool('fill',  PaintBucket, 'Flood Fill', 'G')}
      <Sep />

      {/* Shapes */}
      {renderTool('line',    Slash,  'Line',      'L')}
      {renderTool('rect',    Square, 'Rectangle', 'R')}
      {renderTool('ellipse', Circle, 'Ellipse',   'O')}
      <Sep />

      {/* Selection */}
      {renderTool('select', MousePointer2, 'Select', 'V')}
      {renderTool('move',   Move,          'Move',   'M')}
      {project.mode === 'tilemap' && (
        <>
          <Sep />
          {renderTool('stamp', Stamp, 'Tile Stamp', 'S')}
        </>
      )}

      <Sep />

      {/* View */}
      {renderAction(ZoomIn,    'Zoom In (+)',    () => setZoom(z => Math.min(32, z + 1)))}
      {renderAction(ZoomOut,   'Zoom Out (-)',   () => setZoom(z => Math.max(1,  z - 1)))}
      {renderAction(Maximize,  'Fit Canvas',     fitCanvas)}
      {renderAction(Grid,      showGrid ? 'Hide Grid' : 'Show Grid', () => setShowGrid(!showGrid), showGrid)}
      {renderAction(OnionIcon, 'Onion Skin',     () => setOnionSkin(!onionSkin), onionSkin)}

      {/* Spacer */}
      <div className={cn('shrink-0', isH ? 'w-2' : 'flex-1 min-h-[8px]')} />

      {/* Brush sizes */}
      {!isH && (
        <div className="flex flex-col items-center w-full bg-muted/30 border border-border/50 rounded-sm p-1.5 gap-1.5">
          <span className="font-pixel text-[6px] text-muted-foreground uppercase tracking-wider">Size</span>
          {BRUSH_SIZES.map(size => {
            const dim = Math.min(size * 2 + 2, 14);
            return (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                title={`${size}px brush`}
                className={cn(
                  'w-8 h-6 flex items-center justify-center rounded-sm transition-colors',
                  brushSize === size ? 'bg-muted/60' : 'hover:bg-muted/30'
                )}
              >
                <div
                  className={cn('rounded-full transition-all', brushSize === size
                    ? 'bg-primary shadow-[0_0_6px_rgba(124,58,237,0.7)]'
                    : 'bg-muted-foreground/40')}
                  style={{ width: dim, height: dim }}
                />
              </button>
            );
          })}
        </div>
      )}

      <Sep />

      {/* Humanize */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onHumanize}
            className={cn(
              btn(false),
              'bg-accent/10 text-accent border-accent/25 hover:bg-accent/20 hover:border-accent/60 hover:shadow-[0_0_14px_rgba(167,139,250,0.5)]'
            )}
          >
            <Wand size={16} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] bg-card border-primary/20">
          Humanize (add hand-crafted imperfections)
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

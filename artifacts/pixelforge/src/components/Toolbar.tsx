import React from 'react';
import {
  Pencil, Eraser, PaintBucket, Pipette, Slash,
  Square, Circle, Stamp, Wand, MousePointer2, Move,
  ZoomIn, ZoomOut, Maximize, Grid, Layers as OnionIcon
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
    onionSkin, setOnionSkin
  } = editor;

  const isH = layout === 'horizontal';
  const btnBase = cn(
    'flex items-center justify-center rounded-sm transition-colors border shrink-0',
    isH ? 'w-10 h-10' : 'w-10 h-10',
  );

  const activeClass = 'bg-primary/20 text-primary border-primary shadow-[0_0_10px_rgba(124,58,237,0.4),inset_0_0_10px_rgba(124,58,237,0.2)]';
  const inactiveClass = 'bg-transparent text-muted-foreground border-transparent hover:bg-[#1a1a24] hover:text-foreground active:bg-[#111118]';

  const renderTool = (id: Tool, Icon: React.FC<any>, label: string, shortcut?: string) => (
    <Tooltip key={id}>
      <TooltipTrigger asChild>
        <button
          data-testid={`tool-${id}`}
          onClick={() => setCurrentTool(id)}
          className={cn(btnBase, currentTool === id ? activeClass : inactiveClass)}
        >
          <Icon size={18} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] flex items-center gap-2 bg-[#1a1a24] border-[#2a1545]">
        {label} {shortcut && <span className="text-primary bg-primary/10 px-1 rounded">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );

  const renderAction = (Icon: React.FC<any>, label: string, onClick: () => void, active?: boolean) => (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(btnBase, active ? activeClass : inactiveClass)}
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] bg-[#1a1a24] border-[#2a1545]">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  const Separator = () => (
    <div className={cn('bg-[#1a1a24] shrink-0', isH ? 'w-[1px] h-6 mx-1' : 'w-6 h-[1px] my-1')} />
  );

  const fitCanvas = () => {
    const container = document.querySelector('.pixel-canvas-area');
    if (!container) return;
    const { width: vw, height: vh } = container.getBoundingClientRect();
    setZoom(Math.max(1, Math.min(32, Math.min(Math.floor(vw / project.width), Math.floor(vh / project.height)))));
  };

  return (
    <div className={cn(
      'flex items-center',
      isH
        ? 'flex-row px-2 h-full gap-1 overflow-x-auto'
        : 'flex-col gap-1.5 p-2 w-[56px] items-center py-4 h-full overflow-y-auto'
    )}>
      {/* Draw */}
      {renderTool('pencil', Pencil, 'Pencil', 'B')}
      {renderTool('eraser', Eraser, 'Eraser', 'E')}
      {renderTool('eyedropper', Pipette, 'Eyedropper', 'I')}
      
      <Separator />
      
      {/* Fill */}
      {renderTool('fill', PaintBucket, 'Flood Fill', 'G')}
      
      <Separator />

      {/* Shapes */}
      {renderTool('line', Slash, 'Line', 'L')}
      {renderTool('rect', Square, 'Rectangle', 'R')}
      {renderTool('ellipse', Circle, 'Ellipse', 'O')}
      
      <Separator />

      {/* Selection */}
      {renderTool('select', MousePointer2, 'Select', 'V')}
      {renderTool('move', Move, 'Move Layer', 'M')}

      {project.mode === 'tilemap' && (
        <>
          <Separator />
          {renderTool('stamp', Stamp, 'Tile Stamp', 'S')}
        </>
      )}

      <Separator />

      {/* View / Grid controls */}
      {renderAction(ZoomIn, 'Zoom In', () => setZoom(z => Math.min(32, z + 1)))}
      {renderAction(ZoomOut, 'Zoom Out', () => setZoom(z => Math.max(1, z - 1)))}
      {renderAction(Maximize, 'Fit Canvas', fitCanvas)}
      {renderAction(Grid, 'Toggle Grid', () => setShowGrid(!showGrid), showGrid)}
      {renderAction(OnionIcon, 'Toggle Onion Skin', () => setOnionSkin(!onionSkin), onionSkin)}

      <div className={cn('flex-1', isH ? 'min-w-[10px]' : 'min-h-[10px]')} />

      {/* Brush Size */}
      <div className={cn(
        "flex items-center justify-center bg-[#111118] border border-[#1a1a24] rounded-sm p-1 gap-1",
        isH ? "flex-row" : "flex-col w-full py-2"
      )}>
        {!isH && <span className="font-pixel text-[6px] text-muted-foreground mb-1">SIZE</span>}
        {BRUSH_SIZES.map(size => {
          const dim = Math.min(size * 2 + 2, 14);
          return (
            <div
              key={size}
              onClick={() => setBrushSize(size)}
              title={`${size}px brush`}
              className={cn(
                'rounded-full cursor-pointer transition-all flex items-center justify-center',
                isH ? 'w-6 h-6' : 'w-8 h-6',
                brushSize === size ? 'bg-[#1a1a24]' : 'hover:bg-[#1a1a24]/50'
              )}
            >
              <div 
                className={cn(
                  'rounded-full transition-all',
                  brushSize === size
                    ? 'bg-primary shadow-[0_0_8px_rgba(124,58,237,0.8)]'
                    : 'bg-muted-foreground/40'
                )}
                style={{ width: dim, height: dim }}
              />
            </div>
          );
        })}
      </div>

      <Separator />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="tool-humanize"
            onClick={onHumanize}
            className={cn(
              btnBase,
              'bg-primary/10 text-primary border-primary/30 hover:bg-primary hover:text-white hover:border-primary hover:shadow-[0_0_15px_rgba(124,58,237,0.6)] transition-all'
            )}
          >
            <Wand size={18} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] bg-[#1a1a24] border-[#2a1545]">
          Humanize (Add jitter)
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

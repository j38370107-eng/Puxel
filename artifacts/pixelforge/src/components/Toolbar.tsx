import React from 'react';
import {
  Pencil, Eraser, PaintBucket, Pipette, Slash,
  Square, Circle, Stamp, Wand, MousePointer2, Move
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
  const { currentTool, setCurrentTool, brushSize, setBrushSize, project } = editor;

  const tools: { id: Tool; icon: React.FC<any>; label: string; shortcut: string }[] = [
    { id: 'pencil',     icon: Pencil,        label: 'Pencil',      shortcut: 'B' },
    { id: 'eraser',     icon: Eraser,        label: 'Eraser',      shortcut: 'E' },
    { id: 'fill',       icon: PaintBucket,   label: 'Flood Fill',  shortcut: 'G' },
    { id: 'eyedropper', icon: Pipette,       label: 'Eyedropper',  shortcut: 'I' },
    { id: 'line',       icon: Slash,         label: 'Line',        shortcut: 'L' },
    { id: 'rect',       icon: Square,        label: 'Rectangle',   shortcut: 'R' },
    { id: 'ellipse',    icon: Circle,        label: 'Ellipse',     shortcut: 'O' },
    { id: 'select',     icon: MousePointer2, label: 'Select',      shortcut: 'V' },
    { id: 'move',       icon: Move,          label: 'Move Layer',  shortcut: 'M' },
  ];

  if (project.mode === 'tilemap') {
    tools.push({ id: 'stamp', icon: Stamp, label: 'Tile Stamp', shortcut: 'S' });
  }

  const isH = layout === 'horizontal';
  const btnBase = cn(
    'flex items-center justify-center rounded-sm transition-colors border shrink-0',
    isH ? 'w-10 h-10' : 'w-10 h-10',
  );

  const brushDot = (size: number) => {
    const dim = Math.min(size * 3, 16);
    return (
      <div
        key={size}
        onClick={() => setBrushSize(size)}
        title={`${size}px brush`}
        className={cn(
          'rounded-sm cursor-pointer transition-all',
          brushSize === size
            ? 'bg-primary shadow-[0_0_6px_rgba(172,50,50,0.7)]'
            : 'bg-muted-foreground/40 hover:bg-muted-foreground/70'
        )}
        style={{ width: dim, height: dim }}
      />
    );
  };

  return (
    <div className={cn(
      'flex items-center gap-1',
      isH
        ? 'flex-row px-2 h-full'
        : 'flex-col gap-1.5 p-2 bg-card border-r border-border w-16 items-center py-4 overflow-y-auto'
    )}>
      {tools.map(tool => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <button
              data-testid={`tool-${tool.id}`}
              onClick={() => setCurrentTool(tool.id)}
              className={cn(
                btnBase,
                currentTool === tool.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(172,50,50,0.5)]'
                  : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground active:bg-muted/60'
              )}
            >
              <tool.icon size={18} strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px] flex items-center gap-2">
            {tool.label} <span className="text-muted-foreground bg-muted px-1 rounded">{tool.shortcut}</span>
          </TooltipContent>
        </Tooltip>
      ))}

      <div className={cn('bg-border shrink-0', isH ? 'w-[1px] h-8 mx-1' : 'w-8 h-[1px] my-1')} />

      {/* Brush Size */}
      {!isH && (
        <div className="flex flex-col items-center gap-1.5 w-full">
          <span className="font-pixel text-[7px] text-muted-foreground uppercase">Size</span>
          <div className="flex flex-col items-center gap-1.5">
            {BRUSH_SIZES.map(brushDot)}
          </div>
        </div>
      )}
      {isH && (
        <div className="flex items-center gap-1.5 px-1" title="Brush Size">
          {BRUSH_SIZES.map(brushDot)}
        </div>
      )}

      <div className={cn('bg-border shrink-0', isH ? 'w-[1px] h-8 mx-1' : 'w-8 h-[1px] my-1')} />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="tool-humanize"
            onClick={onHumanize}
            className={cn(
              'flex items-center justify-center rounded-sm transition-colors border bg-accent/20 text-accent border-accent/30 hover:bg-accent hover:text-white active:opacity-80 shrink-0',
              isH ? 'w-10 h-10' : 'w-10 h-10'
            )}
          >
            <Wand size={18} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={isH ? 'top' : 'right'} className="font-pixel text-[8px]">
          Humanize
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

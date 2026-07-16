import React from 'react';
import { Pencil, Eraser, PaintBucket, Pipette, Slash, Square, Circle, Stamp, Wand2, Wand } from 'lucide-react';
import { Tool } from '../types';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editor: ReturnType<typeof usePixelEditor>;
  onHumanize: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editor, onHumanize }) => {
  const { currentTool, setCurrentTool, project } = editor;

  const tools: { id: Tool; icon: React.FC<any>; label: string; shortcut: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'B' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
    { id: 'fill', icon: PaintBucket, label: 'Flood Fill', shortcut: 'G' },
    { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', shortcut: 'I' },
    { id: 'line', icon: Slash, label: 'Line', shortcut: 'L' },
    { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
    { id: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'O' },
  ];

  if (project.mode === 'tilemap') {
    tools.push({ id: 'stamp', icon: Stamp, label: 'Tile Stamp', shortcut: 'S' });
  }

  return (
    <div className="flex flex-col gap-2 p-2 bg-card border-r border-border w-16 items-center py-4">
      {tools.map(tool => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCurrentTool(tool.id)}
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-sm transition-colors border",
                currentTool === tool.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_rgba(172,50,50,0.5)]" 
                  : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <tool.icon size={20} strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-pixel text-[8px] flex items-center gap-2">
            {tool.label} <span className="text-muted-foreground bg-muted px-1 rounded">{tool.shortcut}</span>
          </TooltipContent>
        </Tooltip>
      ))}

      <div className="w-8 h-[1px] bg-border my-2" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onHumanize}
            className="w-10 h-10 flex items-center justify-center rounded-sm transition-colors border bg-accent/20 text-accent border-accent/30 hover:bg-accent hover:text-white"
          >
            <Wand size={20} strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-pixel text-[8px]">
          Humanize (Add imperfections)
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

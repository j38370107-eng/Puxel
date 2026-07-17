import React from 'react';
import { cn } from '@/lib/utils';
import { Tool } from '../types';

interface StatusBarProps {
  cursorPos: { x: number; y: number } | null;
  zoom: number;
  canvasSize: { w: number; h: number };
  activeTool: Tool;
  fgColor: string;
  bgColor: string;
  frameIndex: number;
  totalFrames: number;
  layerName: string;
}

const TOOL_NAMES: Record<Tool, string> = {
  pencil: 'Pencil',
  eraser: 'Eraser',
  fill: 'Flood Fill',
  eyedropper: 'Eyedropper',
  line: 'Line',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  select: 'Select',
  move: 'Move',
  stamp: 'Stamp',
};

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorPos, zoom, canvasSize, activeTool,
  fgColor, bgColor, frameIndex, totalFrames, layerName,
}) => {
  return (
    <div
      className="h-[var(--statusbar-h)] bg-[#06060d] panel-border-t flex items-center px-3 gap-4 shrink-0 select-none overflow-hidden"
      style={{ fontSize: '9px', fontFamily: 'var(--app-font-mono)' }}
    >
      {/* Cursor */}
      <span className="text-muted-foreground shrink-0">
        {cursorPos
          ? <><span className="text-foreground/70">{cursorPos.x},{cursorPos.y}</span> px</>
          : <span className="opacity-40">— , —</span>
        }
      </span>

      <Divider />

      {/* Canvas size */}
      <span className="text-muted-foreground shrink-0">
        <span className="text-foreground/70">{canvasSize.w}×{canvasSize.h}</span>
      </span>

      <Divider />

      {/* Zoom */}
      <span className="text-muted-foreground shrink-0">
        <span className="text-foreground/70">{zoom}×</span> zoom
      </span>

      <Divider />

      {/* Tool */}
      <span className="text-muted-foreground shrink-0 hidden sm:block">
        <span className="text-accent/80">{TOOL_NAMES[activeTool]}</span>
      </span>

      <Divider className="hidden sm:block" />

      {/* Layer */}
      <span className="text-muted-foreground shrink-0 hidden md:block truncate max-w-[120px]">
        Layer: <span className="text-foreground/70">{layerName}</span>
      </span>

      <Divider className="hidden md:block" />

      {/* Frame */}
      <span className="text-muted-foreground shrink-0 hidden md:block">
        Frame: <span className="text-foreground/70">{frameIndex + 1}/{totalFrames}</span>
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Color swatches */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className="w-3.5 h-3.5 border border-white/20 rounded-sm"
          style={{ backgroundColor: fgColor }}
          title={`Foreground: ${fgColor}`}
        />
        <div
          className="w-3.5 h-3.5 border border-white/10 rounded-sm"
          style={{ backgroundColor: bgColor }}
          title={`Background: ${bgColor}`}
        />
      </div>
    </div>
  );
};

const Divider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('w-px h-3 bg-border/50 shrink-0', className)} />
);

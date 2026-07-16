import React, { useState } from 'react';
import { Download, Image as ImageIcon, Layers, Film } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { encodeGif } from '../lib/gifEncoder';
import { toast } from 'sonner';

interface ExportDialogProps {
  editor: ReturnType<typeof usePixelEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ editor, open, onOpenChange }) => {
  const { project, activeFrameId } = editor;
  const [scale, setScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const getCompositeCanvas = async (frameId: string, exportScale: number = 1): Promise<HTMLCanvasElement> => {
    const frame = project.frames.find(f => f.id === frameId);
    const canvas = document.createElement('canvas');
    canvas.width = project.width * exportScale;
    canvas.height = project.height * exportScale;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    if (!frame) return canvas;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = project.width;
    tempCanvas.height = project.height;
    const tCtx = tempCanvas.getContext('2d')!;

    for (const layer of [...frame.layers].reverse()) {
      if (!layer.visible || !layer.data) continue;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => {
          tCtx.globalAlpha = layer.opacity;
          tCtx.drawImage(img, 0, 0);
          resolve();
        };
        img.src = layer.data;
      });
    }

    ctx.drawImage(tempCanvas, 0, 0, project.width, project.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const downloadURL = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const exportPNG = async () => {
    setIsExporting(true);
    try {
      const canvas = await getCompositeCanvas(activeFrameId, scale);
      downloadURL(canvas.toDataURL('image/png'), `${project.name}.png`);
      toast.success('Exported PNG');
    } finally {
      setIsExporting(false);
    }
  };

  const exportSpritesheet = async () => {
    setIsExporting(true);
    try {
      const w = project.width * scale;
      const h = project.height * scale;
      const canvas = document.createElement('canvas');
      canvas.width = w * project.frames.length;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      for (let i = 0; i < project.frames.length; i++) {
        const frameCanvas = await getCompositeCanvas(project.frames[i].id, scale);
        ctx.drawImage(frameCanvas, i * w, 0);
      }
      downloadURL(canvas.toDataURL('image/png'), `${project.name}_spritesheet.png`);
      toast.success('Exported Spritesheet');
    } finally {
      setIsExporting(false);
    }
  };

  const exportGIF = async () => {
    setIsExporting(true);
    try {
      const frames = [];
      for (const f of project.frames) {
        const c = await getCompositeCanvas(f.id, scale);
        frames.push({ dataUrl: c.toDataURL('image/png'), duration: f.duration || 100 });
      }
      const gifUrl = await encodeGif(frames, project.width * scale, project.height * scale);
      downloadURL(gifUrl, `${project.name}.gif`);
      toast.success('Exported GIF');
    } catch (e) {
      toast.error('GIF Export failed. Check console for details.');
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
    downloadURL(dataStr, `${project.name}.pxf`);
    toast.success('Exported Project JSON');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground font-sans rounded-none">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary uppercase">
            Export Options
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-muted-foreground">Export Scale ({scale}x)</label>
            <div className="flex gap-2">
              {[1, 2, 4, 8, 16].map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`flex-1 py-1 font-mono text-xs border ${scale === s ? 'bg-primary border-primary text-white' : 'bg-muted border-transparent text-muted-foreground'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Result size: {project.width * scale} x {project.height * scale}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={exportPNG} disabled={isExporting}
              className="bg-muted hover:bg-muted/80 border border-border p-4 flex flex-col items-center gap-2 justify-center transition-colors"
            >
              <ImageIcon size={24} className="text-primary" />
              <span className="font-pixel text-[8px] uppercase">Current Frame (PNG)</span>
            </button>
            <button 
              onClick={exportSpritesheet} disabled={isExporting}
              className="bg-muted hover:bg-muted/80 border border-border p-4 flex flex-col items-center gap-2 justify-center transition-colors"
            >
              <Layers size={24} className="text-secondary" />
              <span className="font-pixel text-[8px] uppercase">Sprite Sheet</span>
            </button>
            <button 
              onClick={exportGIF} disabled={isExporting}
              className="bg-muted hover:bg-muted/80 border border-border p-4 flex flex-col items-center gap-2 justify-center transition-colors"
            >
              <Film size={24} className="text-accent" />
              <span className="font-pixel text-[8px] uppercase">Animated GIF</span>
            </button>
            <button 
              onClick={exportJSON} disabled={isExporting}
              className="bg-muted hover:bg-muted/80 border border-border p-4 flex flex-col items-center gap-2 justify-center transition-colors"
            >
              <Download size={24} className="text-foreground" />
              <span className="font-pixel text-[8px] uppercase">Project (.PXF)</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

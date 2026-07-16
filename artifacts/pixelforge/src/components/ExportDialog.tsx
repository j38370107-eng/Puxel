import React, { useState } from 'react';
import { Download, Image as ImageIcon, Layers, Film } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { encodeGif } from '../lib/gifEncoder';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      <DialogContent className="sm:max-w-[425px] bg-[#0d0d12] border-[#2a1545] text-foreground font-sans rounded-none shadow-[0_0_50px_rgba(124,58,237,0.15)]">
        <DialogHeader>
          <DialogTitle className="font-pixel text-[12px] text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
            Export Ritual
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="flex flex-col gap-3">
            <label className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider">Scale ({scale}x)</label>
            <div className="flex gap-2">
              {[1, 2, 4, 8, 16].map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={cn(
                    "flex-1 py-1.5 font-mono text-[10px] border rounded-sm transition-all",
                    scale === s 
                      ? "bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(124,58,237,0.3)]" 
                      : "bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545] hover:text-foreground"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1 text-center bg-[#111118] border border-[#1a1a24] py-1 rounded-sm">
              Resolution: <span className="text-foreground">{project.width * scale} × {project.height * scale}</span> px
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={exportPNG} disabled={isExporting}
              className="group bg-[#111118] hover:bg-primary/10 border border-[#1a1a24] hover:border-primary/50 p-4 flex flex-col items-center gap-3 justify-center transition-all rounded-sm"
            >
              <ImageIcon size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-pixel text-[8px] uppercase text-muted-foreground group-hover:text-primary transition-colors">Current Frame (PNG)</span>
            </button>
            <button 
              onClick={exportSpritesheet} disabled={isExporting}
              className="group bg-[#111118] hover:bg-primary/10 border border-[#1a1a24] hover:border-primary/50 p-4 flex flex-col items-center gap-3 justify-center transition-all rounded-sm"
            >
              <Layers size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-pixel text-[8px] uppercase text-muted-foreground group-hover:text-primary transition-colors">Sprite Sheet</span>
            </button>
            <button 
              onClick={exportGIF} disabled={isExporting}
              className="group bg-[#111118] hover:bg-primary/10 border border-[#1a1a24] hover:border-primary/50 p-4 flex flex-col items-center gap-3 justify-center transition-all rounded-sm"
            >
              <Film size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-pixel text-[8px] uppercase text-muted-foreground group-hover:text-primary transition-colors">Animated GIF</span>
            </button>
            <button 
              onClick={exportJSON} disabled={isExporting}
              className="group bg-[#111118] hover:bg-primary/10 border border-[#1a1a24] hover:border-primary/50 p-4 flex flex-col items-center gap-3 justify-center transition-all rounded-sm"
            >
              <Download size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-pixel text-[8px] uppercase text-muted-foreground group-hover:text-primary transition-colors">Project (.PXF)</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

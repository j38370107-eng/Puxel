import React, { useState } from 'react';
import { Download, Image as ImageIcon, Layers, Film, FileJson, X } from 'lucide-react';
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
  const [scale, setScale]           = useState(4);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress]       = useState('');

  const getCompositeCanvas = async (frameId: string, s: number): Promise<HTMLCanvasElement> => {
    const frame = project.frames.find(f => f.id === frameId);
    const canvas = document.createElement('canvas');
    canvas.width  = project.width  * s;
    canvas.height = project.height * s;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    if (!frame) return canvas;
    const temp = document.createElement('canvas');
    temp.width  = project.width;
    temp.height = project.height;
    const tCtx = temp.getContext('2d')!;
    for (const layer of [...frame.layers].reverse()) {
      if (!layer.visible || !layer.data) continue;
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => { tCtx.globalAlpha = layer.opacity; tCtx.drawImage(img, 0, 0); resolve(); };
        img.onerror = () => resolve();
        img.src = layer.data;
      });
    }
    ctx.drawImage(temp, 0, 0, project.width, project.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const download = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  const exportPNG = async () => {
    setIsExporting(true); setProgress('Rendering frame...');
    try {
      const canvas = await getCompositeCanvas(activeFrameId, scale);
      download(canvas.toDataURL('image/png'), `${project.name}.png`);
      toast.success('PNG exported!');
    } catch { toast.error('Export failed'); }
    finally { setIsExporting(false); setProgress(''); }
  };

  const exportSpritesheet = async () => {
    setIsExporting(true);
    try {
      const w = project.width * scale;
      const h = project.height * scale;
      const canvas = document.createElement('canvas');
      canvas.width  = w * project.frames.length;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      for (let i = 0; i < project.frames.length; i++) {
        setProgress(`Rendering frame ${i + 1} / ${project.frames.length}...`);
        const fc = await getCompositeCanvas(project.frames[i].id, scale);
        ctx.drawImage(fc, i * w, 0);
      }
      download(canvas.toDataURL('image/png'), `${project.name}_sheet.png`);
      toast.success('Sprite sheet exported!');
    } catch { toast.error('Export failed'); }
    finally { setIsExporting(false); setProgress(''); }
  };

  const exportGIF = async () => {
    setIsExporting(true); setProgress('Encoding GIF...');
    try {
      const frames = [];
      for (let i = 0; i < project.frames.length; i++) {
        setProgress(`Rendering frame ${i + 1} / ${project.frames.length}...`);
        const c = await getCompositeCanvas(project.frames[i].id, scale);
        frames.push({ dataUrl: c.toDataURL('image/png'), duration: project.frames[i].duration || 100 });
      }
      const url = await encodeGif(frames, project.width * scale, project.height * scale);
      download(url, `${project.name}.gif`);
      toast.success('GIF exported!');
    } catch { toast.error('GIF export failed'); }
    finally { setIsExporting(false); setProgress(''); }
  };

  const exportJSON = () => {
    const data = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    download(data, `${project.name}.pxf`);
    toast.success('Project JSON exported!');
  };

  const exportOpts = [
    { icon: ImageIcon, label: 'Current Frame', sub: 'PNG · single frame', onClick: exportPNG },
    { icon: Layers,    label: 'Sprite Sheet',  sub: `PNG · ${project.frames.length} frame${project.frames.length !== 1 ? 's' : ''} horizontal`, onClick: exportSpritesheet },
    { icon: Film,      label: 'Animated GIF',  sub: `GIF · ${project.frames.length} frame${project.frames.length !== 1 ? 's' : ''}`, onClick: exportGIF },
    { icon: FileJson,  label: 'Project File',  sub: '.pxf JSON — full save', onClick: exportJSON },
  ];

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-primary/30 text-foreground font-sans rounded-none shadow-[0_0_60px_rgba(124,58,237,0.2)]">
        <DialogHeader>
          <DialogTitle className="font-pixel text-[11px] text-primary uppercase tracking-widest glow-purple flex items-center gap-2">
            <Download size={13} /> Export
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Scale selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Scale</span>
              <span className="font-mono text-[10px] text-foreground/60">
                → {project.width * scale} × {project.height * scale} px
              </span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 4, 8, 16].map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={cn(
                    'flex-1 py-2 font-pixel text-[8px] border transition-all',
                    scale === s
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                      : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Export options */}
          <div className="grid grid-cols-2 gap-2">
            {exportOpts.map(opt => (
              <button
                key={opt.label}
                onClick={opt.onClick}
                disabled={isExporting}
                className="group flex flex-col items-start gap-2 p-3 bg-muted/20 border border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-40"
              >
                <opt.icon size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                <div>
                  <p className="font-pixel text-[8px] text-foreground/80 group-hover:text-primary transition-colors">{opt.label}</p>
                  <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Progress */}
          {isExporting && progress && (
            <div className="flex items-center gap-2 text-[9px] font-pixel text-primary animate-pulse bg-primary/10 border border-primary/20 px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              {progress}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

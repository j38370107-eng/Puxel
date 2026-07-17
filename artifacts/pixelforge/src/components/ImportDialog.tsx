import React, { useRef, useState } from 'react';
import { Upload, Sparkles, RefreshCcw, FileJson, Image as ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportDialogProps {
  editor: ReturnType<typeof usePixelEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STYLE_PRESETS = [
  { id: 'blasphemous', label: 'Blasphemous' },
  { id: 'retro8bit',   label: 'Retro 8-bit' },
  { id: '16bit',       label: '16-bit' },
  { id: 'gothic',      label: 'Gothic' },
  { id: 'cyberpunk',   label: 'Cyberpunk' },
];

function pixelateImage(src: string, targetW: number, targetH: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const s = Math.min(targetW / img.width, targetH / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = src;
  });
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ editor, open, onOpenChange }) => {
  const { project, updateLayerData, activeFrameId, activeLayerId, saveHistory, setProject } = editor;
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [useAI, setUseAI]           = useState(false);
  const [prompt, setPrompt]         = useState('');
  const [styleId, setStyleId]       = useState('blasphemous');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver]     = useState(false);

  const processImageFile = async (file: File) => {
    if (file.name.endsWith('.pxf') || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.frames && data.width) {
            setProject(data);
            toast.success('Project imported!');
            onOpenChange(false);
          } else {
            toast.error('Invalid project file');
          }
        } catch { toast.error('Failed to parse project file'); }
      };
      reader.readAsText(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image or .pxf file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async ev => {
      const base64Full = ev.target?.result as string;
      const base64Data = base64Full.split(',')[1];
      saveHistory();

      if (useAI) {
        setIsProcessing(true);
        try {
          const payload: Record<string, unknown> = {
            imageBase64: base64Data,
            style: styleId,
            width: project.width,
            height: project.height,
          };
          if (prompt.trim()) payload.prompt = prompt;
          const res = await fetch('/api/ai/enhance-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error('AI Enhancement failed');
          const { frames } = await res.json();
          if (frames?.length) {
            const pixelated = await pixelateImage('data:image/png;base64,' + frames[0], project.width, project.height);
            updateLayerData(activeFrameId, activeLayerId, pixelated);
            toast.success('AI Enhanced image imported!');
            onOpenChange(false);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'AI Enhancement failed';
          toast.error(msg);
        } finally {
          setIsProcessing(false);
        }
      } else {
        const pixelated = await pixelateImage(base64Full, project.width, project.height);
        updateLayerData(activeFrameId, activeLayerId, pixelated);
        toast.success('Image imported to active layer!');
        onOpenChange(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-primary/30 text-foreground font-sans rounded-none shadow-[0_0_60px_rgba(124,58,237,0.2)]">
        <DialogHeader>
          <DialogTitle className="font-pixel text-[11px] text-primary uppercase tracking-widest glow-purple flex items-center gap-2">
            <Upload size={13} /> Import
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-sm p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all text-center',
              dragOver
                ? 'border-primary bg-primary/10'
                : 'border-border/40 bg-muted/10 hover:border-primary/40 hover:bg-muted/20'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} className={cn('transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground/40')} />
            <div>
              <p className="font-pixel text-[9px] text-foreground/70">Drop image or click to browse</p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">PNG, JPG, GIF · or .pxf project file</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pxf,.json"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* AI enhance toggle */}
          <label className={cn(
            'flex items-center gap-3 p-3 border cursor-pointer transition-all',
            useAI
              ? 'bg-accent/10 border-accent/40'
              : 'bg-muted/20 border-border/40 hover:border-accent/30'
          )}>
            <input
              type="checkbox"
              checked={useAI}
              onChange={e => setUseAI(e.target.checked)}
              className="sr-only"
            />
            <Sparkles size={16} className={cn('shrink-0', useAI ? 'text-accent' : 'text-muted-foreground/50')} />
            <div className="flex flex-col">
              <span className={cn('font-pixel text-[9px] uppercase tracking-wider', useAI ? 'text-accent' : 'text-muted-foreground')}>
                AI Enhance
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">
                Convert to pixel art style via AI
              </span>
            </div>
          </label>

          {/* AI options */}
          {useAI && (
            <div className="flex flex-col gap-3 p-3 bg-muted/10 border border-border/30">
              <div className="flex flex-col gap-1.5">
                <label className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Style</label>
                <div className="flex flex-wrap gap-1">
                  {STYLE_PRESETS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStyleId(s.id)}
                      className={cn(
                        'font-pixel text-[7px] px-2 py-1.5 border transition-all',
                        styleId === s.id
                          ? 'bg-primary/20 border-primary/60 text-primary'
                          : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Style Guidance (optional)</label>
                <input
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. dark fantasy, blood red tones..."
                  className="bg-background/50 border border-border/40 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-primary/50 text-foreground"
                />
              </div>
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-[9px] font-pixel text-accent animate-pulse bg-accent/10 border border-accent/20 px-3 py-2.5">
              <RefreshCcw size={12} className="animate-spin shrink-0" />
              Enhancing image with AI...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

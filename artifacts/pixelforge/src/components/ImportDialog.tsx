import React, { useRef, useState } from 'react';
import { Upload, Sparkles, RefreshCcw } from 'lucide-react';
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
];

function pixelateImage(base64: string, targetW: number, targetH: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const tiny = document.createElement('canvas');
      tiny.width = targetW; tiny.height = targetH;
      const tinyCtx = tiny.getContext('2d')!;
      tinyCtx.imageSmoothingEnabled = false;
      tinyCtx.drawImage(img, 0, 0, targetW, targetH);
      resolve(tiny.toDataURL('image/png'));
    };
    img.src = 'data:image/png;base64,' + base64;
  });
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ editor, open, onOpenChange }) => {
  const { project, updateLayerData, activeFrameId, activeLayerId, saveHistory } = editor;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [useAIEnhance, setUseAIEnhance] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [styleId, setStyleId] = useState('blasphemous');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.pxf') || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.frames && data.width) {
            editor.setProject(data);
            toast.success('Project imported successfully');
            onOpenChange(false);
          } else {
            toast.error('Invalid project file');
          }
        } catch (err) {
          toast.error('Failed to parse project file');
        }
      };
      reader.readAsText(file);
      return;
    } 
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Full = event.target?.result as string;
        const base64Data = base64Full.split(',')[1];
        
        saveHistory();

        if (useAIEnhance) {
          setIsProcessing(true);
          try {
            const payload: any = {
              imageBase64: base64Data,
              style: styleId,
              width: project.width,
              height: project.height
            };
            if (prompt.trim()) payload.prompt = prompt;

            const response = await fetch('/api/ai/enhance-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('AI Enhancement failed');
            const { frames } = await response.json();
            
            if (frames && frames.length > 0) {
              const pixelated = await pixelateImage(frames[0], project.width, project.height);
              updateLayerData(activeFrameId, activeLayerId, pixelated);
              toast.success('AI Enhanced image imported');
              onOpenChange(false);
            }
          } catch (e) {
            toast.error('AI Enhancement failed. The void rejects your offering.');
          } finally {
            setIsProcessing(false);
          }
        } else {
          // Standard import
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = project.width;
            canvas.height = project.height;
            const ctx = canvas.getContext('2d')!;
            
            ctx.imageSmoothingEnabled = false;
            
            const scale = Math.min(project.width / img.width, project.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (project.width - w) / 2;
            const y = (project.height - h) / 2;
            
            ctx.drawImage(img, x, y, w, h);
            
            updateLayerData(activeFrameId, activeLayerId, canvas.toDataURL('image/png'));
            toast.success('Image imported to active layer');
            onOpenChange(false);
          };
          img.src = base64Full;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#0d0d12] border-[#2a1545] text-foreground font-sans rounded-none shadow-[0_0_50px_rgba(124,58,237,0.15)]">
        <DialogHeader>
          <DialogTitle className="font-pixel text-[12px] text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
            Import Asset
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          
          <div className="flex flex-col gap-4 p-4 border border-[#1a1a24] bg-[#0a0a0e] rounded-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={cn(
                "w-4 h-4 border flex items-center justify-center transition-colors rounded-sm",
                useAIEnhance ? "bg-primary border-primary" : "border-[#2a2a35] group-hover:border-primary/50"
              )}>
                {useAIEnhance && <Sparkles size={10} className="text-white" />}
              </div>
              <span className="font-pixel text-[9px] text-primary tracking-wider">USE AI ENHANCEMENT</span>
              <input type="checkbox" className="sr-only" checked={useAIEnhance} onChange={e => setUseAIEnhance(e.target.checked)} disabled={isProcessing}/>
            </label>

            {useAIEnhance && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                <input 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Optional prompt guidance (e.g. 'make it demonic')"
                  className="w-full bg-[#111118] border border-[#1a1a24] rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  disabled={isProcessing}
                />
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStyleId(s.id)}
                      disabled={isProcessing}
                      className={cn(
                        'font-pixel text-[8px] px-2 py-1.5 rounded-sm border transition-all',
                        styleId === s.id
                          ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                          : 'bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545] hover:text-foreground'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport}
            accept=".png,.jpg,.jpeg,.pxf,.json"
            className="hidden" 
            disabled={isProcessing}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className={cn(
              "border-2 border-dashed p-10 flex flex-col items-center gap-4 justify-center transition-all rounded-sm group",
              isProcessing 
                ? "border-primary/50 bg-primary/5" 
                : "border-[#2a2a35] bg-[#111118] hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            {isProcessing ? (
              <>
                <RefreshCcw size={32} className="text-primary animate-spin" />
                <span className="font-pixel text-[10px] text-primary uppercase text-center animate-pulse">
                  ENHANCING IN THE VOID...
                </span>
              </>
            ) : (
              <>
                <Upload size={32} className="text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-pixel text-[10px] text-muted-foreground group-hover:text-primary uppercase text-center leading-relaxed transition-colors">
                  Select File to Import<br/>
                  <span className="text-[8px] opacity-70">Supports .PNG, .JPG, .PXF</span>
                </span>
              </>
            )}
          </button>
          
          {!useAIEnhance && (
            <p className="text-[10px] font-mono text-muted-foreground text-center">
              Images will be scaled down to fit the current canvas ({project.width}x{project.height}) using nearest-neighbor interpolation.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

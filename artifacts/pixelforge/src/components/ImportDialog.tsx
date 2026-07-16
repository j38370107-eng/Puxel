import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';

interface ImportDialogProps {
  editor: ReturnType<typeof usePixelEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ editor, open, onOpenChange }) => {
  const { project, updateLayerData, activeFrameId, activeLayerId, saveHistory } = editor;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          saveHistory();
          const canvas = document.createElement('canvas');
          canvas.width = project.width;
          canvas.height = project.height;
          const ctx = canvas.getContext('2d')!;
          
          // Nearest neighbor scaling
          ctx.imageSmoothingEnabled = false;
          
          // Center and scale image to fit canvas
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
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground font-sans rounded-none">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary uppercase">
            Import Asset
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-8">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport}
            accept=".png,.jpg,.jpeg,.pxf,.json"
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-muted hover:bg-muted/80 border-2 border-dashed border-border p-12 flex flex-col items-center gap-4 justify-center transition-colors rounded-sm"
          >
            <Upload size={32} className="text-muted-foreground" />
            <span className="font-pixel text-[10px] text-muted-foreground uppercase text-center leading-relaxed">
              Click to browse<br/>
              <span className="text-[8px]">Supports .PNG, .JPG, .PXF</span>
            </span>
          </button>
          <p className="text-xs font-mono text-muted-foreground text-center">
            Images will be scaled down to fit the current canvas ({project.width}x{project.height}) using nearest-neighbor interpolation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

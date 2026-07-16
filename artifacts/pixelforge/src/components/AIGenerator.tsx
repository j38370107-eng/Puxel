import React, { useState } from 'react';
import { Wand2, RefreshCcw } from 'lucide-react';
import { aiGenerator } from '../lib/aiGenerator';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { project, activeFrameId, activeLayerId, updateLayerData, saveHistory } = editor;

  const generate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    
    // Simulate thinking delay for effect
    await new Promise(r => setTimeout(r, 800));

    try {
      saveHistory();
      const imageData = aiGenerator.generate(prompt, project.width, project.height);
      
      // Convert ImageData to DataURL
      const canvas = document.createElement('canvas');
      canvas.width = project.width;
      canvas.height = project.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
      
      const activeFrame = project.frames.find(f => f.id === activeFrameId);
      const activeLayer = activeFrame?.layers.find(l => l.id === activeLayerId);
      
      if (activeLayer && !activeLayer.locked) {
        // Merge with existing or overwrite? Let's composite onto existing layer
        const existingCanvas = document.createElement('canvas');
        existingCanvas.width = project.width;
        existingCanvas.height = project.height;
        const eCtx = existingCanvas.getContext('2d')!;
        
        if (activeLayer.data) {
          const img = new Image();
          await new Promise<void>(resolve => {
            img.onload = () => {
              eCtx.drawImage(img, 0, 0);
              resolve();
            };
            img.src = activeLayer.data;
          });
        }
        
        eCtx.drawImage(canvas, 0, 0);
        updateLayerData(activeFrameId, activeLayerId, existingCanvas.toDataURL());
        toast.success('Sprite generated successfully!');
      } else {
        toast.error('Active layer is locked or unavailable');
      }
    } catch (e) {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center gap-2 text-[10px] font-pixel text-primary mb-3 uppercase tracking-wider">
        <Wand2 size={14} /> Procedural AI
      </div>
      
      <div className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. warrior facing right 32x32"
          className="w-full h-16 bg-input border border-border rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={!prompt || isGenerating}
            className="flex-1 bg-primary text-primary-foreground font-pixel text-[10px] py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? <RefreshCcw size={12} className="animate-spin" /> : <Wand2 size={12} />}
            GENERATE
          </button>
        </div>
        <div className="text-[9px] font-mono text-muted-foreground mt-1">
          Keywords supported: warrior, dragon, tree, water, fire, gold, sword
        </div>
      </div>
    </div>
  );
};

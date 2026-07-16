import React, { useState, useCallback } from 'react';
import { Wand2, RefreshCcw, Shuffle, Sparkles, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { SURPRISE_PROMPTS } from '../lib/pixelArtEngine';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { Selection } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

const STYLE_PRESETS = [
  { id: 'blasphemous', label: 'Blasphemous', mod: 'dark fantasy pixel art, blasphemous style, highly detailed' },
  { id: 'retro8bit',   label: 'Retro 8-bit', mod: 'classic 8-bit pixel art style, retro palette' },
  { id: '16bit',       label: '16-bit',      mod: '16-bit era pixel art, snes style' },
  { id: 'isometric',   label: 'Isometric',   mod: 'isometric view pixel art' },
  { id: 'gothic',      label: 'Gothic',      mod: 'gothic pixel art, dark colors, castlevania style' },
  { id: 'cyberpunk',   label: 'Cyberpunk',   mod: 'cyberpunk pixel art, neon colors, dark background' },
] as const;

const CANVAS_SIZES = [16, 32, 64, 128];
const ANIMATION_FRAMES = [1, 2, 4, 8];

const STEPS = [
  'Communing with the void...',
  'Forging silhouette...',
  'Infusing dark colors...',
  'Carving details...',
  'Polishing pixels...',
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

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt] = useState('');
  const [refineText, setRefineText] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showRefine, setShowRefine] = useState(false);
  const [styleId, setStyleId] = useState<string>('blasphemous');
  const [frameCount, setFrameCount] = useState<number>(1);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const { project, selection, saveHistory, activeFrameId, activeLayerId, updateLayerData, setProject } = editor;

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage((event.target?.result as string).split(',')[1]); // remove data:image/png;base64,
    };
    reader.readAsDataURL(file);
  };

  const commitFrames = async (framesBase64: string[]) => {
    saveHistory();
    const pixelatedDataUrls = await Promise.all(framesBase64.map(b64 => pixelateImage(b64, project.width, project.height)));
    
    setProject(p => {
      const newFrames = [...p.frames];
      
      for (let fi = 0; fi < pixelatedDataUrls.length; fi++) {
        const dataUrl = pixelatedDataUrls[fi];
        
        if (fi < newFrames.length) {
          // Update existing frame
          const targetFrame = newFrames[fi];
          const layerId = fi === 0 ? activeLayerId : targetFrame.layers[0].id;
          newFrames[fi] = {
            ...targetFrame,
            layers: targetFrame.layers.map(l => l.id === layerId ? { ...l, data: dataUrl } : l)
          };
        } else {
          // Create new frame
          newFrames.push({
            id: crypto.randomUUID(),
            duration: newFrames[0].duration,
            layers: newFrames[0].layers.map(l => ({ ...l, id: crypto.randomUUID(), data: l.id === activeLayerId ? dataUrl : '' }))
          });
        }
      }
      return { ...p, frames: newFrames };
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setStepIndex(0);
    const stepInterval = setInterval(() => {
      setStepIndex(s => Math.min(s + 1, STEPS.length - 1));
    }, 1500);

    try {
      const fullPrompt = `${prompt}, ${STYLE_PRESETS.find(s => s.id === styleId)?.mod || ''}`;
      
      const payload: any = {
        prompt: fullPrompt,
        style: styleId,
        width: project.width,
        height: project.height,
        frameCount: frameCount
      };
      if (referenceImage) payload.referenceImage = referenceImage;

      const response = await fetch('/api/ai/generate-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Generation failed');
      
      const { frames } = await response.json();
      if (!frames || frames.length === 0) throw new Error('No frames returned');
      
      clearInterval(stepInterval);
      setStepIndex(STEPS.length - 1);
      
      await commitFrames(frames);
      setLastPrompt(prompt);
      toast.success(`Generated ${frames.length} frame(s)!`);
      
    } catch (e) {
      clearInterval(stepInterval);
      toast.error('The void did not answer. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSurprise = () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    setPrompt(pick);
  };

  const onPromptKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } };

  return (
    <div className="p-4 border-b border-[#111118] bg-[#0a0a0e] flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[12px] font-pixel text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]">
        <Sparkles size={14} /> AI Studio
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider">Style</label>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map(s => (
            <button
              key={s.id}
              onClick={() => setStyleId(s.id)}
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

      <div className="flex flex-col gap-2">
        <label className="text-[9px] font-pixel text-muted-foreground uppercase tracking-wider">Animation</label>
        <div className="flex gap-1.5">
          {ANIMATION_FRAMES.map(count => (
            <button
              key={count}
              onClick={() => setFrameCount(count)}
              className={cn(
                'flex-1 font-pixel text-[8px] py-1.5 rounded-sm border transition-all',
                frameCount === count
                  ? 'bg-accent/20 border-accent text-accent shadow-[0_0_10px_rgba(167,139,250,0.3)]'
                  : 'bg-[#111118] border-[#1a1a24] text-muted-foreground hover:border-[#2a1545] hover:text-foreground'
              )}
            >
              {count === 1 ? 'STATIC' : `${count} FRAMES`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={onPromptKey}
          placeholder="Describe your pixel art..."
          className="w-full h-24 bg-[#111118] border border-[#1a1a24] rounded-sm p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 focus:shadow-[0_0_15px_rgba(124,58,237,0.1)] transition-all"
          disabled={isGenerating}
        />
        
        <label className={cn(
          "w-full h-10 border border-dashed rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs font-mono",
          referenceImage ? "border-primary text-primary bg-primary/5" : "border-[#1a1a24] text-muted-foreground hover:border-primary/50 hover:text-primary/80 bg-[#111118]"
        )}>
          <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
          <Upload size={14} />
          {referenceImage ? "Reference Image Loaded" : "Drop Reference Image"}
        </label>
      </div>

      {isGenerating && (
        <div className="text-[9px] font-pixel text-primary flex items-center gap-2 animate-pulse bg-primary/10 p-2 rounded-sm border border-primary/20">
          <RefreshCcw size={12} className="animate-spin shrink-0" />
          <span className="truncate">{STEPS[stepIndex]}</span>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="flex-1 bg-primary text-primary-foreground font-pixel text-[12px] py-3 rounded-sm hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] transition-all"
        >
          {isGenerating ? <RefreshCcw size={14} className="animate-spin" /> : <Wand2 size={14} />}
          ✦ GENERATE
        </button>
        <button
          onClick={handleSurprise}
          disabled={isGenerating}
          title="Surprise Me"
          className="bg-[#1a1025] text-accent border border-[#2a1545] font-pixel text-[12px] px-4 py-3 rounded-sm hover:bg-[#2a1545] disabled:opacity-40 flex items-center gap-1 transition-all hover:shadow-[0_0_15px_rgba(167,139,250,0.3)]"
        >
          <Shuffle size={14} />
        </button>
      </div>
      
      {lastPrompt && (
        <div className="mt-2 flex flex-col gap-2">
          <button
            onClick={() => setShowRefine(!showRefine)}
            className="flex items-center justify-center gap-1 text-[9px] font-pixel text-muted-foreground hover:text-foreground py-1 bg-[#111118] border border-[#1a1a24] rounded-sm transition-colors"
          >
            {showRefine ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Refine last generation
          </button>
          
          {showRefine && (
            <div className="flex flex-col gap-2 p-2 bg-[#111118] border border-[#1a1a24] rounded-sm">
              <input
                value={refineText}
                onChange={e => setRefineText(e.target.value)}
                placeholder="Make it darker, add blood..."
                className="bg-[#0a0a0e] border border-[#1a1a24] p-2 text-xs font-mono focus:outline-none focus:border-primary/50 text-foreground"
              />
              <button 
                onClick={() => { setPrompt(lastPrompt + ", " + refineText); handleGenerate(); }}
                disabled={!refineText || isGenerating}
                className="bg-[#2a1545] text-accent font-pixel text-[9px] py-2 rounded-sm hover:bg-[#3a1d5c] transition-colors"
              >
                REFINE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

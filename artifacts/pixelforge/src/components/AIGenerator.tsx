import React, { useState, useCallback } from 'react';
import {
  Wand2, RefreshCcw, Shuffle, Sparkles, ChevronDown, ChevronUp,
  Upload, X, Zap, Target, Layers as FramesIcon,
} from 'lucide-react';
import { SURPRISE_PROMPTS } from '../lib/pixelArtEngine';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

const STYLE_PRESETS = [
  { id: 'blasphemous', label: 'Blasphemous', color: '#7c3aed' },
  { id: 'gothic',      label: 'Gothic',      color: '#6d28d9' },
  { id: 'retro8bit',   label: '8-bit',       color: '#1d4ed8' },
  { id: '16bit',       label: '16-bit',      color: '#0369a1' },
  { id: 'isometric',   label: 'Isometric',   color: '#047857' },
  { id: 'cyberpunk',   label: 'Cyberpunk',   color: '#9333ea' },
] as const;

type StyleId = typeof STYLE_PRESETS[number]['id'];

const CANVAS_SIZES = [16, 32, 64, 128] as const;
const FRAME_OPTIONS = [
  { count: 1, label: 'Static' },
  { count: 2, label: '2 Frames' },
  { count: 4, label: '4 Frames' },
  { count: 8, label: '8 Frames' },
];

const GENERATION_STEPS = [
  '✦ Communing with the void...',
  '✦ Forging silhouette...',
  '✦ Infusing dark palette...',
  '✦ Carving pixel details...',
  '✦ Polishing & refining...',
];

function pixelateImage(base64: string, targetW: number, targetH: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = 'data:image/png;base64,' + base64;
  });
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt]               = useState('');
  const [refineText, setRefineText]       = useState('');
  const [lastPrompt, setLastPrompt]       = useState('');
  const [isGenerating, setIsGenerating]   = useState(false);
  const [stepIndex, setStepIndex]         = useState(0);
  const [showRefine, setShowRefine]       = useState(false);
  const [styleId, setStyleId]             = useState<StyleId>('blasphemous');
  const [frameCount, setFrameCount]       = useState<number>(1);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [refImgName, setRefImgName]       = useState<string>('');

  const { project, saveHistory, activeFrameId, activeLayerId, updateLayerData, setProject } = editor;

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImgName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = (ev.target?.result as string).split(',')[1];
      setReferenceImage(b64);
    };
    reader.readAsDataURL(file);
  };

  const clearReference = () => {
    setReferenceImage(null);
    setRefImgName('');
  };

  const commitFrames = useCallback(async (framesBase64: string[]) => {
    saveHistory();
    const pixelated = await Promise.all(
      framesBase64.map(b64 => pixelateImage(b64, project.width, project.height))
    );

    setProject(p => {
      const newFrames = [...p.frames];
      for (let fi = 0; fi < pixelated.length; fi++) {
        const dataUrl = pixelated[fi];
        if (fi < newFrames.length) {
          const targetFrame = newFrames[fi];
          const layerId = fi === 0 ? activeLayerId : targetFrame.layers[0].id;
          newFrames[fi] = {
            ...targetFrame,
            layers: targetFrame.layers.map(l => l.id === layerId ? { ...l, data: dataUrl } : l),
          };
        } else {
          newFrames.push({
            id: crypto.randomUUID(),
            duration: newFrames[0].duration,
            layers: newFrames[0].layers.map(l => ({
              ...l,
              id: crypto.randomUUID(),
              data: l.id === activeLayerId ? dataUrl : '',
            })),
          });
        }
      }
      return { ...p, frames: newFrames };
    });
  }, [project.width, project.height, saveHistory, activeLayerId, setProject]);

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const finalPrompt = overridePrompt ?? prompt;
    if (!finalPrompt.trim()) return;

    setIsGenerating(true);
    setStepIndex(0);
    const stepInterval = setInterval(() => {
      setStepIndex(s => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 1600);

    try {
      const payload: Record<string, unknown> = {
        prompt: finalPrompt,
        style: styleId,
        width: project.width,
        height: project.height,
        frameCount,
      };
      if (referenceImage) payload.referenceImage = referenceImage;

      const response = await fetch('/api/ai/generate-sprite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMsg = 'Generation failed';
        try {
          const errBody = await response.json();
          const raw = String(errBody?.error ?? '');
          if (/billing|credit|limit|quota/i.test(raw)) {
            errMsg = 'OpenAI credit limit reached — add credits at platform.openai.com/settings/billing';
          } else if (/api.?key|auth|invalid/i.test(raw)) {
            errMsg = 'Invalid OpenAI API key — update OPENAI_API_KEY in Replit Secrets';
          } else if (raw) {
            errMsg = raw.slice(0, 200);
          }
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const { frames } = await response.json();
      if (!frames?.length) throw new Error('No frames returned from AI');

      clearInterval(stepInterval);
      setStepIndex(GENERATION_STEPS.length - 1);

      await commitFrames(frames);
      setLastPrompt(finalPrompt);
      toast.success(`✦ Generated ${frames.length} frame${frames.length > 1 ? 's' : ''}!`);

    } catch (e) {
      clearInterval(stepInterval);
      const msg = e instanceof Error ? e.message : 'The void did not answer. Try again.';
      toast.error(msg, { duration: 8000 });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, styleId, project.width, project.height, frameCount, referenceImage, commitFrames]);

  const handleSurprise = () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    setPrompt(pick);
    toast('Surprise prompt loaded!', { duration: 2000 });
  };

  const handleRefine = () => {
    if (!refineText.trim() || !lastPrompt) return;
    handleGenerate(`${lastPrompt}, ${refineText}`);
  };

  return (
    <div className="flex flex-col gap-0 divide-y divide-border/40">

      {/* Style presets */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-primary" />
          <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Style</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_PRESETS.map(s => (
            <button
              key={s.id}
              onClick={() => setStyleId(s.id)}
              className={cn(
                'font-pixel text-[7px] py-1.5 px-1 border transition-all rounded-sm truncate',
                styleId === s.id
                  ? 'bg-primary/20 border-primary/70 text-primary shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas size & frame count */}
      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Target size={11} className="text-muted-foreground/60" />
            <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Canvas</span>
            <span className="font-mono text-[10px] text-foreground/60 ml-auto">{project.width}×{project.height}px</span>
          </div>
          <div className="flex gap-1">
            {CANVAS_SIZES.map(s => (
              <button
                key={s}
                onClick={() => editor.createNewProject(s, s, project.mode)}
                className={cn(
                  'flex-1 font-pixel text-[7px] py-1.5 border rounded-sm transition-all',
                  project.width === s
                    ? 'bg-accent/15 border-accent/50 text-accent'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-accent/30'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <FramesIcon size={11} className="text-muted-foreground/60" />
            <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Frames</span>
          </div>
          <div className="flex gap-1">
            {FRAME_OPTIONS.map(({ count, label }) => (
              <button
                key={count}
                onClick={() => setFrameCount(count)}
                className={cn(
                  'flex-1 font-pixel text-[7px] py-1.5 border rounded-sm transition-all',
                  frameCount === count
                    ? 'bg-accent/15 border-accent/50 text-accent'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-accent/30'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Wand2 size={11} className="text-primary" />
          <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Prompt</span>
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
          placeholder="Describe your pixel art... (Enter to generate)"
          rows={4}
          className="w-full bg-muted/20 border border-border/50 p-2.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all rounded-sm"
          disabled={isGenerating}
        />

        {/* Reference image */}
        {referenceImage ? (
          <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/30 rounded-sm">
            <Upload size={12} className="text-primary shrink-0" />
            <span className="font-mono text-[10px] text-primary flex-1 truncate">{refImgName}</span>
            <button onClick={clearReference} className="text-muted-foreground hover:text-destructive transition-colors">
              <X size={12} />
            </button>
          </div>
        ) : (
          <label className="w-full py-2 border border-dashed border-border/40 flex items-center justify-center gap-2 cursor-pointer transition-colors text-[10px] font-mono text-muted-foreground/50 hover:border-primary/40 hover:text-primary/70 rounded-sm bg-muted/10">
            <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} disabled={isGenerating} />
            <Upload size={12} /> Reference image (optional)
          </label>
        )}
      </div>

      {/* Generation status */}
      {isGenerating && (
        <div className="px-3 py-2.5 bg-primary/10 border-y border-primary/20">
          <div className="flex items-center gap-2 text-[9px] font-pixel text-primary animate-pulse">
            <RefreshCcw size={11} className="animate-spin shrink-0" />
            <span className="truncate">{GENERATION_STEPS[stepIndex]}</span>
          </div>
          <div className="mt-2 h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${((stepIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="p-3 flex gap-2">
        <button
          onClick={() => handleGenerate()}
          disabled={!prompt.trim() || isGenerating}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 font-pixel text-[10px] uppercase tracking-wider transition-all',
            !prompt.trim() || isGenerating
              ? 'bg-muted/30 border border-border/40 text-muted-foreground/40 cursor-not-allowed'
              : 'bg-primary text-white border border-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] ai-glow'
          )}
        >
          {isGenerating
            ? <><RefreshCcw size={13} className="animate-spin" /> Generating...</>
            : <><Wand2 size={13} /> ✦ Generate</>
          }
        </button>
        <button
          onClick={handleSurprise}
          disabled={isGenerating}
          title="Surprise Me!"
          className="px-3 py-3 bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 hover:border-accent/60 hover:shadow-[0_0_12px_rgba(167,139,250,0.4)] transition-all disabled:opacity-40 rounded-sm"
        >
          <Shuffle size={14} />
        </button>
      </div>

      {/* Refine last */}
      {lastPrompt && !isGenerating && (
        <div className="p-3 flex flex-col gap-2">
          <button
            onClick={() => setShowRefine(o => !o)}
            className="flex items-center justify-between text-[8px] font-pixel text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5"><Zap size={10} className="text-accent/60" /> Refine last generation</span>
            {showRefine ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showRefine && (
            <div className="flex flex-col gap-2 p-2.5 bg-muted/20 border border-border/40 rounded-sm">
              <p className="font-mono text-[9px] text-muted-foreground/60 truncate italic">"{lastPrompt.slice(0, 60)}{lastPrompt.length > 60 ? '...' : ''}"</p>
              <input
                value={refineText}
                onChange={e => setRefineText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRefine(); }}
                placeholder="Add bells to hat, make it darker..."
                className="bg-background/50 border border-border/50 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-primary/50 text-foreground rounded-sm"
              />
              <button
                onClick={handleRefine}
                disabled={!refineText.trim() || isGenerating}
                className="bg-accent/20 border border-accent/40 text-accent font-pixel text-[8px] py-1.5 hover:bg-accent/30 transition-colors disabled:opacity-40 rounded-sm"
              >
                ✦ REFINE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

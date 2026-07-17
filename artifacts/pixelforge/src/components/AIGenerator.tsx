import React, { useState, useCallback, useRef } from 'react';
import {
  Wand2, RefreshCcw, Shuffle, Sparkles, ChevronDown, ChevronUp,
  Upload, X, Zap, Target, Layers as FramesIcon, Palette,
  ArrowUpCircle, Heart, Crop,
} from 'lucide-react';
import {
  generateSprite, refineSprite, improveSprite, imageToPixelArt,
  SURPRISE_PROMPTS, type StylePreset,
} from '../lib/pixelArtEngine';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

const STYLE_PRESETS: { id: StylePreset; label: string; color: string }[] = [
  { id: 'blasphemous', label: 'Blasphemous', color: '#7c3aed' },
  { id: 'gothic',      label: 'Gothic',      color: '#6d28d9' },
  { id: 'retro8bit',   label: '8-bit',       color: '#1d4ed8' },
  { id: '16bit',       label: '16-bit',      color: '#0369a1' },
  { id: 'isometric',   label: 'Isometric',   color: '#047857' },
  { id: 'cyberpunk',   label: 'Cyberpunk',   color: '#9333ea' },
] as const;

const CANVAS_SIZES = [16, 32, 64, 128] as const;

const FRAME_OPTIONS = [
  { count: 1, label: 'Static' },
  { count: 2, label: '2 Fr' },
  { count: 4, label: '4 Fr' },
  { count: 8, label: '8 Fr' },
];

const PALETTE_SIZES = [16, 32, 64] as const;

const GENERATION_STEPS = [
  '✦ Communing with the void...',
  '✦ Forging silhouette...',
  '✦ Infusing dark palette...',
  '✦ Carving pixel details...',
  '✦ Polishing & refining...',
];

// Convert ImageData to a data URL
function imageDataToDataUrl(imgData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Convert data URL (base64) to ImageData
function dataUrlToImageData(dataUrl: string, w: number, h: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Get the current active layer's pixel data as ImageData
async function getActiveLayerImageData(
  layerDataUrl: string | undefined,
  w: number,
  h: number,
): Promise<ImageData | null> {
  if (!layerDataUrl) return null;
  try {
    return await dataUrlToImageData(layerDataUrl, w, h);
  } catch {
    return null;
  }
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt]               = useState('');
  const [refineText, setRefineText]       = useState('');
  const [lastPrompt, setLastPrompt]       = useState('');
  const [isGenerating, setIsGenerating]   = useState(false);
  const [stepIndex, setStepIndex]         = useState(0);
  const [showRefine, setShowRefine]       = useState(false);
  const [styleId, setStyleId]             = useState<StylePreset>('blasphemous');
  const [frameCount, setFrameCount]       = useState<number>(1);
  const [paletteSize, setPaletteSize]     = useState<16 | 32 | 64>(32);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [refImgName, setRefImgName]       = useState<string>('');

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { project, saveHistory, activeFrameId, activeLayerId, updateLayerData, setProject } = editor;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearTimers = () => {
    stepTimers.current.forEach(t => clearTimeout(t));
    stepTimers.current = [];
  };

  const animateSteps = (onDone?: () => void) => {
    setStepIndex(0);
    GENERATION_STEPS.forEach((_, i) => {
      const t = setTimeout(() => {
        setStepIndex(Math.min(i, GENERATION_STEPS.length - 1));
        if (i === GENERATION_STEPS.length - 1 && onDone) onDone();
      }, i * 600);
      stepTimers.current.push(t);
    });
  };

  const commitImageData = useCallback(async (frames: ImageData[]) => {
    saveHistory();
    const dataUrls = frames.map(imgData => imageDataToDataUrl(imgData));

    setProject(p => {
      const newFrames = [...p.frames];
      for (let fi = 0; fi < dataUrls.length; fi++) {
        const dataUrl = dataUrls[fi];
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
  }, [saveHistory, activeLayerId, setProject]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const finalPrompt = (overridePrompt ?? prompt).trim();
    if (!finalPrompt) return;

    setIsGenerating(true);
    clearTimers();
    animateSteps();

    // Small delay to show the UX animation before heavy computation
    await new Promise(r => setTimeout(r, 300));

    try {
      let frames: ImageData[];

      if (referenceImage) {
        // Convert uploaded reference image to pixel art
        const refImgData = await imageToPixelArt(
          'data:image/png;base64,' + referenceImage,
          project.width,
          project.height,
        );
        // Generate a sprite and composite over reference
        const generated = generateSprite(finalPrompt, project.width, project.height, styleId, frameCount);
        // Use reference image as base but apply style
        frames = frameCount > 1 ? generated : [refImgData];
      } else {
        frames = generateSprite(finalPrompt, project.width, project.height, styleId, frameCount);
      }

      clearTimers();
      setStepIndex(GENERATION_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 200)); // brief pause before commit

      await commitImageData(frames);
      setLastPrompt(finalPrompt);
      toast.success(`✦ Generated ${frames.length} frame${frames.length > 1 ? 's' : ''}!`);
    } catch (e) {
      clearTimers();
      const msg = e instanceof Error ? e.message : 'Generation failed. Try again.';
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, styleId, project.width, project.height, frameCount, referenceImage, commitImageData]);

  const handleImproveFurther = useCallback(async () => {
    setIsGenerating(true);
    clearTimers();
    animateSteps();
    await new Promise(r => setTimeout(r, 200));

    try {
      // Get current active frame/layer data
      const activeFrame = project.frames.find(f => f.id === activeFrameId) ?? project.frames[0];
      const activeLayer = activeFrame?.layers.find(l => l.id === activeLayerId) ?? activeFrame?.layers[0];
      const layerDataUrl = activeLayer?.data;

      const existing = await getActiveLayerImageData(layerDataUrl, project.width, project.height);
      if (!existing) {
        toast.error('No pixel art to improve — generate something first.');
        return;
      }

      const improved = improveSprite(existing, 0.7);
      clearTimers();
      setStepIndex(GENERATION_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 100));

      await commitImageData([improved]);
      toast.success('✦ Sprite improved!');
    } catch (e) {
      clearTimers();
      toast.error('Improvement failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [project, activeFrameId, activeLayerId, commitImageData]);

  const handleHumanize = useCallback(async () => {
    setIsGenerating(true);
    clearTimers();

    setStepIndex(0);
    const t1 = setTimeout(() => setStepIndex(1), 400);
    const t2 = setTimeout(() => setStepIndex(2), 800);
    stepTimers.current = [t1, t2];

    await new Promise(r => setTimeout(r, 150));

    try {
      const activeFrame = project.frames.find(f => f.id === activeFrameId) ?? project.frames[0];
      const activeLayer = activeFrame?.layers.find(l => l.id === activeLayerId) ?? activeFrame?.layers[0];
      const layerDataUrl = activeLayer?.data;

      const existing = await getActiveLayerImageData(layerDataUrl, project.width, project.height);
      if (!existing) {
        toast.error('No pixel art to humanize — generate something first.');
        return;
      }

      // Apply humanize with jitter + edge erosion
      const { humanizer } = await import('../lib/humanizer').catch(() => ({ humanizer: null }));

      let humanized: ImageData;
      if (humanizer) {
        humanized = humanizer.apply(existing, { amount: 0.65 });
      } else {
        // Fallback: use improveSprite which also adds subtle variation
        humanized = improveSprite(existing, 0.4);
      }

      clearTimers();
      setStepIndex(GENERATION_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 100));

      await commitImageData([humanized]);
      toast.success('✦ Sprite humanized!');
    } catch (e) {
      clearTimers();
      toast.error('Humanize failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [project, activeFrameId, activeLayerId, commitImageData]);

  const handleRefineArea = useCallback(async () => {
    if (!refineText.trim()) {
      toast('Enter a refinement description first.');
      return;
    }
    setIsGenerating(true);
    clearTimers();
    animateSteps();
    await new Promise(r => setTimeout(r, 200));

    try {
      const basePrompt = lastPrompt || prompt;
      const frames = refineSprite(basePrompt, refineText, project.width, project.height, styleId);

      clearTimers();
      setStepIndex(GENERATION_STEPS.length - 1);
      await new Promise(r => setTimeout(r, 100));

      await commitImageData(frames);
      setLastPrompt(`${basePrompt} ${refineText}`);
      toast.success('✦ Refined!');
    } catch (e) {
      clearTimers();
      toast.error('Refinement failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [refineText, lastPrompt, prompt, project.width, project.height, styleId, commitImageData]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImgName(file.name);

    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      // Convert immediately to pixel art at project resolution
      try {
        const imgData = await imageToPixelArt(dataUrl, project.width, project.height);
        const dataUrlOut = imageDataToDataUrl(imgData);
        // Store b64 without prefix for reference
        setReferenceImage(dataUrl.split(',')[1]);
        // Auto-commit pixelated version
        saveHistory();
        setProject(p => ({
          ...p,
          frames: p.frames.map((f, fi) =>
            fi === 0
              ? {
                  ...f,
                  layers: f.layers.map(l =>
                    l.id === activeLayerId ? { ...l, data: dataUrlOut } : l
                  ),
                }
              : f
          ),
        }));
        toast.success('✦ Image converted to pixel art!');
      } catch {
        toast.error('Could not read image file.');
      }
    };
    reader.readAsDataURL(file);
  }, [project.width, project.height, activeLayerId, saveHistory, setProject]);

  const clearReference = () => {
    setReferenceImage(null);
    setRefImgName('');
  };

  const handleSurprise = () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    setPrompt(pick);
    toast('Surprise prompt loaded!', { duration: 2000 });
  };

  const handleRefine = () => {
    if (!refineText.trim()) return;
    handleGenerate(`${lastPrompt ? lastPrompt + ', ' : ''}${refineText}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────

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

      {/* Canvas size, frame count & palette size */}
      <div className="p-3 flex flex-col gap-3">
        {/* Canvas size */}
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

        {/* Frame count */}
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

        {/* Palette size */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Palette size={11} className="text-muted-foreground/60" />
            <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Palette</span>
            <span className="font-mono text-[10px] text-foreground/40 ml-auto">{paletteSize} colors</span>
          </div>
          <div className="flex gap-1">
            {PALETTE_SIZES.map(sz => (
              <button
                key={sz}
                onClick={() => setPaletteSize(sz)}
                className={cn(
                  'flex-1 font-pixel text-[7px] py-1.5 border rounded-sm transition-all',
                  paletteSize === sz
                    ? 'bg-primary/15 border-primary/50 text-primary'
                    : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/30'
                )}
              >
                {sz}
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
          placeholder={[
            'Describe your pixel art...',
            'e.g. "purple vampire with red cape"',
            '"green goblin with loincloth"',
            '"gold coin with royal emblem"',
            '"flaming torch burning bright"',
            '(Enter to generate)',
          ].join('\n')}
          rows={5}
          className="w-full bg-muted/20 border border-border/50 p-2.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/35 resize-none focus:outline-none focus:border-primary/50 focus:bg-primary/5 transition-all rounded-sm"
          disabled={isGenerating}
        />

        {/* Reference image upload */}
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isGenerating}
            />
            <Upload size={12} /> Upload image → pixel art
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
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Primary action buttons */}
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

      {/* Secondary action buttons */}
      <div className="p-3 flex flex-col gap-2">
        <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Actions on current sprite</span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleImproveFurther}
            disabled={isGenerating}
            title="Improve Further — enhance contrast, details and outlines"
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-1 border rounded-sm transition-all text-[7px] font-pixel',
              isGenerating
                ? 'opacity-40 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground'
                : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/10'
            )}
          >
            <ArrowUpCircle size={13} />
            Improve
          </button>
          <button
            onClick={handleHumanize}
            disabled={isGenerating}
            title="Humanize — add subtle imperfections for a hand-drawn feel"
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-1 border rounded-sm transition-all text-[7px] font-pixel',
              isGenerating
                ? 'opacity-40 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground'
                : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-accent/40 hover:text-accent hover:bg-accent/10'
            )}
          >
            <Heart size={13} />
            Humanize
          </button>
          <button
            onClick={() => { setShowRefine(o => !o); }}
            disabled={isGenerating}
            title="Refine — describe changes to the current sprite"
            className={cn(
              'flex flex-col items-center gap-1 py-2 px-1 border rounded-sm transition-all text-[7px] font-pixel',
              showRefine
                ? 'bg-accent/15 border-accent/50 text-accent'
                : isGenerating
                  ? 'opacity-40 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground'
                  : 'bg-muted/20 border-border/40 text-muted-foreground hover:border-accent/40 hover:text-accent hover:bg-accent/10'
            )}
          >
            <Crop size={13} />
            Refine
          </button>
        </div>
      </div>

      {/* Refine panel */}
      {showRefine && (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-accent/60" />
            <span className="font-pixel text-[8px] text-muted-foreground uppercase">Refine Sprite</span>
          </div>

          {lastPrompt && (
            <p className="font-mono text-[9px] text-muted-foreground/50 truncate italic px-1">
              "{lastPrompt.slice(0, 55)}{lastPrompt.length > 55 ? '...' : ''}"
            </p>
          )}

          <div className="flex flex-col gap-2 p-2.5 bg-muted/20 border border-border/40 rounded-sm">
            <textarea
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefineArea(); } }}
              placeholder="Add bells to hat, make it darker, add wings..."
              rows={3}
              className="bg-background/50 border border-border/50 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-primary/50 text-foreground rounded-sm resize-none placeholder:text-muted-foreground/40"
              disabled={isGenerating}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleRefineArea}
                disabled={!refineText.trim() || isGenerating}
                className="flex-1 bg-accent/20 border border-accent/40 text-accent font-pixel text-[8px] py-1.5 hover:bg-accent/30 transition-colors disabled:opacity-40 rounded-sm"
              >
                ✦ REFINE SELECTED
              </button>
              <button
                onClick={handleRefine}
                disabled={!refineText.trim() || isGenerating}
                className="flex-1 bg-muted/20 border border-border/40 text-muted-foreground font-pixel text-[8px] py-1.5 hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-40 rounded-sm"
              >
                RE-GENERATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

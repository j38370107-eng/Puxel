import React, { useState, useCallback } from 'react';
import { Wand2, RefreshCcw, Shuffle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { aiGenerator } from '../lib/aiGenerator';
import { SURPRISE_PROMPTS } from '../lib/pixelArtEngine';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { Selection } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

// ── Style presets ──────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  { id: 'classic',   label: 'Classic',    mod: 'classic 8-bit pixel art style' },
  { id: 'modern',    label: 'Modern',     mod: 'modern pixel art detailed' },
  { id: 'simple',    label: 'Simple',     mod: 'simple minimal clean' },
  { id: 'colorful',  label: 'Colorful',   mod: 'colorful vibrant saturated' },
  { id: 'iso',       label: 'Isometric',  mod: 'isometric view' },
  { id: 'gb',        label: 'Game Boy',   mod: 'game boy green monochrome 4 colors' },
] as const;

// ── View presets ──────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'side',  label: 'Side'  },
  { id: 'back',  label: 'Back'  },
] as const;

// ── Progress steps ────────────────────────────────────────────────────────
const STEPS = [
  'Parsing prompt…',
  'Sketching silhouette…',
  'Adding costume & colours…',
  'Drawing face & details…',
  'Applying shading…',
  'Final outline & polish…',
];

// ── Commit frames to editor ───────────────────────────────────────────────
async function commitFrames(
  frames: ImageData[],
  editor: ReturnType<typeof usePixelEditor>,
  selection: Selection | null,
) {
  const { project, activeFrameId, activeLayerId, updateLayerData } = editor;

  for (let fi = 0; fi < frames.length; fi++) {
    const imgData = frames[fi];
    const targetFrame = project.frames[fi] ?? project.frames[project.frames.length - 1];
    if (!targetFrame) continue;

    const targetLayer =
      fi === 0
        ? targetFrame.layers.find(l => l.id === activeLayerId) ?? targetFrame.layers[0]
        : targetFrame.layers[0];

    if (!targetLayer || targetLayer.locked) {
      if (fi === 0) toast.error('Active layer is locked');
      continue;
    }

    const genCanvas = document.createElement('canvas');
    genCanvas.width = project.width;
    genCanvas.height = project.height;
    genCanvas.getContext('2d')!.putImageData(imgData, 0, 0);

    if (selection && fi === 0) {
      // Inpainting: paste only the selected region onto the existing layer
      const composite = document.createElement('canvas');
      composite.width = project.width;
      composite.height = project.height;
      const cCtx = composite.getContext('2d')!;

      if (targetLayer.data) {
        const existing = new Image();
        await new Promise<void>(r => { existing.onload = () => { cCtx.drawImage(existing, 0, 0); r(); }; existing.src = targetLayer.data; });
      }

      cCtx.drawImage(
        genCanvas,
        selection.x, selection.y, selection.w, selection.h,
        selection.x, selection.y, selection.w, selection.h,
      );
      updateLayerData(targetFrame.id, targetLayer.id, composite.toDataURL());
    } else {
      updateLayerData(targetFrame.id, targetLayer.id, genCanvas.toDataURL());
    }
  }
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt]           = useState('');
  const [refineText, setRefineText]   = useState('');
  const [lastPrompt, setLastPrompt]   = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex]     = useState(0);
  const [showRefine, setShowRefine]   = useState(false);
  const [styleId, setStyleId]         = useState<string>('classic');
  const [viewId, setViewId]           = useState<string>('front');

  const { project, selection, saveHistory } = editor;

  // ── Build full prompt with style + view modifiers ──────────────────────
  const buildFullPrompt = useCallback((base: string) => {
    const style = STYLE_PRESETS.find(s => s.id === styleId);
    const view  = viewId !== 'front' ? `${viewId} view` : '';
    const parts = [base.trim(), view, style?.mod].filter(Boolean);
    return parts.join(', ');
  }, [styleId, viewId]);

  // ── Run generation with animated progress ─────────────────────────────
  const runWithProgress = useCallback(async (work: () => ImageData[]) => {
    setIsGenerating(true);
    setStepIndex(0);
    const stepMs = 130;
    for (let i = 0; i < STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, stepMs));
      setStepIndex(i + 1);
    }
    let frames: ImageData[];
    try {
      frames = work();
    } catch {
      toast.error('Generation failed — try a different prompt');
      setIsGenerating(false);
      return;
    }
    saveHistory();
    await commitFrames(frames, editor, selection);
    setIsGenerating(false);
  }, [editor, saveHistory, selection]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    const full = buildFullPrompt(prompt);
    await runWithProgress(() => {
      const frames = aiGenerator.generateFrames(full, project.width, project.height);
      setLastPrompt(full);
      return frames;
    });
    const where = selection ? 'selection' : 'canvas';
    toast.success(`Sprite generated on ${where}!`);
  }, [prompt, project.width, project.height, buildFullPrompt, runWithProgress, selection]);

  const handleRefine = useCallback(async () => {
    if (!refineText.trim()) return;
    const base = lastPrompt || buildFullPrompt(prompt);
    if (!base) { toast.error('Generate a sprite first'); return; }
    await runWithProgress(() => {
      const frames = aiGenerator.refine(base, refineText.trim(), project.width, project.height);
      setLastPrompt(`${base} ${refineText.trim()}`);
      return frames;
    });
    toast.success('Sprite refined!');
  }, [refineText, lastPrompt, prompt, buildFullPrompt, project.width, project.height, runWithProgress]);

  const handleSurprise = useCallback(async () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    const full = buildFullPrompt(pick);
    setPrompt(pick);
    setRefineText('');
    await runWithProgress(() => {
      const frames = aiGenerator.generateFrames(full, project.width, project.height);
      setLastPrompt(full);
      return frames;
    });
    toast.success(pick);
  }, [project.width, project.height, buildFullPrompt, runWithProgress]);

  const onPromptKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } };
  const onRefineKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } };

  const isAnimated = aiGenerator.isAnimated(buildFullPrompt(prompt));

  return (
    <div className="p-3 border-b border-border bg-card flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] font-pixel text-primary uppercase tracking-wider">
        <Sparkles size={12} /> Pixel AI
      </div>

      {/* Style presets */}
      <div className="flex flex-wrap gap-1">
        {STYLE_PRESETS.map(s => (
          <button
            key={s.id}
            onClick={() => setStyleId(s.id)}
            className={cn(
              'font-pixel text-[8px] px-2 py-0.5 rounded-sm border transition-colors',
              styleId === s.id
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-muted border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* View selector */}
      <div className="flex gap-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setViewId(v.id)}
            className={cn(
              'flex-1 font-pixel text-[8px] py-0.5 rounded-sm border transition-colors',
              viewId === v.id
                ? 'bg-accent/30 border-accent text-accent'
                : 'bg-muted border-border text-muted-foreground hover:border-accent/50'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Selection indicator */}
      {selection && (
        <div className="flex items-center gap-1 text-[8px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-sm">
          <span>⬚</span>
          Inpaint {selection.w}×{selection.h} selection
        </div>
      )}

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={onPromptKey}
        placeholder="jester, blue wizard, fire dragon…"
        className="w-full h-14 bg-input border border-border rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
        disabled={isGenerating}
      />

      {isAnimated && (
        <div className="text-[8px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-sm self-start">
          ✦ 4 animation frames
        </div>
      )}

      {isGenerating && (
        <div className="text-[8px] font-mono text-muted-foreground flex items-center gap-1.5 animate-pulse">
          <RefreshCcw size={8} className="animate-spin" />
          {STEPS[stepIndex]}
        </div>
      )}

      {/* Generate + Surprise */}
      <div className="flex gap-1.5">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="flex-1 bg-primary text-primary-foreground font-pixel text-[10px] py-1.5 rounded-sm hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {isGenerating ? <RefreshCcw size={10} className="animate-spin" /> : <Wand2 size={10} />}
          {selection ? 'INPAINT' : 'GENERATE'}
        </button>
        <button
          onClick={handleSurprise}
          disabled={isGenerating}
          title="Surprise Me"
          className="bg-secondary text-secondary-foreground font-pixel text-[10px] px-2.5 py-1.5 rounded-sm hover:bg-secondary/80 disabled:opacity-40 flex items-center gap-1"
        >
          <Shuffle size={10} /> ?
        </button>
      </div>

      {/* Refine toggle */}
      {lastPrompt && (
        <button
          onClick={() => setShowRefine(v => !v)}
          className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground hover:text-foreground self-start"
        >
          {showRefine ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          {showRefine ? 'Hide refine' : 'Refine sprite…'}
        </button>
      )}

      {/* Refine panel */}
      {showRefine && lastPrompt && (
        <div className="flex flex-col gap-1.5 border border-border/50 rounded-sm p-2 bg-background/40">
          <div className="text-[8px] font-mono text-muted-foreground truncate">
            Base: <span className="text-foreground/60 italic">{lastPrompt.slice(0, 50)}{lastPrompt.length > 50 ? '…' : ''}</span>
          </div>
          <textarea
            value={refineText}
            onChange={e => setRefineText(e.target.value)}
            onKeyDown={onRefineKey}
            placeholder='"add bells to hat" or "make it red and gold"'
            className="w-full h-12 bg-input border border-border rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
            disabled={isGenerating}
          />
          <button
            onClick={handleRefine}
            disabled={!refineText.trim() || isGenerating}
            className="bg-primary/80 text-primary-foreground font-pixel text-[10px] py-1.5 rounded-sm hover:bg-primary disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Wand2 size={10} /> REFINE
          </button>
        </div>
      )}

      {/* Keyword hints */}
      <div className="text-[8px] font-mono text-muted-foreground leading-relaxed">
        jester · wizard · knight · dragon · slime · skeleton · chest · mushroom · tree
        <br />
        + red · blue · gold · walking animation · isometric
      </div>
    </div>
  );
};

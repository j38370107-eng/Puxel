import React, { useState, useCallback } from 'react';
import { Wand2, RefreshCcw, Shuffle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { aiGenerator } from '../lib/aiGenerator';
import { SURPRISE_PROMPTS } from '../lib/pixelArtEngine';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';

interface AIGeneratorProps {
  editor: ReturnType<typeof usePixelEditor>;
}

// Commit an array of ImageData frames to the editor.
// Single frame → writes to active layer.
// Multiple frames → writes to the matching frame index (creates frames if needed).
async function commitFrames(
  imageDataFrames: ImageData[],
  editor: ReturnType<typeof usePixelEditor>,
) {
  const { project, activeFrameId, activeLayerId, updateLayerData } = editor;

  for (let fi = 0; fi < imageDataFrames.length; fi++) {
    const imgData = imageDataFrames[fi];

    // Pick the target frame (cycle if we have fewer frames than generated)
    const targetFrame = project.frames[fi] ?? project.frames[project.frames.length - 1];
    if (!targetFrame) continue;

    // Pick the active layer in that frame
    const targetLayer =
      fi === 0
        ? targetFrame.layers.find(l => l.id === activeLayerId) ?? targetFrame.layers[0]
        : targetFrame.layers[0];

    if (!targetLayer || targetLayer.locked) {
      if (fi === 0) toast.error('Active layer is locked');
      continue;
    }

    // Convert ImageData → dataURL on a temp canvas
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = project.width;
    tmpCanvas.height = project.height;
    const ctx = tmpCanvas.getContext('2d')!;
    ctx.putImageData(imgData, 0, 0);

    updateLayerData(targetFrame.id, targetLayer.id, tmpCanvas.toDataURL());
  }
}

const GENERATION_STEPS = [
  'Parsing prompt…',
  'Sketching silhouette…',
  'Adding costume & colours…',
  'Drawing face & details…',
  'Applying shading…',
  'Final polish & outline…',
];

export const AIGenerator: React.FC<AIGeneratorProps> = ({ editor }) => {
  const [prompt, setPrompt] = useState('');
  const [refineText, setRefineText] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showRefine, setShowRefine] = useState(false);
  const { project, saveHistory } = editor;

  // ── Step-through progress animation ──────────────────────────────────────
  const runWithProgress = useCallback(async (work: () => ImageData[]) => {
    setIsGenerating(true);
    setStepIndex(0);

    // Advance step labels on a timer for UX feel
    const stepMs = 130;
    for (let i = 0; i < GENERATION_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, stepMs));
      setStepIndex(i + 1);
    }

    let frames: ImageData[];
    try {
      frames = work();
    } catch (e) {
      toast.error('Generation failed – try a different prompt');
      setIsGenerating(false);
      return;
    }

    saveHistory();
    await commitFrames(frames, editor);
    setIsGenerating(false);
  }, [editor, saveHistory]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    await runWithProgress(() => {
      const frames = aiGenerator.generateFrames(prompt.trim(), project.width, project.height);
      setLastPrompt(prompt.trim());
      return frames;
    });
    toast.success('Sprite generated!');
  }, [prompt, project.width, project.height, runWithProgress]);

  // ── Refine ────────────────────────────────────────────────────────────────
  const handleRefine = useCallback(async () => {
    if (!refineText.trim()) return;
    const base = lastPrompt || prompt.trim();
    if (!base) { toast.error('Generate a sprite first, then refine it'); return; }
    await runWithProgress(() => {
      const frames = aiGenerator.refine(base, refineText.trim(), project.width, project.height);
      setLastPrompt(`${base} ${refineText.trim()}`);
      return frames;
    });
    toast.success('Sprite refined!');
  }, [refineText, lastPrompt, prompt, project.width, project.height, runWithProgress]);

  // ── Surprise Me ───────────────────────────────────────────────────────────
  const handleSurprise = useCallback(async () => {
    const pick = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
    setPrompt(pick);
    setRefineText('');
    await runWithProgress(() => {
      const frames = aiGenerator.generateFrames(pick, project.width, project.height);
      setLastPrompt(pick);
      return frames;
    });
    toast.success(`Generated: ${pick}`);
  }, [project.width, project.height, runWithProgress]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const onPromptKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
  };
  const onRefineKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); }
  };

  const isAnimated = aiGenerator.isAnimated(prompt);

  return (
    <div className="p-3 border-b border-border bg-card flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] font-pixel text-primary uppercase tracking-wider">
        <Sparkles size={12} />
        Pixel AI
      </div>

      {/* Prompt */}
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={onPromptKey}
        placeholder="e.g. jester, blue wizard, fire dragon…"
        className="w-full h-14 bg-input border border-border rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
        disabled={isGenerating}
      />

      {/* Animated badge */}
      {isAnimated && (
        <div className="text-[9px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-sm self-start">
          ✦ Will generate 4 animation frames
        </div>
      )}

      {/* Progress */}
      {isGenerating && (
        <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1.5 animate-pulse">
          <RefreshCcw size={9} className="animate-spin" />
          {GENERATION_STEPS[stepIndex]}
        </div>
      )}

      {/* Generate + Surprise Me */}
      <div className="flex gap-1.5">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="flex-1 bg-primary text-primary-foreground font-pixel text-[10px] py-1.5 rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {isGenerating ? <RefreshCcw size={10} className="animate-spin" /> : <Wand2 size={10} />}
          GENERATE
        </button>
        <button
          onClick={handleSurprise}
          disabled={isGenerating}
          title="Surprise Me – pick a random sprite"
          className="bg-secondary text-secondary-foreground font-pixel text-[10px] px-2 py-1.5 rounded-sm hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Shuffle size={10} />
          ?
        </button>
      </div>

      {/* Refine toggle */}
      {lastPrompt && (
        <button
          onClick={() => setShowRefine(v => !v)}
          className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          {showRefine ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          {showRefine ? 'Hide refine' : 'Refine sprite…'}
        </button>
      )}

      {/* Refine panel */}
      {showRefine && lastPrompt && (
        <div className="flex flex-col gap-1.5 border border-border/50 rounded-sm p-2 bg-background/40">
          <div className="text-[9px] font-mono text-muted-foreground">
            Refining: <span className="text-foreground/70 italic">{lastPrompt.slice(0, 40)}{lastPrompt.length > 40 ? '…' : ''}</span>
          </div>
          <textarea
            value={refineText}
            onChange={e => setRefineText(e.target.value)}
            onKeyDown={onRefineKey}
            placeholder='e.g. "add bells to hat" or "make it red and gold"'
            className="w-full h-12 bg-input border border-border rounded-sm p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
            disabled={isGenerating}
          />
          <button
            onClick={handleRefine}
            disabled={!refineText.trim() || isGenerating}
            className="bg-primary/80 text-primary-foreground font-pixel text-[10px] py-1.5 rounded-sm hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Wand2 size={10} />
            REFINE
          </button>
        </div>
      )}

      {/* Keyword hints */}
      <div className="text-[9px] font-mono text-muted-foreground leading-relaxed">
        Try: jester · wizard · knight · dragon · slime · skeleton · chest · mushroom · tree
        <br />
        Modifiers: red · blue · golden · detailed · walking animation
      </div>
    </div>
  );
};

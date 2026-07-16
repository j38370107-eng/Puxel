import React, { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  File, FolderOpen, Save, Download, Upload,
  ZoomIn, ZoomOut, Maximize, Keyboard, Wand2,
  Palette, Layers, Film, X, Grid
} from 'lucide-react';
import { usePixelEditor } from './hooks/usePixelEditor';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useIsMobile } from './hooks/use-mobile';
import { PixelCanvas } from './components/PixelCanvas';
import { Toolbar } from './components/Toolbar';
import { ColorPalette } from './components/ColorPalette';
import { LayerPanel } from './components/LayerPanel';
import { AnimationTimeline } from './components/AnimationTimeline';
import { AIGenerator } from './components/AIGenerator';
import { ModelManager } from './components/ModelManager';
import { ExportDialog } from './components/ExportDialog';
import { ImportDialog } from './components/ImportDialog';
import { NewProjectDialog } from './components/NewProjectDialog';
import { humanizer } from './lib/humanizer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient();

type MobilePanel = 'colors' | 'layers' | 'frames' | 'ai' | null;

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={cn('font-pixel text-primary flex items-center gap-2', small && 'text-[10px]')}>
    <div className={cn('bg-primary grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px]', small ? 'w-3 h-3' : 'w-4 h-4')}>
      <div className="bg-background" /><div className="bg-background" />
      <div className="bg-background" /><div className="bg-primary" />
    </div>
    {small ? 'PF Pro' : 'PixelForge Pro'}
  </div>
);

function Editor() {
  const editor = usePixelEditor();
  const {
    project, setProject,
    undo, redo, zoom, setZoom,
    activeFrameId, activeLayerId, updateLayerData, saveHistory,
    createNewProject,
  } = editor;

  const isMobile = useIsMobile();
  const [modelManagerMode, setModelManagerMode] = useState<'save' | 'load' | null>(null);
  const [exportOpen,     setExportOpen]     = useState(false);
  const [importOpen,     setImportOpen]     = useState(false);
  const [helpOpen,       setHelpOpen]       = useState(false);
  const [newProjOpen,    setNewProjOpen]    = useState(false);
  const [activePanel,    setActivePanel]    = useState<MobilePanel>(null);

  useEffect(() => {
    toast('Welcome to PixelForge Pro!', {
      description: isMobile
        ? 'Draw with one finger. Pinch to zoom. Two fingers to pan.'
        : 'Press ? for keyboard shortcuts.',
    });
  }, []);

  useKeyboardShortcuts([
    { key: 'b', action: () => editor.setCurrentTool('pencil') },
    { key: 'e', action: () => editor.setCurrentTool('eraser') },
    { key: 'g', action: () => editor.setCurrentTool('fill') },
    { key: 'i', action: () => editor.setCurrentTool('eyedropper') },
    { key: 'l', action: () => editor.setCurrentTool('line') },
    { key: 'r', action: () => editor.setCurrentTool('rect') },
    { key: 'o', action: () => editor.setCurrentTool('ellipse') },
    { key: 'v', action: () => editor.setCurrentTool('select') },
    { key: 'm', action: () => editor.setCurrentTool('move') },
    { key: 'z', ctrlKey: true, action: undo },
    { key: 'y', ctrlKey: true, action: redo },
    { key: 'z', ctrlKey: true, shiftKey: true, action: redo },
    { key: '=', action: () => setZoom(z => Math.min(32, z + 1)) },
    { key: '-', action: () => setZoom(z => Math.max(1, z - 1)) },
    { key: 's', ctrlKey: true, action: () => setModelManagerMode('save') },
    { key: 'n', ctrlKey: true, action: () => setNewProjOpen(true) },
    { key: '?', action: () => setHelpOpen(true) },
    { key: '/', shiftKey: true, action: () => setHelpOpen(true) },
  ]);

  const handleHumanize = async () => {
    const frame = project.frames.find(f => f.id === activeFrameId);
    const layer = frame?.layers.find(l => l.id === activeLayerId);
    if (!layer || !layer.data) return;
    saveHistory();
    const canvas = document.createElement('canvas');
    canvas.width = project.width; canvas.height = project.height;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    await new Promise<void>(resolve => { img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); }; img.src = layer.data; });
    const newImgData = humanizer.apply(ctx.getImageData(0, 0, project.width, project.height), { amount: 1 });
    ctx.putImageData(newImgData, 0, 0);
    updateLayerData(activeFrameId, activeLayerId, canvas.toDataURL('image/png'));
    toast.success('Humanized current layer');
  };

  const fitCanvas = () => {
    const container = document.querySelector('.pixel-canvas-area');
    if (!container) return;
    const { width: vw, height: vh } = container.getBoundingClientRect();
    setZoom(Math.max(1, Math.min(32, Math.min(Math.floor(vw / project.width), Math.floor(vh / project.height)))));
  };

  const togglePanel = (panel: MobilePanel) => setActivePanel(p => p === panel ? null : panel);

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    const tabs: { id: MobilePanel; icon: React.FC<any>; label: string }[] = [
      { id: 'colors', icon: Palette, label: 'Colors' },
      { id: 'layers', icon: Layers,  label: 'Layers' },
      { id: 'frames', icon: Film,    label: 'Frames' },
      { id: 'ai',    icon: Wand2,   label: 'AI' },
    ];

    return (
      <div className="flex flex-col w-full bg-background text-foreground overflow-hidden select-none" style={{ height: '100dvh' }}>
        <header className="h-10 border-b border-border bg-card flex items-center justify-between px-3 shrink-0 z-10">
          <Logo small />
          <div className="flex items-center gap-1">
            <button onClick={() => setModelManagerMode('load')} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><FolderOpen size={14} /></button>
            <button onClick={() => setModelManagerMode('save')} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><Save size={14} /></button>
            <button onClick={() => setExportOpen(true)} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><Download size={14} /></button>
            <div className="w-px h-4 bg-border mx-1" />
            <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><ZoomOut size={13} /></button>
            <span className="font-mono text-[10px] w-9 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><ZoomIn size={13} /></button>
            <button onClick={fitCanvas} className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"><Maximize size={13} /></button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative pixel-canvas-area">
          <PixelCanvas editor={editor} />
        </main>

        <div className="h-14 border-t border-border bg-card flex items-center overflow-x-auto shrink-0 z-10" style={{ WebkitOverflowScrolling: 'touch' }}>
          <Toolbar editor={editor} onHumanize={handleHumanize} layout="horizontal" />
        </div>

        <nav className="h-12 border-t border-border bg-card/95 backdrop-blur flex shrink-0 z-10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => togglePanel(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-pixel transition-colors active:opacity-70',
                activePanel === tab.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
            >
              <tab.icon size={16} />{tab.label}
            </button>
          ))}
        </nav>

        {activePanel && (
          <>
            <div className="fixed inset-0 z-20 bg-black/40" onClick={() => setActivePanel(null)} />
            <div className="fixed inset-x-0 bottom-12 z-30 bg-card border-t-2 border-primary shadow-2xl overflow-y-auto" style={{ maxHeight: '55vh' }}>
              <div className="sticky top-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/95 backdrop-blur z-10">
                <span className="font-pixel text-[10px] text-primary uppercase tracking-wider">{activePanel}</span>
                <button onClick={() => setActivePanel(null)} className="p-1 text-muted-foreground hover:text-white rounded"><X size={14} /></button>
              </div>
              {activePanel === 'colors' && <ColorPalette editor={editor} />}
              {activePanel === 'layers' && <LayerPanel editor={editor} compact />}
              {activePanel === 'frames' && <AnimationTimeline editor={editor} compact />}
              {activePanel === 'ai'     && <AIGenerator editor={editor} />}
            </div>
          </>
        )}

        {modelManagerMode && <ModelManager editor={editor} open={!!modelManagerMode} onOpenChange={open => !open && setModelManagerMode(null)} mode={modelManagerMode} />}
        <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />
      </div>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans select-none">
      {/* Top Bar */}
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="flex items-center gap-1 border-l border-border pl-6">
            <button onClick={() => setNewProjOpen(true)}           className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="New Project (Ctrl+N)"><File size={16} /></button>
            <button onClick={() => setModelManagerMode('load')}    className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Load Project"><FolderOpen size={16} /></button>
            <button onClick={() => setModelManagerMode('save')}    className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Save Project (Ctrl+S)"><Save size={16} /></button>
            <div className="w-px h-4 bg-border mx-2" />
            <button onClick={() => setImportOpen(true)}            className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Import Image"><Upload size={16} /></button>
            <button onClick={() => setExportOpen(true)}            className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Export"><Download size={16} /></button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Editable project name */}
          <input
            value={project.name}
            onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
            className="font-mono text-sm px-4 py-1 bg-input border border-border text-center min-w-[200px] focus:outline-none focus:border-primary"
          />
          {/* Size badge */}
          <span className="font-pixel text-[9px] text-muted-foreground border border-border px-2 py-1 bg-muted/30">
            {project.width}×{project.height}
          </span>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <button onClick={() => setZoom(z => Math.max(1, z - 1))}  className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded"><ZoomOut size={14} /></button>
            <span className="font-mono text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded"><ZoomIn size={14} /></button>
            <button onClick={fitCanvas}                                className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded ml-1" title="Fit to screen"><Maximize size={14} /></button>
          </div>
          <button onClick={() => setHelpOpen(true)} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors ml-2" title="Help / Shortcuts"><Keyboard size={16} /></button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-16 shrink-0 z-10 flex flex-col">
          <Toolbar editor={editor} onHumanize={handleHumanize} />
        </aside>

        <main className="flex-1 flex flex-col relative z-0 pixel-canvas-area">
          <PixelCanvas editor={editor} />
        </main>

        <aside className="w-64 border-l border-border bg-card flex flex-col shrink-0 z-10 overflow-y-auto">
          <ColorPalette editor={editor} />
          <LayerPanel editor={editor} />
          <AIGenerator editor={editor} />
        </aside>
      </div>

      <AnimationTimeline editor={editor} />

      {/* Dialogs */}
      {newProjOpen && (
        <NewProjectDialog
          onConfirm={(w, h, mode) => { createNewProject(w, h, mode); setNewProjOpen(false); }}
          onCancel={() => setNewProjOpen(false)}
        />
      )}
      {modelManagerMode && (
        <ModelManager editor={editor} open={!!modelManagerMode} onOpenChange={open => !open && setModelManagerMode(null)} mode={modelManagerMode} />
      )}
      <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div className="bg-card border-2 border-primary max-w-2xl w-full p-8 shadow-[0_0_50px_rgba(172,50,50,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-primary mb-6 text-xl text-center uppercase">PixelForge Pro Manual</h2>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold mb-3 font-mono text-secondary border-b border-border pb-2">Drawing Tools</h3>
                <ul className="space-y-1.5 font-mono text-sm text-muted-foreground">
                  {[['B','Pencil'],['E','Eraser'],['G','Flood Fill'],['I','Eyedropper'],['L','Line'],['R','Rectangle'],['O','Ellipse'],['V','Select'],['M','Move Layer']].map(([k,v]) => (
                    <li key={k}><span className="text-white bg-muted px-2 py-0.5 rounded text-xs">{k}</span> {v}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-3 font-mono text-secondary border-b border-border pb-2">Navigation & Actions</h3>
                <ul className="space-y-1.5 font-mono text-sm text-muted-foreground">
                  {[['Space+Drag','Pan'],['Scroll','Zoom'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['Ctrl+S','Save'],['Ctrl+N','New Project'],['Esc','Clear Selection'],['?','This Help']].map(([k,v]) => (
                    <li key={k}><span className="text-white bg-muted px-2 py-0.5 rounded text-xs">{k}</span> {v}</li>
                  ))}
                </ul>

                <h3 className="font-bold mt-5 mb-3 font-mono text-accent border-b border-border pb-2">Pixel AI</h3>
                <ul className="space-y-1 font-mono text-xs text-muted-foreground">
                  <li>• Type any subject — jester, knight, dragon…</li>
                  <li>• Select style preset + view direction</li>
                  <li>• Draw a <b className="text-white">selection (V)</b> then hit Generate to inpaint only that region</li>
                  <li>• <b className="text-white">Refine</b> to iteratively edit ("add bells", "make red")</li>
                  <li>• <b className="text-white">Surprise Me (?):</b> random curated prompt</li>
                  <li>• Add "walking animation" for 4 frames</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="font-mono text-xs text-muted-foreground">
                Mobile: Draw (1 finger) · Pinch zoom · 2-finger pan · Brush size selector in toolbar
              </p>
            </div>

            <button className="w-full mt-5 bg-primary text-primary-foreground font-pixel text-xs py-3 hover:bg-primary/90 transition-colors" onClick={() => setHelpOpen(false)}>
              START PIXELING
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            <Route path="/" component={Editor} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

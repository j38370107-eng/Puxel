import React, { useState, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  File, FolderOpen, Save, Download, Upload,
  ZoomIn, ZoomOut, Maximize, Keyboard, Wand2,
  Palette, Layers, Film, X, ChevronDown, Grid
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
import { humanizer } from './lib/humanizer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient();

type MobilePanel = 'colors' | 'layers' | 'frames' | 'ai' | null;

function Editor() {
  const editor = usePixelEditor();
  const {
    project, setProject,
    undo, redo, zoom, setZoom,
    activeFrameId, activeLayerId, updateLayerData, saveHistory
  } = editor;

  const isMobile = useIsMobile();
  const [modelManagerMode, setModelManagerMode] = useState<'save' | 'load' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<MobilePanel>(null);

  useEffect(() => {
    toast('Welcome to PixelForge!', {
      description: isMobile
        ? 'Draw with one finger. Pinch to zoom. Two fingers to pan.'
        : 'Press ? to see keyboard shortcuts.',
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
    { key: 'z', ctrlKey: true, action: undo },
    { key: 'y', ctrlKey: true, action: redo },
    { key: 'z', ctrlKey: true, shiftKey: true, action: redo },
    { key: '=', action: () => setZoom(z => Math.min(32, z + 1)) },
    { key: '-', action: () => setZoom(z => Math.max(1, z - 1)) },
    { key: 's', ctrlKey: true, action: () => setModelManagerMode('save') },
    { key: 'n', ctrlKey: true, action: handleNew },
    { key: '?', action: () => setHelpOpen(true) },
    { key: '/', shiftKey: true, action: () => setHelpOpen(true) },
  ]);

  function handleNew() {
    if (confirm('Create new project? Unsaved changes will be lost.')) {
      setProject({
        ...project,
        id: crypto.randomUUID(),
        name: 'Untitled Sprite',
        frames: [{
          id: crypto.randomUUID(),
          duration: 100,
          layers: [
            { id: crypto.randomUUID(), name: 'Background', visible: true, locked: false, opacity: 1, data: '' },
            { id: crypto.randomUUID(), name: 'Midground', visible: true, locked: false, opacity: 1, data: '' },
            { id: crypto.randomUUID(), name: 'Foreground', visible: true, locked: false, opacity: 1, data: '' }
          ]
        }]
      });
    }
  }

  const handleHumanize = async () => {
    const frame = project.frames.find(f => f.id === activeFrameId);
    const layer = frame?.layers.find(l => l.id === activeLayerId);
    if (!layer || !layer.data) return;

    saveHistory();
    const canvas = document.createElement('canvas');
    canvas.width = project.width;
    canvas.height = project.height;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    await new Promise<void>(resolve => {
      img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
      img.src = layer.data;
    });

    const imgData = ctx.getImageData(0, 0, project.width, project.height);
    const newImgData = humanizer.apply(imgData, { amount: 1 });
    ctx.putImageData(newImgData, 0, 0);
    updateLayerData(activeFrameId, activeLayerId, canvas.toDataURL('image/png'));
    toast.success('Humanized current layer');
  };

  const fitCanvas = () => {
    // Fit zoom to viewport
    const container = document.querySelector('.pixel-canvas-area');
    if (!container) return;
    const { width: vw, height: vh } = container.getBoundingClientRect();
    const fitZoom = Math.min(Math.floor(vw / project.width), Math.floor(vh / project.height));
    setZoom(Math.max(1, Math.min(32, fitZoom)));
  };

  const togglePanel = (panel: MobilePanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
  if (isMobile) {
    const mobileTabs: { id: MobilePanel; icon: React.FC<any>; label: string }[] = [
      { id: 'colors', icon: Palette, label: 'Colors' },
      { id: 'layers', icon: Layers, label: 'Layers' },
      { id: 'frames', icon: Film, label: 'Frames' },
      { id: 'ai', icon: Wand2, label: 'AI' },
    ];

    return (
      <div
        className="flex flex-col w-full bg-background text-foreground overflow-hidden select-none"
        style={{ height: '100dvh' }}
      >
        {/* Compact Mobile Header */}
        <header className="h-10 border-b border-border bg-card flex items-center justify-between px-3 shrink-0 z-10">
          <div className="font-pixel text-primary text-[10px] flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary grid grid-cols-2 gap-[1px] p-[1px]">
              <div className="bg-background" /><div className="bg-background" />
              <div className="bg-background" /><div className="bg-primary" />
            </div>
            PF
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setModelManagerMode('load')}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <FolderOpen size={14} />
            </button>
            <button
              onClick={() => setModelManagerMode('save')}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <Save size={14} />
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <Download size={14} />
            </button>

            <div className="w-px h-4 bg-border mx-1" />

            <button
              onClick={() => setZoom(z => Math.max(1, z - 1))}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <ZoomOut size={13} />
            </button>
            <span className="font-mono text-[10px] w-9 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(32, z + 1))}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={fitCanvas}
              className="p-1.5 text-muted-foreground hover:text-white bg-muted/50 rounded active:opacity-70"
            >
              <Maximize size={13} />
            </button>
          </div>
        </header>

        {/* Canvas — fills all space between header and tool strip */}
        <main className="flex-1 overflow-hidden relative pixel-canvas-area">
          <PixelCanvas editor={editor} />
        </main>

        {/* Horizontal Tool Strip */}
        <div className="h-14 border-t border-border bg-card flex items-center overflow-x-auto shrink-0 z-10"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          <Toolbar editor={editor} onHumanize={handleHumanize} layout="horizontal" />
        </div>

        {/* Bottom Navigation Tabs */}
        <nav className="h-12 border-t border-border bg-card/95 backdrop-blur flex shrink-0 z-10">
          {mobileTabs.map(tab => (
            <button
              key={tab.id}
              data-testid={`mobile-tab-${tab.id}`}
              onClick={() => togglePanel(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-pixel transition-colors active:opacity-70',
                activePanel === tab.id
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Panel Overlay — slides up from bottom */}
        {activePanel && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-20 bg-black/40"
              onClick={() => setActivePanel(null)}
            />

            {/* Panel Sheet */}
            <div
              className="fixed inset-x-0 bottom-12 z-30 bg-card border-t-2 border-primary shadow-2xl overflow-y-auto"
              style={{ maxHeight: '55vh' }}
            >
              {/* Panel Header */}
              <div className="sticky top-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/95 backdrop-blur z-10">
                <span className="font-pixel text-[10px] text-primary uppercase tracking-wider">
                  {activePanel}
                </span>
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1 text-muted-foreground hover:text-white rounded"
                >
                  <X size={14} />
                </button>
              </div>

              {activePanel === 'colors' && <ColorPalette editor={editor} />}
              {activePanel === 'layers' && <LayerPanel editor={editor} compact />}
              {activePanel === 'frames' && <AnimationTimeline editor={editor} compact />}
              {activePanel === 'ai' && <AIGenerator editor={editor} />}
            </div>
          </>
        )}

        {/* Dialogs */}
        {modelManagerMode && (
          <ModelManager
            editor={editor}
            open={!!modelManagerMode}
            onOpenChange={(open) => !open && setModelManagerMode(null)}
            mode={modelManagerMode}
          />
        )}
        <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans select-none">
      {/* Top Bar */}
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <div className="font-pixel text-primary flex items-center gap-2">
            <div className="w-4 h-4 bg-primary grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px]">
              <div className="bg-background" />
              <div className="bg-background" />
              <div className="bg-background" />
              <div className="bg-primary" />
            </div>
            PixelForge
          </div>

          <div className="flex items-center gap-1 border-l border-border pl-6">
            <button onClick={handleNew} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="New Project (Ctrl+N)"><File size={16} /></button>
            <button onClick={() => setModelManagerMode('load')} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Load Project"><FolderOpen size={16} /></button>
            <button onClick={() => setModelManagerMode('save')} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Save Project (Ctrl+S)"><Save size={16} /></button>
            <div className="w-[1px] h-4 bg-border mx-2" />
            <button onClick={() => setImportOpen(true)} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Import Asset"><Upload size={16} /></button>
            <button onClick={() => setExportOpen(true)} className="p-2 text-muted-foreground hover:text-white hover:bg-muted rounded transition-colors" title="Export"><Download size={16} /></button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono text-sm px-4 py-1 bg-input border border-border text-center min-w-[200px]">
            {project.name}
          </div>
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded"><ZoomOut size={14} /></button>
            <span className="font-mono text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded"><ZoomIn size={14} /></button>
            <button onClick={fitCanvas} className="p-1.5 text-muted-foreground hover:text-white bg-muted rounded ml-1" title="Fit to screen"><Maximize size={14} /></button>
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
      {modelManagerMode && (
        <ModelManager
          editor={editor}
          open={!!modelManagerMode}
          onOpenChange={(open) => !open && setModelManagerMode(null)}
          mode={modelManagerMode}
        />
      )}
      <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div className="bg-card border-2 border-primary max-w-2xl w-full p-8 font-sans shadow-[0_0_50px_rgba(172,50,50,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-primary mb-6 text-xl text-center uppercase">PixelForge Manual</h2>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold mb-4 font-mono text-secondary border-b border-border pb-2">Tools</h3>
                <ul className="space-y-2 font-mono text-sm text-muted-foreground">
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">B</span> Pencil</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">E</span> Eraser</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">G</span> Flood Fill</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">I</span> Eyedropper</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">L</span> Line</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">R</span> Rectangle</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">O</span> Ellipse</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-4 font-mono text-secondary border-b border-border pb-2">Navigation</h3>
                <ul className="space-y-2 font-mono text-sm text-muted-foreground">
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Space+Drag</span> Pan</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Scroll</span> Zoom</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Ctrl+Z</span> Undo</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Ctrl+Y</span> Redo</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Ctrl+S</span> Save</li>
                  <li><span className="text-white bg-muted px-2 py-0.5 rounded">Ctrl+N</span> New</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <h3 className="font-bold mb-2 font-mono text-accent flex items-center gap-2 text-sm">
                Mobile: Draw (1 finger) · Pinch zoom · 2-finger pan
              </h3>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                Procedural AI generates sprites from text keywords entirely in your browser — no internet required.
                Use Humanize to add subtle hand-crafted imperfections.
              </p>
            </div>

            <button className="w-full mt-6 bg-primary text-primary-foreground font-pixel text-xs py-3 hover:bg-primary/90 transition-colors" onClick={() => setHelpOpen(false)}>
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

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  File, FolderOpen, Save, Download, Upload,
  ZoomIn, ZoomOut, Maximize, Keyboard, Wand2,
  Palette, Layers, Film, X, Settings as SettingsIcon,
  Library, Play, Edit3, Type, Map as MapIcon, Image as ImageIcon
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

type WorkspaceMode = 'ai' | 'character' | 'map' | 'animation' | 'titles' | 'library' | 'settings';

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={cn('font-pixel text-primary flex items-center gap-3', small ? 'text-[10px]' : 'text-[14px]')}>
    <div className={cn('bg-primary grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px] shadow-[0_0_10px_rgba(124,58,237,0.5)]', small ? 'w-4 h-4' : 'w-6 h-6')}>
      <div className="bg-background" /><div className="bg-background" />
      <div className="bg-background" /><div className="bg-primary" />
    </div>
    <span className="tracking-widest" style={{ textShadow: '0 0 10px rgba(124,58,237,0.5)' }}>PIXELFORGE</span>
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('ai');
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);

  useEffect(() => {
    toast('Welcome to PixelForge Pro', {
      description: 'Press ? for keyboard shortcuts.',
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
    { key: 's', ctrlKey: true, action: () => setWorkspaceMode('library') },
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

  const navItems = [
    { id: 'ai', label: 'AI Studio', icon: Wand2 },
    { id: 'character', label: 'Character', icon: Edit3 },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'animation', label: 'Animation', icon: Play },
    { id: 'titles', label: 'Titles', icon: Type },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  // ── DESKTOP & MOBILE WRAPPER ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0e] text-foreground overflow-hidden font-sans select-none">
      {/* Top Nav */}
      <header className="h-14 border-b border-[#111118] bg-[#0d0d12] flex items-center justify-between px-4 shrink-0 shadow-md z-20">
        <div className="flex items-center gap-8 h-full">
          <Logo />
          <nav className="hidden md:flex items-center h-full">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setWorkspaceMode(item.id as WorkspaceMode)}
                className={cn(
                  'h-full px-4 flex items-center gap-2 font-pixel text-[10px] uppercase transition-all border-b-2',
                  workspaceMode === item.id
                    ? 'border-primary text-primary bg-primary/5 text-shadow-glow'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <item.icon size={14} className={workspaceMode === item.id ? "drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]" : ""} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {workspaceMode !== 'library' && (
            <>
              <input
                value={project.name}
                onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
                className="font-mono text-xs px-3 py-1.5 bg-[#111118] border border-[#1a1a24] text-center min-w-[150px] focus:outline-none focus:border-primary/50 text-foreground/90 transition-colors"
                placeholder="Project Name"
              />
              <div className="flex items-center gap-1 bg-[#111118] rounded-sm border border-[#1a1a24] p-0.5">
                <button onClick={() => setImportOpen(true)} className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-sm transition-colors" title="Import Image"><Upload size={14} /></button>
                <button onClick={() => setExportOpen(true)} className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-sm transition-colors" title="Export"><Download size={14} /></button>
              </div>
              <div className="flex items-center gap-1 bg-[#111118] rounded-sm border border-[#1a1a24] p-0.5 ml-2">
                <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-sm transition-colors"><ZoomOut size={14} /></button>
                <span className="font-mono text-[10px] w-10 text-center text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-sm transition-colors"><ZoomIn size={14} /></button>
                <button onClick={fitCanvas} className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/10 rounded-sm transition-colors ml-1" title="Fit to screen"><Maximize size={14} /></button>
              </div>
              <button onClick={() => setHelpOpen(true)} className="p-2 text-muted-foreground hover:text-white hover:bg-[#111118] rounded-sm transition-colors ml-2 border border-transparent hover:border-[#1a1a24]" title="Help / Shortcuts"><Keyboard size={16} /></button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {workspaceMode === 'library' ? (
          <ModelManager editor={editor} onClose={() => setWorkspaceMode('ai')} />
        ) : (
          <>
            <aside className="w-[56px] shrink-0 z-10 flex flex-col border-r border-[#111118] bg-[#0d0d12] crt-overlay">
              <Toolbar editor={editor} onHumanize={handleHumanize} />
            </aside>

            <main className="flex-1 flex flex-col relative z-0 pixel-canvas-area bg-[#08080a]">
              <PixelCanvas editor={editor} />
              
              {/* Bottom Timeline if not in settings */}
              {workspaceMode !== 'settings' && (
                <div className={cn(
                  "border-t border-[#111118] bg-[#0d0d12] transition-all duration-300",
                  workspaceMode === 'animation' ? "h-64" : "h-40"
                )}>
                  <AnimationTimeline editor={editor} expanded={workspaceMode === 'animation'} />
                </div>
              )}
            </main>

            <aside className="w-[280px] border-l border-[#111118] bg-[#0d0d12] flex flex-col shrink-0 z-10 overflow-y-auto crt-overlay shadow-[-5px_0_20px_rgba(0,0,0,0.5)]">
              {workspaceMode === 'ai' && (
                <>
                  <AIGenerator editor={editor} />
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                </>
              )}
              {workspaceMode === 'character' && (
                <>
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                  {/* <PropertiesPanel editor={editor} /> */}
                </>
              )}
              {workspaceMode === 'map' && (
                <>
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                </>
              )}
              {workspaceMode === 'animation' && (
                <>
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                </>
              )}
              {workspaceMode === 'titles' && (
                <>
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                </>
              )}
              {workspaceMode === 'settings' && (
                <div className="p-4 flex flex-col gap-4">
                  <h3 className="font-pixel text-[10px] text-primary uppercase border-b border-[#1a1a24] pb-2">Settings</h3>
                  <div className="font-mono text-xs text-muted-foreground">
                    Project Size: {project.width}x{project.height}
                  </div>
                  <button 
                    onClick={() => setNewProjOpen(true)}
                    className="bg-[#1a1a24] text-foreground font-pixel text-[10px] py-2 rounded-sm hover:bg-[#2a2a35] transition-colors border border-[#2a2a35]"
                  >
                    NEW PROJECT
                  </button>
                </div>
              )}
            </aside>
          </>
        )}
      </div>

      {/* Dialogs */}
      {newProjOpen && (
        <NewProjectDialog
          onConfirm={(w, h, mode) => { createNewProject(w, h, mode); setNewProjOpen(false); setWorkspaceMode('ai'); }}
          onCancel={() => setNewProjOpen(false)}
        />
      )}
      <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div className="bg-[#0d0d12] border border-[#2a1545] max-w-2xl w-full p-8 shadow-[0_0_50px_rgba(124,58,237,0.15)] rounded-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-primary mb-8 text-xl text-center uppercase tracking-widest drop-shadow-[0_0_10px_rgba(124,58,237,0.5)]">PixelForge Manual</h2>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold mb-4 font-mono text-accent border-b border-[#1a1a24] pb-2">Drawing Tools</h3>
                <ul className="space-y-2 font-mono text-xs text-muted-foreground">
                  {[['B','Pencil'],['E','Eraser'],['G','Flood Fill'],['I','Eyedropper'],['L','Line'],['R','Rectangle'],['O','Ellipse'],['V','Select'],['M','Move Layer']].map(([k,v]) => (
                    <li key={k} className="flex items-center gap-3">
                      <span className="text-white bg-[#1a1a24] border border-[#2a2a35] px-2 py-0.5 rounded-sm min-w-[24px] text-center shadow-inner">{k}</span> 
                      {v}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold mb-4 font-mono text-secondary-foreground border-b border-[#1a1a24] pb-2">Navigation & Actions</h3>
                <ul className="space-y-2 font-mono text-xs text-muted-foreground">
                  {[['Space+Drag','Pan'],['Scroll','Zoom'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['Ctrl+S','Save Library'],['Ctrl+N','New Project'],['Esc','Clear Selection'],['?','This Help']].map(([k,v]) => (
                    <li key={k} className="flex items-center gap-3">
                      <span className="text-white bg-[#1a1a24] border border-[#2a2a35] px-2 py-0.5 rounded-sm text-center shadow-inner">{k}</span> 
                      {v}
                    </li>
                  ))}
                </ul>

                <h3 className="font-bold mt-8 mb-4 font-mono text-primary border-b border-[#1a1a24] pb-2">Pixel AI Studio</h3>
                <ul className="space-y-2 font-mono text-xs text-muted-foreground leading-relaxed">
                  <li><span className="text-white/80">•</span> Select <b className="text-white">Style & View</b></li>
                  <li><span className="text-white/80">•</span> Draw a <b className="text-white">selection (V)</b> to inpaint</li>
                  <li><span className="text-white/80">•</span> Use <b className="text-white">Refine</b> to edit iteratively</li>
                </ul>
              </div>
            </div>

            <button className="w-full mt-10 bg-primary/20 text-primary border border-primary/50 font-pixel text-xs py-4 hover:bg-primary hover:text-white transition-all duration-300 tracking-widest shadow-[0_0_15px_rgba(124,58,237,0.2)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)]" onClick={() => setHelpOpen(false)}>
              RETURN TO FORGE
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
        <Editor />
        <Toaster theme="dark" toastOptions={{ className: 'font-mono text-xs bg-[#0d0d12] border-[#2a1545] text-foreground' }} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

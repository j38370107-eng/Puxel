import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  File, FolderOpen, Save, Download, Upload,
  ZoomIn, ZoomOut, Maximize, Keyboard, Wand2,
  Palette, Layers, Film, X, Settings as SettingsIcon,
  Library, Play, Edit3, Type, Map as MapIcon, Image as ImageIcon,
  ChevronDown, MoreHorizontal, Pencil,
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
type MobilePanel = 'tools' | 'ai' | 'layers' | 'palette' | 'more' | null;

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo: React.FC<{ small?: boolean }> = ({ small }) => (
  <div className={cn('font-pixel text-primary flex items-center gap-3', small ? 'text-[10px]' : 'text-[14px]')}>
    <div className={cn('bg-primary grid grid-cols-2 grid-rows-2 gap-[1px] p-[1px] shadow-[0_0_10px_rgba(124,58,237,0.5)]', small ? 'w-4 h-4' : 'w-6 h-6')}>
      <div className="bg-background" /><div className="bg-background" />
      <div className="bg-background" /><div className="bg-primary" />
    </div>
    {!small && (
      <span className="tracking-widest" style={{ textShadow: '0 0 10px rgba(124,58,237,0.5)' }}>PIXELFORGE</span>
    )}
  </div>
);

// ── Mobile Bottom Sheet ───────────────────────────────────────────────────────
const MobileSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}> = ({ open, onClose, title, children, fullHeight }) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'relative bg-[#0d0d12] border-t border-[#2a1545] rounded-t-2xl shadow-[0_-10px_60px_rgba(124,58,237,0.15)] overflow-hidden flex flex-col',
          fullHeight ? 'h-[90vh]' : 'max-h-[75vh]'
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a24] shrink-0">
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 bg-[#2a1545] rounded-full" />
          <span className="font-pixel text-[10px] text-primary uppercase tracking-widest mt-2">{title}</span>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-white mt-2">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────────
const MobileBottomNav: React.FC<{
  active: MobilePanel;
  onSelect: (p: MobilePanel) => void;
  workspaceMode: WorkspaceMode;
}> = ({ active, onSelect, workspaceMode }) => {
  const tabs: { id: MobilePanel; icon: React.FC<any>; label: string }[] = [
    { id: 'tools', icon: Pencil, label: 'Draw' },
    { id: 'ai', icon: Wand2, label: 'AI' },
    { id: 'layers', icon: Layers, label: 'Layers' },
    { id: 'palette', icon: Palette, label: 'Colors' },
    { id: 'more', icon: MoreHorizontal, label: 'More' },
  ];

  return (
    <nav className="h-16 bg-[#0d0d12] border-t border-[#111118] flex items-stretch shrink-0 safe-area-bottom">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(active === tab.id ? null : tab.id)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 transition-colors',
            active === tab.id
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <tab.icon size={18} className={active === tab.id ? 'drop-shadow-[0_0_6px_rgba(124,58,237,0.8)]' : ''} />
          <span className="font-pixel text-[7px] uppercase">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);

  useEffect(() => {
    toast('Welcome to PixelForge Pro', {
      description: isMobile ? 'Tap the bottom tabs to switch panels.' : 'Press ? for keyboard shortcuts.',
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

  const rightPanelContent = (mode: WorkspaceMode) => (
    <>
      {(mode === 'ai') && <AIGenerator editor={editor} />}
      {(mode === 'character' || mode === 'map' || mode === 'animation' || mode === 'titles') && null}
      <LayerPanel editor={editor} />
      <ColorPalette editor={editor} />
      {mode === 'settings' && (
        <div className="p-4 flex flex-col gap-4">
          <h3 className="font-pixel text-[10px] text-primary uppercase border-b border-[#1a1a24] pb-2">Settings</h3>
          <div className="font-mono text-xs text-muted-foreground">
            Project Size: {project.width}×{project.height}
          </div>
          <button
            onClick={() => setNewProjOpen(true)}
            className="bg-[#1a1a24] text-foreground font-pixel text-[10px] py-2 rounded-sm hover:bg-[#2a2a35] transition-colors border border-[#2a2a35]"
          >
            NEW PROJECT
          </button>
        </div>
      )}
    </>
  );

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    if (workspaceMode === 'library') {
      return (
        <div className="flex flex-col h-[100dvh] w-full bg-[#0a0a0e] text-foreground overflow-hidden">
          <ModelManager editor={editor} onClose={() => setWorkspaceMode('ai')} />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-[100dvh] w-full bg-[#0a0a0e] text-foreground overflow-hidden font-sans select-none">
        {/* Mobile Header */}
        <header className="h-12 border-b border-[#111118] bg-[#0d0d12] flex items-center justify-between px-3 shrink-0 z-20">
          <Logo small />
          <input
            value={project.name}
            onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
            className="font-mono text-[11px] px-2 py-1 bg-[#111118] border border-[#1a1a24] text-center w-32 focus:outline-none focus:border-primary/50 text-foreground/90 rounded-sm"
            placeholder="Project Name"
          />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-2 text-muted-foreground hover:text-white active:bg-white/10 rounded-sm"><ZoomOut size={15} /></button>
            <button onClick={fitCanvas} className="p-2 text-muted-foreground hover:text-white active:bg-white/10 rounded-sm"><Maximize size={15} /></button>
            <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-2 text-muted-foreground hover:text-white active:bg-white/10 rounded-sm"><ZoomIn size={15} /></button>
          </div>
        </header>

        {/* Main area: left toolbar + canvas */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left tools — narrow strip, always visible */}
          <aside className="w-[48px] shrink-0 z-10 flex flex-col border-r border-[#111118] bg-[#0d0d12]">
            <Toolbar editor={editor} onHumanize={handleHumanize} />
          </aside>

          {/* Canvas */}
          <main className="flex-1 flex flex-col relative z-0 pixel-canvas-area bg-[#08080a]">
            <PixelCanvas editor={editor} />
            {/* Minimal timeline strip */}
            <div className="h-20 border-t border-[#111118] bg-[#0d0d12] shrink-0">
              <AnimationTimeline editor={editor} expanded={false} />
            </div>
          </main>
        </div>

        {/* Mobile Bottom Nav */}
        <MobileBottomNav
          active={mobilePanel}
          onSelect={setMobilePanel}
          workspaceMode={workspaceMode}
        />

        {/* Mobile Sheets */}
        <MobileSheet open={mobilePanel === 'tools'} onClose={() => setMobilePanel(null)} title="Drawing Tools">
          <div className="p-3">
            <Toolbar editor={editor} onHumanize={handleHumanize} layout="horizontal" />
          </div>
        </MobileSheet>

        <MobileSheet open={mobilePanel === 'ai'} onClose={() => setMobilePanel(null)} title="AI Studio" fullHeight>
          <AIGenerator editor={editor} />
        </MobileSheet>

        <MobileSheet open={mobilePanel === 'layers'} onClose={() => setMobilePanel(null)} title="Layers">
          <LayerPanel editor={editor} />
        </MobileSheet>

        <MobileSheet open={mobilePanel === 'palette'} onClose={() => setMobilePanel(null)} title="Color Palette">
          <ColorPalette editor={editor} />
        </MobileSheet>

        <MobileSheet open={mobilePanel === 'more'} onClose={() => setMobilePanel(null)} title="More">
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={() => { setWorkspaceMode('library'); setMobilePanel(null); }}
              className="flex items-center gap-3 p-3 bg-[#111118] border border-[#1a1a24] rounded-sm font-mono text-sm text-foreground hover:border-primary/40 transition-colors"
            >
              <Library size={16} className="text-primary" /> Models Library
            </button>
            <button
              onClick={() => { setImportOpen(true); setMobilePanel(null); }}
              className="flex items-center gap-3 p-3 bg-[#111118] border border-[#1a1a24] rounded-sm font-mono text-sm text-foreground hover:border-primary/40 transition-colors"
            >
              <Upload size={16} className="text-primary" /> Import Image
            </button>
            <button
              onClick={() => { setExportOpen(true); setMobilePanel(null); }}
              className="flex items-center gap-3 p-3 bg-[#111118] border border-[#1a1a24] rounded-sm font-mono text-sm text-foreground hover:border-primary/40 transition-colors"
            >
              <Download size={16} className="text-primary" /> Export
            </button>
            <button
              onClick={() => { setNewProjOpen(true); setMobilePanel(null); }}
              className="flex items-center gap-3 p-3 bg-[#111118] border border-[#1a1a24] rounded-sm font-mono text-sm text-foreground hover:border-primary/40 transition-colors"
            >
              <File size={16} className="text-primary" /> New Project
            </button>
            <div className="mt-2 border-t border-[#1a1a24] pt-3">
              <p className="font-pixel text-[9px] text-muted-foreground uppercase mb-2">Mode</p>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setWorkspaceMode(item.id as WorkspaceMode); setMobilePanel(null); }}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-sm font-pixel text-[9px] uppercase border transition-colors',
                      workspaceMode === item.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[#1a1a24] bg-[#111118] text-muted-foreground'
                    )}
                  >
                    <item.icon size={12} /> {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </MobileSheet>

        {/* Dialogs */}
        {newProjOpen && (
          <NewProjectDialog
            onConfirm={(w, h, mode) => { createNewProject(w, h, mode); setNewProjOpen(false); }}
            onCancel={() => setNewProjOpen(false)}
          />
        )}
        <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0e] text-foreground overflow-hidden font-sans select-none">
      {/* Top Nav */}
      <header className="h-14 border-b border-[#111118] bg-[#0d0d12] flex items-center justify-between px-4 shrink-0 shadow-md z-20">
        <div className="flex items-center gap-8 h-full">
          <Logo />
          <nav className="flex items-center h-full">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setWorkspaceMode(item.id as WorkspaceMode)}
                className={cn(
                  'h-full px-4 flex items-center gap-2 font-pixel text-[10px] uppercase transition-all border-b-2',
                  workspaceMode === item.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <item.icon size={14} className={workspaceMode === item.id ? 'drop-shadow-[0_0_8px_rgba(124,58,237,0.8)]' : ''} />
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

              {workspaceMode !== 'settings' && (
                <div className={cn(
                  'border-t border-[#111118] bg-[#0d0d12] transition-all duration-300',
                  workspaceMode === 'animation' ? 'h-64' : 'h-40'
                )}>
                  <AnimationTimeline editor={editor} expanded={workspaceMode === 'animation'} />
                </div>
              )}
            </main>

            <aside className="w-[280px] border-l border-[#111118] bg-[#0d0d12] flex flex-col shrink-0 z-10 overflow-y-auto crt-overlay shadow-[-5px_0_20px_rgba(0,0,0,0.5)]">
              {workspaceMode === 'settings' ? (
                <div className="p-4 flex flex-col gap-4">
                  <h3 className="font-pixel text-[10px] text-primary uppercase border-b border-[#1a1a24] pb-2">Settings</h3>
                  <div className="font-mono text-xs text-muted-foreground">
                    Project Size: {project.width}×{project.height}
                  </div>
                  <button
                    onClick={() => setNewProjOpen(true)}
                    className="bg-[#1a1a24] text-foreground font-pixel text-[10px] py-2 rounded-sm hover:bg-[#2a2a35] transition-colors border border-[#2a2a35]"
                  >
                    NEW PROJECT
                  </button>
                </div>
              ) : (
                <>
                  {workspaceMode === 'ai' && <AIGenerator editor={editor} />}
                  <LayerPanel editor={editor} />
                  <ColorPalette editor={editor} />
                </>
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
                  {[['Space+Drag','Pan'],['Scroll','Zoom'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['Ctrl+S','Library'],['Ctrl+N','New Project'],['?','This Help']].map(([k,v]) => (
                    <li key={k} className="flex items-center gap-3">
                      <span className="text-white bg-[#1a1a24] border border-[#2a2a35] px-2 py-0.5 rounded-sm text-center shadow-inner">{k}</span>
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button className="w-full mt-10 bg-primary/20 text-primary border border-primary/50 font-pixel text-xs py-4 hover:bg-primary hover:text-white transition-all duration-300 tracking-widest" onClick={() => setHelpOpen(false)}>
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

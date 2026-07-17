import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Wand2, Edit3, Map as MapIcon, Play, Type, Library, Settings as SettingsIcon,
  Save, FilePlus, Upload, Download, Undo2, Redo2, ZoomIn, ZoomOut, Maximize,
  Pencil, Palette, Layers, Film, MoreHorizontal, X, ChevronUp, ChevronDown,
  PanelRight, PanelRightClose,
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
import { StatusBar } from './components/StatusBar';
import { humanizer } from './lib/humanizer';
import { cn } from '@/lib/utils';

const queryClient = new QueryClient();
type WorkspaceMode = 'ai' | 'character' | 'map' | 'animation' | 'titles' | 'library' | 'settings';
type MobilePanel = 'tools' | 'ai' | 'layers' | 'palette' | 'more' | null;

// ── Logo ───────────────────────────────────────────────────────────────────────
const Logo: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={cn('flex items-center gap-2 select-none', compact ? 'gap-1.5' : 'gap-2.5')}>
    <div className={cn(
      'grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] bg-primary shadow-[0_0_14px_rgba(124,58,237,0.6)]',
      compact ? 'w-5 h-5' : 'w-7 h-7'
    )}>
      <div className="bg-background/80" /><div className="bg-primary-foreground/10" />
      <div className="bg-primary-foreground/10" /><div className="bg-accent" />
    </div>
    {!compact && (
      <span className="font-pixel text-[11px] text-primary tracking-widest glow-purple hidden lg:block">
        PIXELFORGE
      </span>
    )}
  </div>
);

// ── Mobile bottom sheet ────────────────────────────────────────────────────────
const MobileSheet: React.FC<{
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; fullHeight?: boolean;
}> = ({ open, onClose, title, children, fullHeight }) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-card border-t-2 border-primary/40 rounded-t-2xl shadow-[0_-12px_60px_rgba(124,58,237,0.2)] flex flex-col overflow-hidden',
          fullHeight ? 'h-[92vh]' : 'max-h-[78vh]'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-9 h-1 bg-primary/30 rounded-full" />
        <div className="flex items-center justify-between px-4 pt-6 pb-3 border-b border-border shrink-0">
          <span className="font-pixel text-[10px] text-primary uppercase tracking-widest">{title}</span>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-white rounded-sm">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
};

// ── Mobile bottom nav ──────────────────────────────────────────────────────────
const MobileBottomNav: React.FC<{
  active: MobilePanel; onSelect: (p: MobilePanel) => void;
}> = ({ active, onSelect }) => {
  const tabs: { id: MobilePanel; icon: React.FC<any>; label: string }[] = [
    { id: 'tools',   icon: Pencil,       label: 'Draw' },
    { id: 'ai',      icon: Wand2,        label: 'AI' },
    { id: 'layers',  icon: Layers,       label: 'Layers' },
    { id: 'palette', icon: Palette,      label: 'Colors' },
    { id: 'more',    icon: MoreHorizontal, label: 'More' },
  ];
  return (
    <nav className="h-16 bg-card border-t-2 border-primary/20 flex items-stretch shrink-0 safe-area-bottom z-10">
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
          <tab.icon size={18} className={active === tab.id ? 'drop-shadow-[0_0_6px_rgba(124,58,237,0.9)]' : ''} />
          <span className="font-pixel text-[7px] uppercase">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

// ── Nav item button ────────────────────────────────────────────────────────────
const NavTab: React.FC<{
  id: WorkspaceMode; label: string; icon: React.FC<any>;
  active: boolean; onClick: () => void;
}> = ({ label, icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'h-full px-3 flex items-center gap-1.5 font-pixel text-[9px] uppercase tracking-wider transition-all border-b-2 whitespace-nowrap',
      active
        ? 'border-primary text-primary bg-primary/5'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30'
    )}
  >
    <Icon size={12} />
    <span className="hidden xl:block">{label}</span>
  </button>
);

// ── Icon action button ─────────────────────────────────────────────────────────
const ActionBtn: React.FC<{
  icon: React.FC<any>; tip: string; onClick: () => void;
  disabled?: boolean; active?: boolean; danger?: boolean;
}> = ({ icon: Icon, tip, onClick, disabled, active, danger }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded-sm border transition-colors disabled:opacity-30',
          danger
            ? 'bg-transparent border-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30'
            : active
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Icon size={14} />
      </button>
    </TooltipTrigger>
    <TooltipContent className="font-pixel text-[8px] bg-card border-primary/20">{tip}</TooltipContent>
  </Tooltip>
);

// ── Right panel section ────────────────────────────────────────────────────────
const PanelSection: React.FC<{
  title: string; icon?: React.FC<any>; children: React.ReactNode;
  defaultOpen?: boolean; noPad?: boolean;
}> = ({ title, icon: Icon, children, defaultOpen = true, noPad }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border flex flex-col shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between px-3 py-2.5 text-[9px] font-pixel text-muted-foreground uppercase tracking-wider hover:text-primary transition-colors group"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon size={11} className="text-primary/60 group-hover:text-primary transition-colors" />}
          {title}
        </span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && <div className={noPad ? '' : 'pb-1'}>{children}</div>}
    </div>
  );
};

// ── Generate thumbnail ─────────────────────────────────────────────────────────
async function generateThumbnail(
  project: ReturnType<typeof usePixelEditor>['project'],
  frameId: string
): Promise<string | undefined> {
  const frame = project.frames.find(f => f.id === frameId) || project.frames[0];
  if (!frame) return;
  const canvas = document.createElement('canvas');
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext('2d')!;
  for (const layer of [...frame.layers].reverse()) {
    if (!layer.visible || !layer.data) continue;
    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => { ctx.globalAlpha = layer.opacity; ctx.drawImage(img, 0, 0); resolve(); };
      img.src = layer.data;
    });
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

// ── Editor (main) ─────────────────────────────────────────────────────────────
function Editor() {
  const editor = usePixelEditor();
  const {
    project, setProject,
    undo, redo, zoom, setZoom,
    activeFrameId, activeLayerId,
    saveHistory, createNewProject, fgColor, bgColor,
    currentTool, setCurrentTool,
  } = editor;

  const isMobile                  = useIsMobile();
  const [mode, setMode]           = useState<WorkspaceMode>('ai');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen]   = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [rightOpen, setRightOpen]     = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [saving, setSaving]           = useState(false);

  // Welcome toast
  useEffect(() => {
    toast('Welcome to PixelForge Pro', {
      description: isMobile
        ? 'Tap the bottom tabs to switch panels.'
        : 'Use the mode tabs above to switch workspaces.',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand timeline in animation mode
  useEffect(() => {
    if (mode === 'animation') setTimelineExpanded(true);
  }, [mode]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'b',  action: () => setCurrentTool('pencil') },
    { key: 'e',  action: () => setCurrentTool('eraser') },
    { key: 'g',  action: () => setCurrentTool('fill') },
    { key: 'i',  action: () => setCurrentTool('eyedropper') },
    { key: 'l',  action: () => setCurrentTool('line') },
    { key: 'r',  action: () => setCurrentTool('rect') },
    { key: 'o',  action: () => setCurrentTool('ellipse') },
    { key: 'v',  action: () => setCurrentTool('select') },
    { key: 'm',  action: () => setCurrentTool('move') },
    { key: 'z',  ctrlKey: true, action: undo },
    { key: 'y',  ctrlKey: true, action: redo },
    { key: 'z',  ctrlKey: true, shiftKey: true, action: redo },
    { key: '=',  action: () => setZoom(z => Math.min(32, z + 1)) },
    { key: '-',  action: () => setZoom(z => Math.max(1, z - 1)) },
    { key: 'n',  ctrlKey: true, action: () => setNewProjOpen(true) },
    { key: 's',  ctrlKey: true, action: () => handleSave() },
    { key: 'Escape', action: () => setMobilePanel(null) },
  ]);

  const handleHumanize = async () => {
    const frame = project.frames.find(f => f.id === activeFrameId);
    const layer = frame?.layers.find(l => l.id === activeLayerId);
    if (!layer?.data) return;
    saveHistory();
    const canvas = document.createElement('canvas');
    canvas.width = project.width; canvas.height = project.height;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    await new Promise<void>(resolve => { img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); }; img.src = layer.data; });
    const newData = humanizer.apply(ctx.getImageData(0, 0, project.width, project.height), { amount: 1 });
    ctx.putImageData(newData, 0, 0);
    editor.updateLayerData(activeFrameId, activeLayerId, canvas.toDataURL('image/png'));
    toast.success('Humanizer applied!');
  };

  const fitCanvas = useCallback(() => {
    const el = document.querySelector('.canvas-area');
    if (!el) return;
    const { width: vw, height: vh } = el.getBoundingClientRect();
    setZoom(Math.max(1, Math.min(32,
      Math.min(Math.floor((vw - 40) / project.width), Math.floor((vh - 40) / project.height))
    )));
  }, [project.width, project.height, setZoom]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const thumbnail = await generateThumbnail(project, activeFrameId);
      const payload = {
        name: project.name,
        width: project.width,
        height: project.height,
        mode: project.mode,
        data: project,
        tags: [],
        ...(thumbnail ? { thumbnail } : {}),
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project saved to library!');
    } catch {
      toast.error('Failed to save project.');
    } finally {
      setSaving(false);
    }
  }, [project, activeFrameId]);

  const navItems: { id: WorkspaceMode; label: string; icon: React.FC<any> }[] = [
    { id: 'ai',        label: 'AI Studio',   icon: Wand2 },
    { id: 'character', label: 'Character',   icon: Edit3 },
    { id: 'map',       label: 'Map & World', icon: MapIcon },
    { id: 'animation', label: 'Animation',   icon: Play },
    { id: 'titles',    label: 'Titles & UI', icon: Type },
    { id: 'library',   label: 'Library',     icon: Library },
    { id: 'settings',  label: 'Settings',    icon: SettingsIcon },
  ];

  const activeFrame    = project.frames.find(f => f.id === activeFrameId) || project.frames[0];
  const activeLayer    = activeFrame?.layers.find(l => l.id === activeLayerId);
  const frameIndex     = project.frames.findIndex(f => f.id === activeFrameId);

  // ── Right panel content ──────────────────────────────────────────────────────
  const rightPanelContent = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Mode-specific top section */}
      {mode === 'ai' && (
        <PanelSection title="AI Studio" icon={Wand2} defaultOpen noPad>
          <AIGenerator editor={editor} />
        </PanelSection>
      )}
      {mode === 'settings' && (
        <PanelSection title="Settings" icon={SettingsIcon} defaultOpen>
          <div className="p-3 flex flex-col gap-3">
            <div className="text-[10px] font-mono text-muted-foreground">
              Canvas: {project.width}×{project.height}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              Frames: {project.frames.length}
            </div>
            <button
              onClick={() => setNewProjOpen(true)}
              className="bg-muted text-foreground font-pixel text-[9px] py-2.5 border border-border hover:border-primary/40 transition-colors"
            >
              NEW PROJECT
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground font-pixel text-[9px] py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {saving ? 'SAVING...' : 'SAVE TO LIBRARY'}
            </button>
          </div>
        </PanelSection>
      )}

      {/* Layers — always */}
      <PanelSection title="Layers" icon={Layers} defaultOpen noPad>
        <LayerPanel editor={editor} />
      </PanelSection>

      {/* Palette — always */}
      <PanelSection title="Palette" icon={Palette} defaultOpen noPad>
        <ColorPalette editor={editor} />
      </PanelSection>
    </div>
  );

  // ── MOBILE LAYOUT ────────────────────────────────────────────────────────────
  if (isMobile) {
    if (mode === 'library') {
      return (
        <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">
          <ModelManager editor={editor} onClose={() => setMode('ai')} />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden select-none">
        {/* Mobile header */}
        <header className="h-12 bg-card border-b-2 border-primary/20 flex items-center justify-between px-3 shrink-0 z-20">
          <Logo compact />
          <input
            value={project.name}
            onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
            className="font-mono text-[11px] px-2 py-1 bg-input border border-border text-center w-32 focus:outline-none focus:border-primary/50 text-foreground/90"
            placeholder="Project Name"
          />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="p-2 text-muted-foreground hover:text-white">
              <ZoomOut size={14} />
            </button>
            <button onClick={fitCanvas} className="p-2 text-muted-foreground hover:text-white">
              <Maximize size={14} />
            </button>
            <button onClick={() => setZoom(z => Math.min(32, z + 1))} className="p-2 text-muted-foreground hover:text-white">
              <ZoomIn size={14} />
            </button>
          </div>
        </header>

        {/* Main: tools strip + canvas */}
        <div className="flex-1 flex overflow-hidden relative">
          <aside className="w-12 shrink-0 border-r border-border bg-card flex flex-col z-10">
            <Toolbar editor={editor} onHumanize={handleHumanize} />
          </aside>
          <main className="flex-1 flex flex-col overflow-hidden canvas-area bg-[#06060d]">
            <div className="flex-1 overflow-hidden checker-bg relative">
              <PixelCanvas editor={editor} onCursorMove={setCursorPos} />
            </div>
            <div className="h-20 border-t border-border bg-card shrink-0">
              <AnimationTimeline editor={editor} expanded={false} />
            </div>
          </main>
        </div>

        {/* Bottom Nav */}
        <MobileBottomNav active={mobilePanel} onSelect={setMobilePanel} />

        {/* Sheets */}
        <MobileSheet open={mobilePanel === 'tools'} onClose={() => setMobilePanel(null)} title="Drawing Tools">
          <div className="p-3"><Toolbar editor={editor} onHumanize={handleHumanize} layout="horizontal" /></div>
        </MobileSheet>
        <MobileSheet open={mobilePanel === 'ai'} onClose={() => setMobilePanel(null)} title="AI Studio" fullHeight>
          <AIGenerator editor={editor} />
        </MobileSheet>
        <MobileSheet open={mobilePanel === 'layers'} onClose={() => setMobilePanel(null)} title="Layers">
          <LayerPanel editor={editor} />
        </MobileSheet>
        <MobileSheet open={mobilePanel === 'palette'} onClose={() => setMobilePanel(null)} title="Palette">
          <ColorPalette editor={editor} />
        </MobileSheet>
        <MobileSheet open={mobilePanel === 'more'} onClose={() => setMobilePanel(null)} title="More">
          <div className="p-4 flex flex-col gap-2">
            {[
              { icon: Library, label: 'Models Library', action: () => { setMode('library'); setMobilePanel(null); } },
              { icon: Upload, label: 'Import Image', action: () => { setImportOpen(true); setMobilePanel(null); } },
              { icon: Download, label: 'Export', action: () => { setExportOpen(true); setMobilePanel(null); } },
              { icon: FilePlus, label: 'New Project', action: () => { setNewProjOpen(true); setMobilePanel(null); } },
              { icon: Save, label: 'Save to Library', action: () => { handleSave(); setMobilePanel(null); } },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex items-center gap-3 p-3 bg-card border border-border font-mono text-sm text-foreground hover:border-primary/40 transition-colors"
              >
                <item.icon size={16} className="text-primary" /> {item.label}
              </button>
            ))}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="font-pixel text-[8px] text-muted-foreground uppercase mb-2">Workspace</p>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setMode(item.id as WorkspaceMode); setMobilePanel(null); }}
                    className={cn(
                      'flex items-center gap-2 p-2 font-pixel text-[8px] uppercase border transition-colors',
                      mode === item.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    <item.icon size={11} /> {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </MobileSheet>

        {/* Dialogs */}
        {newProjOpen && (
          <NewProjectDialog
            onConfirm={(w, h, m) => { createNewProject(w, h, m); setNewProjOpen(false); }}
            onCancel={() => setNewProjOpen(false)}
          />
        )}
        <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />
      </div>
    );
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────────────────────
  if (mode === 'library') {
    return (
      <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
        <ModelManager editor={editor} onClose={() => setMode('ai')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden select-none">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="h-12 bg-card border-b-2 border-primary/20 flex items-center px-3 gap-3 shrink-0 z-20 shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
        <Logo />

        {/* Mode tabs */}
        <nav className="flex items-stretch h-full overflow-x-auto gap-0 border-l border-border pl-3 ml-1">
          {navItems.map(item => (
            <NavTab
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              active={mode === item.id}
              onClick={() => setMode(item.id as WorkspaceMode)}
            />
          ))}
        </nav>

        <div className="flex-1" />

        {/* Project name */}
        <input
          value={project.name}
          onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
          className="font-mono text-[11px] px-2.5 py-1.5 bg-input border border-border focus:outline-none focus:border-primary/50 text-foreground/90 w-36 text-center hidden md:block"
          placeholder="Untitled"
        />

        {/* Actions */}
        <div className="flex items-center gap-0.5 border-l border-border pl-3">
          <ActionBtn icon={Undo2}     tip="Undo (Ctrl+Z)"     onClick={undo} />
          <ActionBtn icon={Redo2}     tip="Redo (Ctrl+Y)"     onClick={redo} />
        </div>
        <div className="flex items-center gap-0.5 border-l border-border pl-3">
          <ActionBtn icon={Upload}   tip="Import"    onClick={() => setImportOpen(true)} />
          <ActionBtn icon={Download} tip="Export"    onClick={() => setExportOpen(true)} />
          <ActionBtn icon={FilePlus} tip="New Project (Ctrl+N)" onClick={() => setNewProjOpen(true)} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-pixel text-[9px] uppercase hover:bg-primary/90 transition-all disabled:opacity-40 shadow-[0_0_14px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
              >
                <Save size={12} />
                <span className="hidden xl:block">{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className="font-pixel text-[8px] bg-card border-primary/20">Save to Library (Ctrl+S)</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* ── MAIN BODY ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Tools */}
        <aside className="w-14 shrink-0 border-r border-border bg-card flex flex-col z-10">
          <Toolbar editor={editor} onHumanize={handleHumanize} />
        </aside>

        {/* CENTER: Canvas area */}
        <main
          className="flex-1 flex items-center justify-center overflow-hidden relative canvas-area checker-bg"
          style={{ background: '#06060d' }}
        >
          {/* Checkerboard inside */}
          <div className="absolute inset-0 checker-bg opacity-60 pointer-events-none" />
          <PixelCanvas editor={editor} onCursorMove={setCursorPos} />
        </main>

        {/* RIGHT: Context panel */}
        {rightOpen && (
          <aside
            className="w-[var(--right-panel-w)] shrink-0 border-l border-border bg-card flex flex-col z-10 overflow-hidden"
          >
            {/* Panel header */}
            <div className="h-8 border-b border-border flex items-center justify-between px-3 shrink-0 bg-background/50">
              <span className="font-pixel text-[8px] text-primary/70 uppercase tracking-widest">Properties</span>
              <button
                onClick={() => setRightOpen(false)}
                className="p-1 text-muted-foreground hover:text-white transition-colors"
                title="Close Panel"
              >
                <PanelRightClose size={13} />
              </button>
            </div>
            {rightPanelContent}
          </aside>
        )}

        {/* Right panel toggle (when closed) */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-5 h-16 bg-card border border-border border-r-0 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors rounded-l-sm"
          >
            <PanelRight size={12} />
          </button>
        )}
      </div>

      {/* ── TIMELINE ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'border-t border-border bg-card shrink-0 transition-all duration-200',
          timelineExpanded ? 'h-48' : 'h-[var(--timeline-h)]'
        )}
      >
        {/* Timeline header */}
        <div className="flex items-center justify-between px-3 h-7 border-b border-border bg-background/40 shrink-0">
          <div className="flex items-center gap-2">
            <Film size={11} className="text-primary/60" />
            <span className="font-pixel text-[8px] text-muted-foreground uppercase tracking-wider">Timeline</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.min(32, z + 1))}
              className="p-1 text-muted-foreground hover:text-white"><ZoomIn size={11} /></button>
            <button
              onClick={() => setZoom(z => Math.max(1, z - 1))}
              className="p-1 text-muted-foreground hover:text-white"><ZoomOut size={11} /></button>
            <button
              onClick={fitCanvas}
              className="p-1 text-muted-foreground hover:text-white"><Maximize size={11} /></button>
            <button
              onClick={() => setTimelineExpanded(e => !e)}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
              title={timelineExpanded ? 'Collapse' : 'Expand'}
            >
              {timelineExpanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>
          </div>
        </div>
        <AnimationTimeline editor={editor} expanded={timelineExpanded} />
      </div>

      {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
      <StatusBar
        cursorPos={cursorPos}
        zoom={zoom}
        canvasSize={{ w: project.width, h: project.height }}
        activeTool={currentTool}
        fgColor={fgColor}
        bgColor={bgColor}
        frameIndex={frameIndex >= 0 ? frameIndex : 0}
        totalFrames={project.frames.length}
        layerName={activeLayer?.name ?? '—'}
      />

      {/* ── DIALOGS ────────────────────────────────────────────────────────── */}
      {newProjOpen && (
        <NewProjectDialog
          onConfirm={(w, h, m) => { createNewProject(w, h, m); setNewProjOpen(false); }}
          onCancel={() => setNewProjOpen(false)}
        />
      )}
      <ExportDialog editor={editor} open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog editor={editor} open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={600}>
        <div className="dark h-full">
          <Editor />
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: 'hsl(240 18% 8%)',
                border: '1px solid hsl(262 80% 40%)',
                color: 'hsl(240 8% 88%)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '11px',
              },
            }}
          />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

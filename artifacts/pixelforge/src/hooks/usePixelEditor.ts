import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectData, Tool, Mode, FrameData, LayerData, Selection } from '../types';
import { pixelEngine } from '../lib/pixelEngine';
import { storage } from '../lib/storage';

export const DEFAULT_PALETTE = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
];

const makeDefaultFrame = (): FrameData => ({
  id: crypto.randomUUID(),
  duration: 100,
  layers: [
    { id: crypto.randomUUID(), name: 'Background', visible: true, locked: false, opacity: 1, data: '' },
    { id: crypto.randomUUID(), name: 'Midground',  visible: true, locked: false, opacity: 1, data: '' },
    { id: crypto.randomUUID(), name: 'Foreground', visible: true, locked: false, opacity: 1, data: '' },
  ]
});

interface UsePixelEditorProps {
  initialProjectId?: string;
}

export const usePixelEditor = ({ initialProjectId }: UsePixelEditorProps = {}) => {
  const [project, setProject] = useState<ProjectData>(() => {
    if (initialProjectId) {
      const saved = storage.loadModel(initialProjectId);
      if (saved) return saved;
    }
    const frame = makeDefaultFrame();
    return {
      id: crypto.randomUUID(),
      name: 'Untitled Sprite',
      width: 32, height: 32,
      mode: 'sprite',
      frames: [frame],
      palette: [...DEFAULT_PALETTE],
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  });

  const [activeFrameId, setActiveFrameId]   = useState<string>(project.frames[0].id);
  const [activeLayerId, setActiveLayerId]   = useState<string>(project.frames[0].layers[1].id);
  const [currentTool, setCurrentTool]       = useState<Tool>('pencil');
  const [fgColor, setFgColor]               = useState<string>(project.palette[0] || '#000000');
  const [bgColor, setBgColor]               = useState<string>('#ffffff');
  const [zoom, setZoom]                     = useState<number>(10);
  const [showGrid, setShowGrid]             = useState<boolean>(true);
  const [isPlaying, setIsPlaying]           = useState<boolean>(false);
  const [fps, setFps]                       = useState<number>(10);
  const [onionSkin, setOnionSkin]           = useState<boolean>(false);
  const [brushSize, setBrushSize]           = useState<number>(1);
  const [selection, setSelection]           = useState<Selection | null>(null);

  // History
  const historyRef      = useRef<{ frames: FrameData[] }[]>([]);
  const historyIndexRef = useRef(-1);

  const saveHistory = useCallback(() => {
    const snapshot = { frames: JSON.parse(JSON.stringify(project.frames)) };
    const next = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, next);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 50) historyRef.current.shift();
    else historyIndexRef.current = next;
  }, [project.frames]);

  useEffect(() => { if (historyRef.current.length === 0) saveHistory(); }, [saveHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setProject(p => ({ ...p, frames: JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current].frames)) }));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setProject(p => ({ ...p, frames: JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current].frames)) }));
    }
  }, []);

  const updateLayerData = useCallback((frameId: string, layerId: string, dataUrl: string) => {
    setProject(p => ({
      ...p,
      frames: p.frames.map(f =>
        f.id !== frameId ? f : {
          ...f,
          layers: f.layers.map(l => l.id === layerId ? { ...l, data: dataUrl } : l)
        }
      )
    }));
  }, []);

  const addFrame = useCallback(() => {
    saveHistory();
    setProject(p => {
      const current = p.frames.find(f => f.id === activeFrameId)!;
      const newFrame: FrameData = {
        id: crypto.randomUUID(),
        duration: current.duration,
        layers: current.layers.map(l => ({ ...l, id: crypto.randomUUID(), data: l.data }))
      };
      return { ...p, frames: [...p.frames, newFrame] };
    });
  }, [activeFrameId, saveHistory]);

  const copyFrame = useCallback(() => {
    saveHistory();
    const idx = project.frames.findIndex(f => f.id === activeFrameId);
    if (idx === -1) return;
    const original = project.frames[idx];
    const newFrame: FrameData = {
      id: crypto.randomUUID(),
      duration: original.duration,
      layers: original.layers.map(l => ({ ...l, id: crypto.randomUUID() }))
    };
    const newFrames = [...project.frames];
    newFrames.splice(idx + 1, 0, newFrame);
    setProject(p => ({ ...p, frames: newFrames }));
    setActiveFrameId(newFrame.id);
  }, [project.frames, activeFrameId, saveHistory]);

  const deleteFrame = useCallback((id: string) => {
    if (project.frames.length <= 1) return;
    saveHistory();
    setProject(p => {
      const frames = p.frames.filter(f => f.id !== id);
      if (activeFrameId === id) setActiveFrameId(frames[0].id);
      return { ...p, frames };
    });
  }, [project.frames.length, activeFrameId, saveHistory]);

  /** Create a brand-new project, resetting all state. */
  const createNewProject = useCallback((width: number, height: number, mode: Mode = 'sprite') => {
    const frame = makeDefaultFrame();
    setProject({
      id: crypto.randomUUID(),
      name: 'Untitled Sprite',
      width, height, mode,
      frames: [frame],
      palette: [...DEFAULT_PALETTE],
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    setActiveFrameId(frame.id);
    setActiveLayerId(frame.layers[1].id);
    setSelection(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, []);

  // Autosave
  useEffect(() => {
    const t = setInterval(() => storage.saveAutoSave(project), 30000);
    return () => clearInterval(t);
  }, [project]);

  return {
    project, setProject,
    activeFrameId, setActiveFrameId,
    activeLayerId, setActiveLayerId,
    currentTool, setCurrentTool,
    fgColor, setFgColor,
    bgColor, setBgColor,
    zoom, setZoom,
    showGrid, setShowGrid,
    isPlaying, setIsPlaying,
    fps, setFps,
    onionSkin, setOnionSkin,
    brushSize, setBrushSize,
    selection, setSelection,
    undo, redo,
    updateLayerData,
    saveHistory,
    addFrame, copyFrame, deleteFrame,
    createNewProject,
  };
};

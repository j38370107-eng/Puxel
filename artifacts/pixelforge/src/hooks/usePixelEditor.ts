import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectData, Tool, Mode, FrameData, LayerData } from '../types';
import { pixelEngine } from '../lib/pixelEngine';
import { storage } from '../lib/storage';

export const DEFAULT_PALETTE = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
];

interface UsePixelEditorProps {
  initialProjectId?: string;
}

export const usePixelEditor = ({ initialProjectId }: UsePixelEditorProps = {}) => {
  const [project, setProject] = useState<ProjectData>(() => {
    if (initialProjectId) {
      const saved = storage.loadModel(initialProjectId);
      if (saved) return saved;
    }
    return {
      id: crypto.randomUUID(),
      name: 'Untitled Sprite',
      width: 32,
      height: 32,
      mode: 'sprite',
      frames: [{
        id: crypto.randomUUID(),
        duration: 100,
        layers: [
          { id: crypto.randomUUID(), name: 'Background', visible: true, locked: false, opacity: 1, data: '' },
          { id: crypto.randomUUID(), name: 'Midground', visible: true, locked: false, opacity: 1, data: '' },
          { id: crypto.randomUUID(), name: 'Foreground', visible: true, locked: false, opacity: 1, data: '' }
        ]
      }],
      palette: [...DEFAULT_PALETTE],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [activeFrameId, setActiveFrameId] = useState<string>(project.frames[0].id);
  const [activeLayerId, setActiveLayerId] = useState<string>(project.frames[0].layers[1].id);
  const [currentTool, setCurrentTool] = useState<Tool>('pencil');
  const [fgColor, setFgColor] = useState<string>(project.palette[0] || '#000000');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [zoom, setZoom] = useState<number>(10);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(10);
  const [onionSkin, setOnionSkin] = useState<boolean>(false);

  // History for undo/redo
  const historyRef = useRef<{ frames: FrameData[] }[]>([]);
  const historyIndexRef = useRef(-1);

  const saveHistory = useCallback(() => {
    const currentState = { frames: JSON.parse(JSON.stringify(project.frames)) };
    const nextIndex = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, nextIndex);
    historyRef.current.push(currentState);
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current = nextIndex;
    }
  }, [project.frames]);

  // Init history on mount
  useEffect(() => {
    if (historyRef.current.length === 0) saveHistory();
  }, [saveHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      setProject(p => ({ ...p, frames: JSON.parse(JSON.stringify(prevState.frames)) }));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      setProject(p => ({ ...p, frames: JSON.parse(JSON.stringify(nextState.frames)) }));
    }
  }, []);

  const updateLayerData = useCallback((frameId: string, layerId: string, dataUrl: string) => {
    setProject(p => {
      const newFrames = p.frames.map(f => {
        if (f.id !== frameId) return f;
        return {
          ...f,
          layers: f.layers.map(l => l.id === layerId ? { ...l, data: dataUrl } : l)
        };
      });
      return { ...p, frames: newFrames };
    });
  }, []);

  const addFrame = useCallback(() => {
    saveHistory();
    setProject(p => {
      const currentFrame = p.frames.find(f => f.id === activeFrameId)!;
      const newLayers = currentFrame.layers.map(l => ({
        ...l,
        id: crypto.randomUUID(),
        data: l.data // Duplicate content
      }));
      const newFrame = {
        id: crypto.randomUUID(),
        duration: currentFrame.duration,
        layers: newLayers
      };
      return { ...p, frames: [...p.frames, newFrame] };
    });
  }, [activeFrameId, saveHistory]);

  const deleteFrame = useCallback((id: string) => {
    if (project.frames.length <= 1) return;
    saveHistory();
    setProject(p => {
      const frames = p.frames.filter(f => f.id !== id);
      if (activeFrameId === id) setActiveFrameId(frames[0].id);
      return { ...p, frames };
    });
  }, [project.frames.length, activeFrameId, saveHistory]);

  // Autosave
  useEffect(() => {
    const timer = setInterval(() => {
      storage.saveAutoSave(project);
    }, 30000);
    return () => clearInterval(timer);
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
    undo, redo,
    updateLayerData,
    saveHistory,
    addFrame, deleteFrame
  };
};

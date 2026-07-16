export type Tool = 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse' | 'stamp';
export type Mode = 'sprite' | 'tilemap' | 'logo';

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  data: string; // base64 PNG data
}

export interface FrameData {
  id: string;
  layers: LayerData[];
  duration: number; // for GIF, e.g. 100ms
}

export interface ProjectData {
  id: string;
  name: string;
  width: number;
  height: number;
  mode: Mode;
  frames: FrameData[];
  palette: string[];
  createdAt: number;
  updatedAt: number;
}

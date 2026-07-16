export type Tool =
  | 'pencil' | 'eraser' | 'fill' | 'eyedropper'
  | 'line' | 'rect' | 'ellipse'
  | 'select' | 'move'
  | 'stamp';

export type Mode = 'sprite' | 'tilemap' | 'logo';

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  data: string; // base64 PNG
}

export interface FrameData {
  id: string;
  layers: LayerData[];
  duration: number;
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

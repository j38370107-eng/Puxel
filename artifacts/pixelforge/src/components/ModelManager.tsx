import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, FolderOpen, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { storage } from '../lib/storage';
import { ProjectData } from '../types';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';

interface ModelManagerProps {
  editor: ReturnType<typeof usePixelEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'save' | 'load';
}

export const ModelManager: React.FC<ModelManagerProps> = ({ editor, open, onOpenChange, mode }) => {
  const { project, setProject } = editor;
  const [models, setModels] = useState<Omit<ProjectData, 'frames'>[]>([]);
  const [saveName, setSaveName] = useState(project.name);

  useEffect(() => {
    if (open) {
      setModels(storage.getModels());
      setSaveName(project.name);
    }
  }, [open, project.name]);

  const handleSave = () => {
    const updated = { ...project, name: saveName };
    storage.saveModel(updated);
    setProject(updated);
    setModels(storage.getModels());
    toast.success('Project saved!');
    onOpenChange(false);
  };

  const handleLoad = (id: string) => {
    const loaded = storage.loadModel(id);
    if (loaded) {
      setProject(loaded);
      toast.success('Project loaded!');
      onOpenChange(false);
    } else {
      toast.error('Failed to load project');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.deleteModel(id);
    setModels(storage.getModels());
    toast.success('Project deleted');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border text-foreground font-sans rounded-none">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm text-primary uppercase">
            {mode === 'save' ? 'Save Project' : 'Load Project'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'save' ? (
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-muted-foreground">Project Name</label>
              <input 
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="bg-input border border-border p-2 font-mono text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button 
              onClick={handleSave}
              className="bg-primary text-primary-foreground font-pixel text-[10px] py-3 rounded-sm hover:bg-primary/90 flex justify-center items-center gap-2"
            >
              <Save size={14} /> SAVE TO LOCAL STORAGE
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto">
            {models.length === 0 ? (
              <div className="text-center text-muted-foreground font-mono text-sm py-8">
                No saved projects found.
              </div>
            ) : (
              models.map(model => (
                <div 
                  key={model.id}
                  onClick={() => handleLoad(model.id)}
                  className="flex items-center justify-between p-3 border border-border bg-muted/30 hover:bg-muted cursor-pointer group"
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-sm">{model.name}</span>
                    <span className="font-pixel text-[8px] text-muted-foreground mt-1">
                      {model.width}x{model.height} • {new Date(model.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(model.id, e)}
                    className="text-muted-foreground hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

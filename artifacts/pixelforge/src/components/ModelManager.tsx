import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, FolderOpen, Save, Plus } from 'lucide-react';
import { useListProjects, useDeleteProject, useGetProject } from '@workspace/api-client-react';
import { storage } from '../lib/storage';
import { ProjectData } from '../types';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ModelManagerProps {
  editor: ReturnType<typeof usePixelEditor>;
  onClose: () => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ editor, onClose }) => {
  const { project, setProject } = editor;
  
  const { data: projects, isLoading, refetch } = useListProjects();
  const deleteMutation = useDeleteProject();

  const handleLoad = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      const fullProject = await res.json();
      setProject(fullProject.data as ProjectData);
      toast.success('Project loaded!');
      onClose();
    } catch (e) {
      toast.error('Failed to load project');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Project deleted');
      refetch();
    } catch (e) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0d0d12] z-50 flex flex-col p-8 overflow-y-auto crt-overlay">
      <div className="max-w-6xl w-full mx-auto flex flex-col gap-8 relative z-10">
        
        <div className="flex items-center justify-between border-b border-[#1a1a24] pb-4">
          <h2 className="font-pixel text-primary text-xl uppercase tracking-widest drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]">
            Models Library
          </h2>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-white font-mono text-sm border border-[#1a1a24] px-4 py-2 hover:bg-[#111118] transition-colors"
          >
            RETURN TO EDITOR (ESC)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* New Project Card CTA */}
          <div 
            onClick={onClose}
            className="aspect-square border-2 border-dashed border-[#2a1545] rounded-sm flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-primary/5 hover:border-primary transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-[#111118] flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="text-muted-foreground group-hover:text-primary transition-colors" size={24} />
            </div>
            <span className="font-pixel text-[10px] text-muted-foreground group-hover:text-primary transition-colors">NEW PROJECT</span>
          </div>

          {isLoading ? (
            <div className="col-span-full py-20 text-center font-mono text-muted-foreground animate-pulse">
              LOADING MANUSCRIPTS...
            </div>
          ) : projects?.length === 0 ? (
            <div className="col-span-full py-20 text-center font-mono text-muted-foreground border border-dashed border-[#1a1a24]">
              No saved projects found in the archives.
            </div>
          ) : (
            projects?.map(p => (
              <div 
                key={p.id}
                onClick={() => handleLoad(p.id)}
                className="group flex flex-col bg-[#111118] border border-[#1a1a24] rounded-sm overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]"
              >
                <div className="aspect-square bg-[#08080a] relative p-4 flex items-center justify-center checker-bg">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="max-w-full max-h-full object-contain pixelated" />
                  ) : (
                    <div className="font-pixel text-[8px] text-muted-foreground/30">NO PREVIEW</div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button className="bg-primary text-white font-pixel text-[10px] px-4 py-2 rounded-sm shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                      LOAD
                    </button>
                  </div>
                </div>
                
                <div className="p-3 border-t border-[#1a1a24] flex items-center justify-between bg-[#0d0d12]">
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-mono text-sm text-foreground truncate">{p.name}</span>
                    <span className="font-pixel text-[8px] text-muted-foreground mt-1 tracking-wider">
                      {p.width}×{p.height} • {p.mode.toUpperCase()}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(p.id, e)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

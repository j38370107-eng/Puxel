import React, { useState } from 'react';
import { Plus, Trash2, Search, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { useListProjects, useDeleteProject } from '@workspace/api-client-react';
import { ProjectData } from '../types';
import { usePixelEditor } from '../hooks/usePixelEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ModelManagerProps {
  editor: ReturnType<typeof usePixelEditor>;
  onClose: () => void;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ editor, onClose }) => {
  const { setProject } = editor;
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: projects, isLoading, refetch } = useListProjects();
  const deleteMutation = useDeleteProject();

  const filtered = projects?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLoad = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const full = await res.json();
      setProject(full.data as ProjectData);
      toast.success('Project loaded!');
      onClose();
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('Project deleted');
      refetch();
    } catch {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#05050c] overflow-hidden crt-overlay">
      {/* Header */}
      <div className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-white hover:bg-muted/40 rounded-sm transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-pixel text-[14px] text-primary glow-purple uppercase tracking-widest">
              Models Library
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-muted-foreground hover:text-white hover:bg-muted/40 rounded-sm transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-muted/30 border border-border/50 pl-8 pr-8 py-2 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 rounded-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">

          {/* New project card */}
          <div
            onClick={onClose}
            className="aspect-square border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all group rounded-sm"
          >
            <div className="w-10 h-10 rounded-sm bg-muted/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus size={20} className="text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
            <span className="font-pixel text-[8px] text-muted-foreground/50 group-hover:text-primary transition-colors text-center">
              New Project
            </span>
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted/20 border border-border/30 rounded-sm animate-pulse" />
            ))
          ) : filtered?.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <p className="font-pixel text-[10px] text-muted-foreground/50">
                {search ? `No projects matching "${search}"` : 'No saved projects yet.'}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground/30 mt-2">
                Save a project using Ctrl+S to see it here.
              </p>
            </div>
          ) : (
            filtered?.map(p => (
              <div
                key={p.id}
                onClick={() => handleLoad(p.id)}
                className={cn(
                  'group flex flex-col bg-card border border-border/40 rounded-sm overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.12)]',
                  loading && 'pointer-events-none opacity-50'
                )}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-[#07070f] relative flex items-center justify-center checker-bg">
                  {p.thumbnail ? (
                    <img
                      src={p.thumbnail}
                      alt={p.name}
                      className="max-w-[80%] max-h-[80%] object-contain pixelated"
                    />
                  ) : (
                    <div className="font-pixel text-[7px] text-muted-foreground/20">NO PREVIEW</div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <span className="bg-primary text-white font-pixel text-[8px] px-3 py-1.5 shadow-[0_0_12px_rgba(124,58,237,0.5)]">
                      LOAD
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="px-2 py-2 border-t border-border/30 bg-card/80 flex items-start justify-between gap-1">
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[11px] text-foreground/80 truncate">{p.name}</span>
                    <span className="font-pixel text-[7px] text-muted-foreground/50 mt-0.5">
                      {p.width}×{p.height}
                    </span>
                  </div>
                  <button
                    onClick={e => handleDelete(p.id, e)}
                    className="p-1 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-sm opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-border/30 bg-card/50 px-6 py-3 shrink-0 flex items-center justify-between">
        <span className="font-pixel text-[8px] text-muted-foreground/40">
          {filtered?.length ?? 0} project{filtered?.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          className="font-pixel text-[8px] text-muted-foreground hover:text-white border border-border/40 px-3 py-1.5 hover:bg-muted/40 transition-colors"
        >
          RETURN TO EDITOR
        </button>
      </div>
    </div>
  );
};

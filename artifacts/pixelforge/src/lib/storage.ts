import { ProjectData } from '../types';

const STORAGE_PREFIX = 'pixelforge_project_';
const AUTOSAVE_KEY = 'pixelforge_autosave';

export const storage = {
  getModels: (): Omit<ProjectData, 'frames'>[] => {
    const models = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX) && key !== AUTOSAVE_KEY) {
        try {
          const project = JSON.parse(localStorage.getItem(key) || '{}');
          // Exclude large frames data for model list
          const { frames, ...rest } = project;
          models.push(rest);
        } catch (e) {
          console.error('Failed to parse model', key);
        }
      }
    }
    return models.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  loadModel: (id: string): ProjectData | null => {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load model', id);
      return null;
    }
  },

  saveModel: (project: ProjectData): void => {
    project.updatedAt = Date.now();
    localStorage.setItem(`${STORAGE_PREFIX}${project.id}`, JSON.stringify(project));
  },

  deleteModel: (id: string): void => {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  },

  saveAutoSave: (project: ProjectData): void => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  },

  loadAutoSave: (): ProjectData | null => {
    try {
      const data = localStorage.getItem(AUTOSAVE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
};

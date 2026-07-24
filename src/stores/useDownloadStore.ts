import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface DownloadState {
  downloading: Set<string>;
  progress: Map<string, number>;
  
  startDownload: (modelName: string) => void;
  setDownloading: (modelName: string, isDownloading: boolean) => void;
  setProgress: (modelName: string, percentage: number) => void;
  cancelDownload: (modelName: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloading: new Set(),
  progress: new Map(),

  startDownload: (modelName) => {
    set((state) => {
      const next = new Set(state.downloading);
      next.add(modelName);
      return { downloading: next };
    });
  },

  setDownloading: (modelName, isDownloading) => {
    set((state) => {
      const next = new Set(state.downloading);
      if (isDownloading) {
        next.add(modelName);
      } else {
        next.delete(modelName);
      }
      return { downloading: next };
    });
  },

  setProgress: (modelName, percentage) => {
    set((state) => {
      const next = new Map(state.progress);
      if (percentage === null || percentage === undefined) {
        next.delete(modelName);
      } else {
        next.set(modelName, percentage);
      }
      return { progress: next };
    });
  },

  cancelDownload: async (modelName) => {
    try {
      await invoke('cancel_download', { modelName });
    } catch (e) {
      console.error(e);
    }
    set((state) => {
      const nextDownloading = new Set(state.downloading);
      nextDownloading.delete(modelName);
      const nextProgress = new Map(state.progress);
      nextProgress.delete(modelName);
      return { downloading: nextDownloading, progress: nextProgress };
    });
  },
}));

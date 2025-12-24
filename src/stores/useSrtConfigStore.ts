import { create } from 'zustand';

interface SrtConfig {
  enabled: boolean;
  filenameMode: 'same' | 'custom';
  customFilename: string;
  outputPath: 'default' | 'sameas';
  
  // Actions
  setEnabled: (enabled: boolean) => void;
  setFilenameMode: (mode: 'same' | 'custom') => void;
  setCustomFilename: (name: string) => void;
  setOutputPath: (path: 'default' | 'sameas') => void;
}

export const useSrtConfigStore = create<SrtConfig>((set) => ({
  enabled: false,
  filenameMode: 'same',
  customFilename: 'transcription',
  outputPath: 'default',
  
  setEnabled: (enabled) => set({ enabled }),
  setFilenameMode: (filenameMode) => set({ filenameMode }),
  setCustomFilename: (customFilename) => set({ customFilename }),
  setOutputPath: (outputPath) => set({ outputPath }),
}));

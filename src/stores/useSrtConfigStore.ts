import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SrtConfig {
  enabled: boolean;
  filenameMode: 'same' | 'custom';
  customFilename: string;
  outputPath: 'default' | 'sameas';
  duplicateHandling: 'overwrite' | 'rename';

  // Actions
  setEnabled: (enabled: boolean) => void;
  setFilenameMode: (mode: 'same' | 'custom') => void;
  setCustomFilename: (name: string) => void;
  setOutputPath: (path: 'default' | 'sameas') => void;
  setDuplicateHandling: (handling: 'overwrite' | 'rename') => void;
}

export const useSrtConfigStore = create<SrtConfig>()(
  persist(
    (set) => ({
      enabled: false,
      filenameMode: 'same',
      customFilename: 'transcription',
      outputPath: 'default',
      duplicateHandling: 'rename',

      setEnabled: (enabled) => set({ enabled }),
      setFilenameMode: (filenameMode) => set({ filenameMode }),
      setCustomFilename: (customFilename) => set({ customFilename }),
      setOutputPath: (outputPath) => set({ outputPath }),
      setDuplicateHandling: (duplicateHandling) => set({ duplicateHandling }),
    }),
    {
      name: 'srt-config-storage', // localStorage key
    }
  )
);

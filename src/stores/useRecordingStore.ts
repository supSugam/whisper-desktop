import { create } from 'zustand';

interface SrtProgress {
  percentage: number;
  processedMs: number;
  totalMs: number;
  status: string;
}

interface RecordingState {
  isRecording: boolean;
  isTranscribing: boolean;
  isCancelled: boolean;
  isGeneratingSrt: boolean;
  startTime: number;
  recordTimer: number | null;
  srtProgress: SrtProgress | null;
  
  // Actions
  setRecording: (isRecording: boolean) => void;
  setTranscribing: (isTranscribing: boolean) => void;
  setCancelled: (isCancelled: boolean) => void;
  setStartTime: (time: number) => void;
  setRecordTimer: (timer: number | null) => void;
  setGeneratingSrt: (isGeneratingSrt: boolean) => void;
  setSrtProgress: (progress: SrtProgress | null) => void;
  reset: () => void;
}

const initialState = {
  isRecording: false,
  isTranscribing: false,
  isCancelled: false,
  isGeneratingSrt: false,
  startTime: 0,
  recordTimer: null,
  srtProgress: null,
};

export const useRecordingStore = create<RecordingState>((set) => ({
  ...initialState,
  
  setRecording: (isRecording) => set({ isRecording }),
  setTranscribing: (isTranscribing) => set({ isTranscribing }),
  setCancelled: (isCancelled) => set({ isCancelled }),
  setStartTime: (time) => set({ startTime: time }),
  setRecordTimer: (timer) => set({ recordTimer: timer }),
  setGeneratingSrt: (isGeneratingSrt) => set({ isGeneratingSrt }),
  setSrtProgress: (srtProgress) => set({ srtProgress }),
  reset: () => set(initialState),
}));

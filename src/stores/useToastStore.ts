import { create } from 'zustand';

interface ToastState {
  message: string;
  isVisible: boolean;
  
  // Actions
  show: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  isVisible: false,
  
  show: (message) => {
    set({ message, isVisible: true });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      set({ isVisible: false });
    }, 3000);
  },
  
  hide: () => set({ isVisible: false }),
}));

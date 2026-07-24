import { create } from 'zustand';

interface ToastState {
  message: string;
  isVisible: boolean;
  
  // Actions
  show: (message: string) => void;
  hide: () => void;
}

let timeoutId: NodeJS.Timeout;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  isVisible: false,
  
  show: (message) => {
    set({ message, isVisible: true });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      set({ isVisible: false });
    }, 3000);
  },
  
  hide: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ isVisible: false });
  },
}));

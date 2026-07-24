import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string;
  isVisible: boolean;
  action: ToastAction | null;

  show: (message: string, duration?: number, action?: ToastAction) => void;
  hide: () => void;
  showToast: (message: string, duration?: number, action?: ToastAction) => void;
}

let timeoutId: ReturnType<typeof setTimeout>;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  isVisible: false,
  action: null,

  show: (message, duration = 3000, action = null) => {
    set({ message, isVisible: true, action });

    if (timeoutId) clearTimeout(timeoutId);

    if (duration > 0) {
      timeoutId = setTimeout(() => {
        set({ isVisible: false, action: null });
      }, duration);
    }
  },

  hide: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ isVisible: false, action: null });
  },

  showToast: (message, duration = 3000, action = null) => {
    set({ message, isVisible: true, action });

    if (timeoutId) clearTimeout(timeoutId);

    if (duration > 0) {
      timeoutId = setTimeout(() => {
        set({ isVisible: false, action: null });
      }, duration);
    }
  },
}));

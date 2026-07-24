import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string;
  isVisible: boolean;
  action?: ToastAction;

  show: (message: string, duration?: number, action?: ToastAction) => void;
  hide: () => void;
  showToast: (message: string, duration?: number, action?: ToastAction) => void;
}

let timeoutId: ReturnType<typeof setTimeout>;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  isVisible: false,
  action: undefined,

  show: (message, duration = 3000, action = undefined) => {
    set({ message, isVisible: true, action });

    if (timeoutId) clearTimeout(timeoutId);

    if (duration > 0) {
      timeoutId = setTimeout(() => {
        set({ isVisible: false, action: undefined });
      }, duration);
    }
  },

  hide: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ isVisible: false, action: undefined });
  },

  showToast: (message, duration = 3000, action = undefined) => {
    set({ message, isVisible: true, action });

    if (timeoutId) clearTimeout(timeoutId);

    if (duration > 0) {
      timeoutId = setTimeout(() => {
        set({ isVisible: false, action: undefined });
      }, duration);
    }
  },
}));

import { create } from 'zustand';
import { AppConfig, DEFAULT_CONFIG } from '../types';
import { initStore, getConfig, updateConfig as updateConfigLib } from '../lib/config';

interface ConfigState {
  config: AppConfig;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  updateSetting: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>;
  resetDefaults: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: { ...DEFAULT_CONFIG },
  isInitialized: false,
  
  initialize: async () => {
    await initStore();
    const config = await getConfig();
    set({ config, isInitialized: true });
  },
  
  updateSetting: async (key, value) => {
    await updateConfigLib(key, value);
    const config = await getConfig();
    set({ config });
  },
  
  resetDefaults: async () => {
    // Reset all settings to defaults
    const keys: (keyof AppConfig)[] = [
      'autoCopy', 'autoPaste', 'soundEnabled', 
      'notificationEnabled', 'shortcutEnabled', 'recordMode'
    ];
    
    for (const key of keys) {
      await updateConfigLib(key, DEFAULT_CONFIG[key]);
    }
    
    const config = await getConfig();
    set({ config });
  },
  
  refreshConfig: async () => {
    const config = await getConfig();
    set({ config });
  },
}));

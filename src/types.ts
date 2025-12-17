export interface AppConfig {
  token: string;
  autoCopy: boolean;
  autoPaste: boolean;
  autostart: boolean;
  soundEnabled: boolean;
  shortcutEnabled: boolean;
  recordMode: 'toggle' | 'hold';
}

export const DEFAULT_CONFIG: AppConfig = {
  token: '',
  autoCopy: true,
  autoPaste: true,
  autostart: false,
  soundEnabled: true,
  shortcutEnabled: true,
  recordMode: 'toggle',
};

export interface HistoryItem {
  timestamp: number;
  text: string;
  error?: boolean;
  duration?: number;
}

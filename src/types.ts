export interface AppConfig {
  token: string;
  userAgent: string;
  autoCopy: boolean;
  autoPaste: boolean;
  autostart: boolean;
  soundEnabled: boolean;
  shortcutEnabled: boolean;
  recordMode: 'toggle' | 'hold';
}

export const DEFAULT_CONFIG: AppConfig = {
  token: '',
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
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

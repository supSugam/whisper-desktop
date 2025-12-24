export interface AppConfig {
  token: string;
  userAgent: string;
  autoCopy: boolean;
  autoPaste: boolean;
  autostart: boolean;
  soundEnabled: boolean;
  shortcutEnabled: boolean;
  recordMode: 'toggle' | 'hold';
  notificationEnabled: boolean;
  transcriptionEngine: 'cloud' | 'local';
  localModel: string;
  useLocalGPU?: boolean;
  globalShortcut?: string;
  alwaysOnTop?: boolean;
  localTranslate?: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  token: '',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  transcriptionEngine: 'cloud',
  recordMode: 'hold',
  alwaysOnTop: false,
  autoCopy: true,
  autoPaste: false,
  soundEnabled: true,
  notificationEnabled: true,
  autostart: true,
  shortcutEnabled: true,
  localModel: 'Tiny',
  useLocalGPU: false,
  globalShortcut: 'Ctrl+Alt+Space',
  localTranslate: false,
};

export interface HistoryItem {
  timestamp: number;
  text: string;
  duration: number; // Audio duration in ms
  error?: boolean;
  backend?: string; // 'Cloud', 'CPU', 'GPU', 'SRT'
  processingTime?: number; // Transcription time in ms
  isSrt?: boolean; // True if this is an SRT file entry
  srtPath?: string; // Path to the SRT file
}

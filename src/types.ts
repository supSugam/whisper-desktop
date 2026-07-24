export interface AppConfig {
  autoCopy: boolean;
  autoPaste: boolean;
  autostart: boolean;
  soundEnabled: boolean;
  shortcutEnabled: boolean;
  recordMode: 'toggle' | 'hold';
  notificationEnabled: boolean;
  localModel: string;
  useLocalGPU?: boolean;
  globalShortcut?: string;
  alwaysOnTop?: boolean;
  localTranslate?: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  recordMode: 'toggle',
  alwaysOnTop: false,
  autoCopy: true,
  autoPaste: false,
  soundEnabled: true,
  notificationEnabled: false,
  autostart: true,
  shortcutEnabled: true,
  localModel: 'Base',
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

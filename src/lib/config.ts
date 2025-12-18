import { Store } from "@tauri-apps/plugin-store";
import { isEnabled } from "@tauri-apps/plugin-autostart";
import { AppConfig, DEFAULT_CONFIG } from "../types";

let store: Store | null = null;
let cachedConfig: AppConfig = { ...DEFAULT_CONFIG };

export async function initStore() {
  store = await Store.load('settings.json');
}

export function getStore(): Store | null {
    return store;
}

export async function getConfig(): Promise<AppConfig> {
  if (!store) return cachedConfig;

  const token = await store.get<string>('token');
  const userAgent = await store.get<string>('userAgent');
  const autoCopy = await store.get<boolean>('autoCopy');
  const autoPaste = await store.get<boolean>('autoPaste');
  const soundEnabled = await store.get<boolean>('soundEnabled');
  const shortcutEnabled = await store.get<boolean>('shortcutEnabled');
  const recordMode = await store.get<'toggle' | 'hold'>('recordMode');

  // Check Autostart status dynamically
  let autostart = false;
  try {
    autostart = await isEnabled();
  } catch (e) {
    console.warn('Autostart check failed', e);
  }

  cachedConfig = {
    token: token ?? DEFAULT_CONFIG.token,
    userAgent: userAgent ?? DEFAULT_CONFIG.userAgent,
    autoCopy: autoCopy ?? DEFAULT_CONFIG.autoCopy,
    autoPaste: autoPaste ?? DEFAULT_CONFIG.autoPaste,
    autostart, // Dynamic
    soundEnabled: soundEnabled ?? DEFAULT_CONFIG.soundEnabled,
    shortcutEnabled: shortcutEnabled ?? DEFAULT_CONFIG.shortcutEnabled,
    recordMode: recordMode ?? DEFAULT_CONFIG.recordMode,
  };

  return cachedConfig;
}

export async function updateConfig(key: keyof AppConfig, value: any) {
    if (!store) return;
    if (key === 'autostart') return; // Handled separately via plugin
    await store.set(key, value);
    await store.save();
    // Cache update is handled on next getConfig call or we could optimize
}

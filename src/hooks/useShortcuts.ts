import { useEffect } from 'react';
import { shortcutManager } from '../lib/shortcuts';
import { useConfigStore } from '../stores/useConfigStore';
import {
  toggleRecord,
  startRecord,
  stopRecord,
} from '../lib/recordingController';

export const useShortcuts = () => {
  const { config } = useConfigStore();

  useEffect(() => {
    console.log('[Shortcuts] Config changed:', {
      enabled: config.shortcutEnabled,
      mode: config.recordMode,
      shortcut: config.globalShortcut,
    });

    if (!config.shortcutEnabled) {
      console.log('[Shortcuts] Disabled');
      shortcutManager.disable();
      return;
    }

    // Use stable module-level functions
    const handler = {
      onToggle: toggleRecord,
      onPress: startRecord,
      onRelease: stopRecord,
    };

    console.log('[Shortcuts] Enabling with stable handlers');
    shortcutManager.enable(config.recordMode, handler, config.globalShortcut);
  }, [config.shortcutEnabled, config.recordMode, config.globalShortcut]);
};

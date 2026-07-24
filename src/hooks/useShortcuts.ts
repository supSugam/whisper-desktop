import { useEffect } from 'react';
import { shortcutManager } from '../lib/shortcuts';
import { useConfigStore } from '../stores/useConfigStore';
import {
  toggleRecord,
  startRecord,
  stopRecord,
} from '../lib/recordingController';

import { invoke } from '@tauri-apps/api/core';

export const useShortcuts = () => {
  const { config } = useConfigStore();

  useEffect(() => {
    // 1. Setup global shortcut using Tauri plugin (may fail on Wayland)
    const setupGlobal = async () => {
      if (!config.shortcutEnabled) {
        shortcutManager.disable();
        return;
      }
      const handler = { onToggle: toggleRecord, onPress: startRecord, onRelease: stopRecord };
      shortcutManager.enable(config.recordMode, handler, config.globalShortcut);
    };
    setupGlobal();

    // 2. Setup local fallback for Wayland (works when app is focused)
    let isWayland = false;
    invoke<string>('get_session_type').then(type => {
      isWayland = type === 'wayland';
    }).catch(() => {});

    let isHolding = false;

    const matchShortcut = (e: KeyboardEvent, shortcut: string) => {
      if (!shortcut) return false;
      const parts = shortcut.split('+');
      const needsCtrl = parts.includes('Ctrl');
      const needsAlt = parts.includes('Alt');
      const needsShift = parts.includes('Shift');
      const needsSuper = parts.includes('Super');
      
      if (e.ctrlKey !== needsCtrl || e.altKey !== needsAlt || 
          e.shiftKey !== needsShift || e.metaKey !== needsSuper) return false;
      
      const keyPart = parts[parts.length - 1];
      if (!keyPart) return false;
      
      let key = e.key.toUpperCase();
      if (key === ' ') key = 'SPACE';
      return key === keyPart;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isWayland || !config.shortcutEnabled) return;
      if (matchShortcut(e, config.globalShortcut || '')) {
        e.preventDefault();
        if (config.recordMode === 'toggle') {
          if (!e.repeat) toggleRecord();
        } else {
          if (!isHolding) {
            isHolding = true;
            startRecord();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isWayland || !config.shortcutEnabled) return;
      if (config.recordMode === 'hold' && isHolding) {
        if (matchShortcut(e, config.globalShortcut || '')) {
          e.preventDefault();
          isHolding = false;
          stopRecord();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [config.shortcutEnabled, config.recordMode, config.globalShortcut]);
};

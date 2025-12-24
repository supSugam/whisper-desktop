import { useEffect, useRef } from 'react';
import { shortcutManager } from '../lib/shortcuts';
import { useConfigStore } from '../stores/useConfigStore';

interface ShortcutHandler {
  onToggle: () => void;
  onPress: () => void;
  onRelease: () => void;
}

export const useShortcuts = (handler: ShortcutHandler) => {
  const { config } = useConfigStore();
  const handlerRef = useRef(handler);
  
  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  useEffect(() => {
    if (!config.shortcutEnabled) {
      shortcutManager.disable();
      return;
    }
    
    shortcutManager.enable(
      config.recordMode,
      handlerRef.current,
      config.globalShortcut
    );
    
    return () => {
      shortcutManager.disable();
    };
  }, [config.shortcutEnabled, config.recordMode, config.globalShortcut]);
};

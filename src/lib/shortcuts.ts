import {
  register,
  unregister,
  isRegistered,
} from '@tauri-apps/plugin-global-shortcut';

// Default if not provided
const DEFAULT_SHORTCUT = 'Ctrl+Alt+Space';

export interface ShortcutHandler {
  onToggle: () => void;
  onPress: () => void;
  onRelease: () => void;
}

// Store handler globally so it can be updated without re-registration
let globalHandler: ShortcutHandler | null = null;
let globalMode: 'toggle' | 'hold' = 'toggle';
let currentShortcut: string | null = null;
let isRegistering = false;

export class ShortcutManager {
  async enable(
    mode: 'toggle' | 'hold',
    handler: ShortcutHandler,
    shortcut: string = DEFAULT_SHORTCUT
  ) {
    // Prevent concurrent registration attempts
    if (isRegistering) {
      console.log('[ShortcutManager] Already registering, skipping');
      return;
    }

    const statusEl = document.getElementById('shortcut-status');

    // Always update global handler (this is what will be called)
    globalHandler = handler;
    globalMode = mode;

    // If same shortcut already registered
    if (currentShortcut === shortcut) {
      // Verify it's actually registered
      try {
        const registered = await isRegistered(shortcut);
        if (registered) {
          console.log(
            '[ShortcutManager] Shortcut already registered and active:',
            shortcut
          );
          if (statusEl) {
            statusEl.textContent = `Active: ${shortcut} (${mode})`;
            statusEl.style.color = '#4caf50';
          }
          return;
        } else {
          console.log(
            '[ShortcutManager] Shortcut was registered but not active, re-registering'
          );
          currentShortcut = null;
        }
      } catch (e) {
        console.log(
          '[ShortcutManager] Could not check registration status, assuming registered'
        );
        return;
      }
    }

    if (!shortcut || shortcut.trim() === '') {
      console.log('[ShortcutManager] No shortcut set');
      if (statusEl) statusEl.textContent = 'No shortcut set';
      return;
    }

    isRegistering = true;

    try {
      // Unregister any existing shortcut first
      if (currentShortcut && currentShortcut !== shortcut) {
        console.log(
          '[ShortcutManager] Unregistering old shortcut:',
          currentShortcut
        );
        try {
          await unregister(currentShortcut);
        } catch (e) {
          // Ignore unregister errors
        }
        currentShortcut = null;
      }

      console.log(
        '[ShortcutManager] Registering shortcut:',
        shortcut,
        'mode:',
        mode
      );

      await register(shortcut, (event) => {
        // Call the CURRENT global handler
        if (!globalHandler) {
          console.warn('[ShortcutManager] No handler set!');
          return;
        }

        console.log(
          '[ShortcutManager] Event:',
          event.state,
          'Mode:',
          globalMode
        );
        if (globalMode === 'toggle') {
          if (event.state === 'Pressed') {
            console.log('[ShortcutManager] Calling onToggle');
            globalHandler.onToggle();
          }
        } else {
          if (event.state === 'Pressed') {
            console.log('[ShortcutManager] Calling onPress');
            globalHandler.onPress();
          } else if (event.state === 'Released') {
            console.log('[ShortcutManager] Calling onRelease');
            globalHandler.onRelease();
          }
        }
      });

      currentShortcut = shortcut;
      console.log('[ShortcutManager] Registration successful!');

      if (statusEl) {
        statusEl.textContent = `Active: ${shortcut} (${mode})`;
        statusEl.style.color = '#4caf50';
      }
    } catch (e) {
      console.error('[ShortcutManager] Error:', e);
      const err = String(e);
      if (err.includes('already registered')) {
        // The shortcut is already registered - that's fine, just mark it
        currentShortcut = shortcut;
        console.log(
          '[ShortcutManager] Shortcut already registered (caught), using it'
        );
        if (statusEl) {
          statusEl.textContent = `Active: ${shortcut} (${mode})`;
          statusEl.style.color = '#4caf50';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = 'Error: ' + e;
          statusEl.style.color = '#ff4444';
        }
      }
    } finally {
      isRegistering = false;
    }
  }

  async disable() {
    if (isRegistering) return;

    const statusEl = document.getElementById('shortcut-status');
    // DON'T set globalHandler to null - we want to keep the handler
    // in case the shortcut is re-enabled

    try {
      if (currentShortcut) {
        console.log('[ShortcutManager] Disabling:', currentShortcut);
        await unregister(currentShortcut);
        currentShortcut = null;
      }
      if (statusEl) {
        statusEl.textContent = 'Disabled';
        statusEl.style.color = '#888';
      }
    } catch (e) {
      console.error('[ShortcutManager] Disable error:', e);
    }
  }
}

export const shortcutManager = new ShortcutManager();

import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";

// Default if not provided
const DEFAULT_SHORTCUT = 'Ctrl+Alt+Space';

export interface ShortcutHandler {
  onToggle: () => void;
  onPress: () => void;
  onRelease: () => void;
}

export class ShortcutManager {
  private isUpdating = false;

  async enable(
    mode: 'toggle' | 'hold',
    handler: ShortcutHandler,
    shortcut: string = DEFAULT_SHORTCUT
  ) {
    if (this.isUpdating) return;
    this.isUpdating = true;
    const statusEl = document.getElementById('shortcut-status');

    try {
      await unregisterAll();
      if (!shortcut || shortcut.trim() === '') {
        if (statusEl) statusEl.textContent = 'No shortcut set';
        return;
      }

      await register(shortcut, (event) => {
        if (mode === 'toggle') {
          if (event.state === 'Pressed') handler.onToggle();
        } else {
          if (event.state === 'Pressed') handler.onPress();
          else if (event.state === 'Released') handler.onRelease();
        }
      });

      if (statusEl) {
        statusEl.textContent = `Active: ${shortcut} (${mode})`;
        statusEl.style.color = '#4caf50';
      }
    } catch (e) {
      console.error('Shortcut Error', e);
      if (statusEl) {
        const err = String(e);
        if (err.includes('already registered')) {
          statusEl.textContent = `Active: ${shortcut} (${mode})`;
          statusEl.style.color = '#4caf50';
        } else {
          statusEl.textContent = 'Error: ' + e;
          statusEl.style.color = '#ff4444';
          // Show toast for user visibility in release build
          import('../ui/toast').then((m) =>
            m.showToast('Shortcut Error: ' + e)
          );
        }
      }
    } finally {
      this.isUpdating = false;
    }
  }

  async disable() {
    if (this.isUpdating) return;
    this.isUpdating = true;
    const statusEl = document.getElementById('shortcut-status');
    try {
      await unregisterAll();
      if (statusEl) {
        statusEl.textContent = 'Disabled';
        statusEl.style.color = '#888';
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isUpdating = false;
    }
  }
}

export const shortcutManager = new ShortcutManager();

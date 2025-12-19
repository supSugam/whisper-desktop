import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ICONS } from './ui/icons';
import { renderLayout } from './ui/layout';
import { initStore, getConfig, updateConfig } from './lib/config';
import { historyUI } from './ui/history';
import { historyManager } from './lib/history';
import { audioController } from './lib/audio';
import { shortcutManager } from './lib/shortcuts';
import { showToast } from './ui/toast';
import { formatDuration } from './lib/utils';
import { renderTitleBar } from './ui/titlebar';
import './styles/titlebar.css';

// State
let isRecording = false;
let isTranscribing = false;
let isCancelled = false;
let startTime = 0;
let recordTimer: any = null;

// --- Recorder Logic ---
function updateRecUI() {
  const btn = document.getElementById('record-btn');
  const status = document.getElementById('rec-status');
  const controls = document.getElementById('recording-controls');

  if (!btn || !status || !controls) return;

  // Always clean up processing class first
  btn.classList.remove('processing');

  if (isTranscribing) {
    btn.classList.remove('recording');
    btn.classList.add('processing');
    btn.innerHTML = ICONS.mic; // Keep icon
    status.classList.remove('visible');
    return;
  }

  status.style.color = ''; // Reset color

  if (isRecording) {
    btn.classList.add('recording');
    btn.innerHTML = ICONS.stop;
    controls.style.display = 'flex';
    status.classList.add('visible');
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = ICONS.mic;
    controls.style.display = 'none';
    status.classList.remove('visible');
    status.innerText = 'Ready';
  }
}

function updateTimer() {
  const status = document.getElementById('rec-status');
  if (status && isRecording && !isTranscribing) {
    status.innerText = formatDuration(Date.now() - startTime);
  }
}

async function startRecord() {
  if (isRecording) return;

  if (isTranscribing) {
    const btn = document.getElementById('record-btn');
    btn?.classList.add('shake');
    setTimeout(() => btn?.classList.remove('shake'), 500);
    showToast('Wait for previous task to finish');
    return;
  }

  const config = await getConfig();
  if (!config.token) {
    alert('Please set your ChatGPT token in settings first.');
    return;
  }

  try {
    await invoke('start_recording');
    isRecording = true;
    startTime = Date.now();
    if (config.soundEnabled) audioController.playStart();

    updateRecUI();
    clearInterval(recordTimer);
    recordTimer = setInterval(updateTimer, 500);
    updateTimer();
  } catch (e) {
    console.error('Start Error', e);
    showToast('Error starting recording');
  }
}

async function stopRecord() {
  if (!isRecording) return;

  isRecording = false;
  isCancelled = false; // Reset cancellation flag
  const config = await getConfig();
  if (config.soundEnabled) audioController.playEnd();
  clearInterval(recordTimer);

  // Set transcribing state immediately
  isTranscribing = true;
  updateRecUI();

  const duration = Date.now() - startTime;

  try {
    const path = await invoke<string>('stop_recording');

    if (duration < 500) {
      showToast('Too short, discarded');
      isTranscribing = false;
      updateRecUI();
      return;
    }

    const id = Date.now();

    try {
      const text = await invoke<string>('transcribe', {
        path,
        token: config.token,
        userAgent: config.userAgent,
      });

      // Check if cancelled while waiting for transcription
      if (isCancelled) {
        isCancelled = false;
        return; // User cancelled, don't process result
      }

      if (!text || text.trim().length === 0) {
        await historyManager.add({
          timestamp: id,
          text: '',
          duration,
          error: false,
        }); // Empty
      } else {
        await historyManager.add({ timestamp: id, text, duration });

        // Auto Copy
        if (config.autoCopy) {
          await writeText(text);

          // Auto-paste if enabled
          if (config.autoPaste) {
            const settingsOpen = document
              .getElementById('settings-overlay')
              ?.classList.contains('open');
            if (settingsOpen) {
              showToast('Auto-paste skipped (Settings Open)');
            } else {
              setTimeout(() => invoke('paste_text'), 100);
              showToast('Pasted');
            }
          }

          // Send notification if enabled (independent of auto-paste)
          if (config.notificationEnabled) {
            try {
              await invoke('send_notification', {
                title: 'Whisper+',
                body: config.autoPaste
                  ? 'Transcription pasted!'
                  : 'Transcription copied to clipboard. Press Ctrl+V to paste.',
              });
            } catch (notifErr) {
              console.error('Notification error:', notifErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Transcribe Error', err);
      await historyManager.add({
        timestamp: id,
        text: String(err),
        duration,
        error: true,
      });
    }
  } catch (e: any) {
    if (String(e).includes('SILENCE_DETECTED')) {
      showToast('Skipped: Silence Detected');
    } else {
      console.error('Stop/Transcribe Error', e);
      showToast('Error processing audio');
    }
  } finally {
    isTranscribing = false;
    updateRecUI();
  }
}

async function cancelRecord() {
  const config = await getConfig();

  // If transcribing, set cancelled flag (will be handled by stopRecord)
  if (isTranscribing) {
    isCancelled = true;
    isTranscribing = false;
    showToast('Cancelled');
    updateRecUI();
    return;
  }

  // If recording, stop and play end sound
  if (isRecording && config.soundEnabled) audioController.playEnd();
  isRecording = false;
  clearInterval(recordTimer);
  updateRecUI();
  invoke('stop_recording').catch(console.error); // Just clean up backend
}

async function toggleRecord() {
  if (isRecording) await stopRecord();
  else await startRecord();
}

// --- Setup & Init ---

async function init() {
  try {
    const app = document.getElementById('app');
    if (app) renderLayout(app);

    renderTitleBar();

    await initStore();
    const config = await getConfig();

    // Init UI Modules
    historyUI.init();
    historyManager.subscribe(() => historyUI.render());

    // Listeners for Main UI
    document
      .getElementById('record-btn')
      ?.addEventListener('click', toggleRecord);
    document.getElementById('cancel-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelRecord();
    });
    document
      .getElementById('init-clear-btn')
      ?.addEventListener('click', async () => {
        await historyManager.clear();
        showToast('History Cleared');
      });

    // Listeners for Settings UI (Bind Inputs)
    setupSettings(config);

    // Shortcuts (X11/rdev based - works when XWayland apps focused)
    if (config.shortcutEnabled) {
      await shortcutManager.enable(config.recordMode, {
        onToggle: toggleRecord,
        onPress: startRecord,
        onRelease: stopRecord,
      });
    }

    // Listen for CLI toggle events (GNOME custom keybinding -> whisper-plus --toggle)
    // This enables toggle mode on Wayland when native apps are focused
    listen('cli-toggle', () => {
      console.log('CLI toggle triggered');
      toggleRecord();
    });

    // Periodic History Check (e.g. for relative time updates)
    setInterval(() => historyUI.render(), 60000);

    // Show window after content is ready (prevents white flash)
    await getCurrentWindow().show();
  } catch (e) {
    console.error('App Init Error', e);
  }
}

async function setupSettings(initialConfig: any) {
  // Bind all inputs in settings modal
  const overlay = document.getElementById('settings-overlay');

  // Check session type once (for disabling Wayland-incompatible features)
  const sessionType = await invoke<string>('get_session_type');
  const isWayland = sessionType === 'wayland';

  // Open/Close
  document
    .getElementById('settings-btn')
    ?.addEventListener('click', () => overlay?.classList.add('open'));
  document
    .getElementById('close-settings')
    ?.addEventListener('click', () => overlay?.classList.remove('open'));
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  // Inputs
  const bindToggle = (id: string, key: any) => {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) {
      el.checked = initialConfig[key];
      el.addEventListener('change', async (e: any) => {
        await updateConfig(key, e.target.checked);
      });
    }
  };

  bindToggle('autocopy-input', 'autoCopy');
  bindToggle('autopaste-input', 'autoPaste');
  bindToggle('sound-input', 'soundEnabled');
  bindToggle('notification-input', 'notificationEnabled');

  // On Wayland, show info message when auto-paste is enabled (it only works with XWayland apps)
  if (isWayland) {
    const autoPasteInput = document.getElementById(
      'autopaste-input'
    ) as HTMLInputElement;
    const infoBox = document.getElementById('autopaste-wayland-info');

    // Show/hide info based on current state
    const updateInfoVisibility = () => {
      if (infoBox) {
        infoBox.style.display = autoPasteInput?.checked ? 'block' : 'none';
      }
    };

    // Initial state
    updateInfoVisibility();

    // Listen for changes
    autoPasteInput?.addEventListener('change', updateInfoVisibility);
  }

  // Autostart special
  const asInput = document.getElementById(
    'autostart-input'
  ) as HTMLInputElement;
  if (asInput) {
    asInput.checked = initialConfig.autostart;
    asInput.addEventListener('change', async (e: any) => {
      try {
        if (e.target.checked) await enable();
        else await disable();
      } catch (err) {
        e.target.checked = !e.target.checked;
      }
    });
  }

  // Token
  const tkInput = document.getElementById('token-input') as HTMLInputElement;
  if (tkInput) {
    tkInput.value = initialConfig.token;
    tkInput.addEventListener('input', async (e: any) => {
      await updateConfig('token', e.target.value);
    });
  }

  // User Agent
  const uaInput = document.getElementById('ua-input') as HTMLInputElement;
  if (uaInput) {
    uaInput.value = initialConfig.userAgent;
    uaInput.addEventListener('input', async (e: any) => {
      await updateConfig('userAgent', e.target.value);
    });
  }

  // Shortcut
  const scInput = document.getElementById(
    'shortcut-enable-input'
  ) as HTMLInputElement;
  if (scInput) {
    scInput.checked = initialConfig.shortcutEnabled;
    scInput.addEventListener('change', async (e: any) => {
      const enabled = e.target.checked;
      await updateConfig('shortcutEnabled', enabled);
      const cfg = await getConfig();
      if (enabled) {
        await shortcutManager.enable(cfg.recordMode, {
          onToggle: toggleRecord,
          onPress: startRecord,
          onRelease: stopRecord,
        });
      } else {
        await shortcutManager.disable();
      }
    });
  }

  // Mode
  const modeBtns = document.querySelectorAll('.segment-btn');
  const holdBtn = document.querySelector(
    '.segment-btn[data-mode="hold"]'
  ) as HTMLElement;

  // Disable hold button on Wayland
  if (isWayland && holdBtn) {
    holdBtn.classList.add('disabled');
    holdBtn.title =
      'Hold mode is not available on Wayland due to compositor limitations';

    // If user had hold mode selected, switch to toggle
    if (initialConfig.recordMode === 'hold') {
      await updateConfig('recordMode', 'toggle');
    }
  }

  const updateModeUI = (mode: string) => {
    modeBtns.forEach((b) => {
      if ((b as HTMLElement).dataset.mode === mode) b.classList.add('active');
      else b.classList.remove('active');
    });
    const desc = document.getElementById('mode-desc');
    if (desc) {
      desc.innerHTML =
        mode === 'toggle'
          ? 'Press to Start, Press again to Stop.'
          : 'Hold to Record, Release to Stop.';
    }
  };
  // Use toggle on Wayland if hold was selected
  const effectiveMode =
    isWayland && initialConfig.recordMode === 'hold'
      ? 'toggle'
      : initialConfig.recordMode;
  updateModeUI(effectiveMode);

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', async (e: any) => {
      const mode = e.target.dataset.mode;

      // Block hold mode on Wayland
      if (mode === 'hold' && isWayland) {
        showToast(
          'Hold mode is not available on Wayland. Global shortcuts on Wayland can only detect key press, not release.'
        );
        return;
      }

      await updateConfig('recordMode', mode);
      updateModeUI(mode);

      const cfg = await getConfig();
      if (cfg.shortcutEnabled) {
        await shortcutManager.enable(mode, {
          onToggle: toggleRecord,
          onPress: startRecord,
          onRelease: stopRecord,
        });
      }
    });
  });

  // Reset Defaults
  document
    .getElementById('reset-defaults-btn')
    ?.addEventListener('click', async () => {
      if (confirm('Reset all settings to defaults?')) {
        const { DEFAULT_CONFIG } = await import('./types');

        // Update Store
        await updateConfig('autoCopy', DEFAULT_CONFIG.autoCopy);
        await updateConfig('autoPaste', DEFAULT_CONFIG.autoPaste);
        await updateConfig('soundEnabled', DEFAULT_CONFIG.soundEnabled);
        await updateConfig(
          'notificationEnabled',
          DEFAULT_CONFIG.notificationEnabled
        );
        await updateConfig('shortcutEnabled', DEFAULT_CONFIG.shortcutEnabled);
        await updateConfig('recordMode', DEFAULT_CONFIG.recordMode);
        // Autostart default is false, so disable it
        try {
          await disable();
        } catch (e) {}

        // Update UI
        (
          document.getElementById('autocopy-input') as HTMLInputElement
        ).checked = DEFAULT_CONFIG.autoCopy;
        (
          document.getElementById('autopaste-input') as HTMLInputElement
        ).checked = DEFAULT_CONFIG.autoPaste;
        (document.getElementById('sound-input') as HTMLInputElement).checked =
          DEFAULT_CONFIG.soundEnabled;
        (
          document.getElementById('notification-input') as HTMLInputElement
        ).checked = DEFAULT_CONFIG.notificationEnabled;
        (
          document.getElementById('shortcut-enable-input') as HTMLInputElement
        ).checked = DEFAULT_CONFIG.shortcutEnabled;
        (
          document.getElementById('autostart-input') as HTMLInputElement
        ).checked = false;

        updateModeUI(DEFAULT_CONFIG.recordMode);

        // Re-apply logic
        if (DEFAULT_CONFIG.shortcutEnabled) {
          await shortcutManager.enable(DEFAULT_CONFIG.recordMode, {
            onToggle: toggleRecord,
            onPress: startRecord,
            onRelease: stopRecord,
          });
        }

        showToast('Settings Reset');
      }
    });
}

// Go
window.addEventListener('DOMContentLoaded', init);

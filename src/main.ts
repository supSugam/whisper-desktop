import { invoke } from '@tauri-apps/api/core';
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

// State
let isRecording = false;
let startTime = 0;
let recordTimer: any = null;

// --- Recorder Logic ---
function updateRecUI() {
  const btn = document.getElementById('record-btn');
  const status = document.getElementById('rec-status');
  const controls = document.getElementById('recording-controls');

  if (!btn || !status || !controls) return;

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
  if (status && isRecording) {
    status.innerText = formatDuration(Date.now() - startTime);
  }
}

async function startRecord() {
  if (isRecording) return;
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
  const config = await getConfig();
  if (config.soundEnabled) audioController.playEnd();
  clearInterval(recordTimer);
  updateRecUI();

  const duration = Date.now() - startTime;
  // config already loaded above
  // const config = await getConfig(); // remove redundant load

  try {
    const path = await invoke<string>('stop_recording');

    if (duration < 500) {
      // invoke('cancel_record'); // No, stop handles it, but we discard
      showToast('Too short, discarded');
      return;
    }

    const id = Date.now();

    try {
      const text = await invoke<string>('transcribe', {
        path,
        token: config.token,
      });

      if (!text || text.trim().length === 0) {
        await historyManager.add({
          timestamp: id,
          text: '',
          duration,
          error: false,
        }); // Empty
      } else {
        await historyManager.add({ timestamp: id, text, duration });

        // Auto Copy/Paste
        if (config.autoCopy) {
          await writeText(text);
          if (config.autoPaste) {
            setTimeout(() => invoke('paste_text'), 100);
            showToast('Pasted');
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
    // historyUI.render(); // Handled by subscription
  } catch (e: any) {
    if (String(e).includes('SILENCE_DETECTED')) {
      showToast('Skipped: Silence Detected');
    } else {
      console.error('Stop/Transcribe Error', e);
      showToast('Error processing audio');
    }
  }
}

async function cancelRecord() {
  const config = await getConfig();
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

    // Shortcuts
    if (config.shortcutEnabled) {
      await shortcutManager.enable(config.recordMode, {
        onToggle: toggleRecord,
        onPress: startRecord,
        onRelease: stopRecord,
      });
    }

    // Periodic History Check (e.g. for relative time updates)
    setInterval(() => historyUI.render(), 60000);
  } catch (e) {
    console.error('App Init Error', e);
  }
}

function setupSettings(initialConfig: any) {
  // Bind all inputs in settings modal
  const overlay = document.getElementById('settings-overlay');

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
  updateModeUI(initialConfig.recordMode);

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', async (e: any) => {
      const mode = e.target.dataset.mode;
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

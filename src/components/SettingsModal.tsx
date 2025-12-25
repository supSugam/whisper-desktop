import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { useConfigStore } from '../stores/useConfigStore';
import { useToastStore } from '../stores/useToastStore';
import { ToggleSwitch } from './shared/ToggleSwitch';
import { SegmentedControl } from './shared/SegmentedControl';
import { ShortcutRecorder } from './ShortcutRecorder';
import { ModelManager } from './ModelManager';
import { ICONS } from '../ui/icons';
import { DEFAULT_CONFIG } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, updateSetting } = useConfigStore();
  const showToast = useToastStore(state => state.show);
  const [sessionType, setSessionType] = useState<string>('x11');
  
  useEffect(() => {
    invoke<string>('get_session_type').then(setSessionType);
  }, []);
  
  const isWayland = sessionType === 'wayland';
  
  const handleResetDefaults = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    
    const keys: (keyof typeof DEFAULT_CONFIG)[] = [
      'autoCopy', 'autoPaste', 'soundEnabled',
      'notificationEnabled', 'shortcutEnabled', 'recordMode'
    ];
    
    for (const key of keys) {
      await updateSetting(key, DEFAULT_CONFIG[key]);
    }
    
    try {
      await disable();
    } catch (e) {}
    
    showToast('Settings Reset');
  };
  
  const handleAutostartToggle = async (checked: boolean) => {
    try {
      if (checked) await enable();
      else await disable();
    } catch (err) {
      console.error('Autostart toggle error', err);
    }
  };
  
  const handleEngineChange = async (engine: string) => {
    await updateSetting('transcriptionEngine', engine as 'cloud' | 'local');
  };
  
  if (!isOpen) return null;
  
  return (
    <div
      className="overlay settings-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button
            className="close-btn"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none' }}
            dangerouslySetInnerHTML={{ __html: ICONS.close }}
          />
        </div>

        <div className="modal-body">
          {/* Shortcut Section */}
          {!isWayland && (
            <>
              <div className="section-title">Shortcut</div>
              <div className="form-row">
                <label className="form-label">Enable Global Shortcut</label>
                <ToggleSwitch
                  checked={config.shortcutEnabled}
                  onChange={(checked) =>
                    updateSetting('shortcutEnabled', checked)
                  }
                />
              </div>

              <ShortcutRecorder />

              <div
                className="form-row"
                style={{
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    alignItems: 'center',
                  }}
                >
                  <label className="form-label">Activation Mode</label>

                  <SegmentedControl
                    options={[
                      { value: 'toggle', label: 'Toggle' },
                      { value: 'hold', label: 'Hold' },
                    ]}
                    value={config.recordMode}
                    onChange={(value) =>
                      updateSetting('recordMode', value as 'toggle' | 'hold')
                    }
                    dataKey="mode"
                  />
                </div>
                <div className="mode-desc" id="mode-desc">
                  {config.recordMode === 'toggle'
                    ? 'Press to Start, Press again to Stop.'
                    : 'Hold to Record, Release to Stop.'}
                </div>
              </div>
            </>
          )}

          {isWayland && (
            <>
              <div className="section-title">Shortcut</div>
              <div className="form-info-box">
                <strong>Wayland Detected</strong>
                <br />
                Global hotkeys are restricted by the compositor. <br />
                To set a shortcut:
                <br />
                1. Open{' '}
                <strong>System Settings &gt; Keyboard &gt; Shortcuts</strong>
                <br />
                2. Create a custom shortcut
                <br />
                3. Command: <code>whisper-plus --toggle</code>
              </div>
            </>
          )}

          {/* Preferences */}
          <div className="section-title">Preferences</div>
          <div className="form-row">
            <label className="form-label">Auto-copy to Clipboard</label>
            <ToggleSwitch
              checked={config.autoCopy}
              onChange={(checked) => updateSetting('autoCopy', checked)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Auto-paste to Input</label>
            <ToggleSwitch
              checked={config.autoPaste}
              onChange={(checked) => updateSetting('autoPaste', checked)}
            />
          </div>
          {isWayland && config.autoPaste && (
            <div className="form-info-box">
              ⚠️ On Wayland, auto-paste only works with apps running in XWayland
              mode (most Electron/browser apps). Native Wayland apps won't
              receive the paste.
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Sound Effects</label>
            <ToggleSwitch
              checked={config.soundEnabled}
              onChange={(checked) => updateSetting('soundEnabled', checked)}
            />
          </div>
          <div className="form-row">
            <label className="form-label">Desktop Notifications</label>
            <ToggleSwitch
              checked={config.notificationEnabled}
              onChange={(checked) =>
                updateSetting('notificationEnabled', checked)
              }
            />
          </div>
          <div className="form-row">
            <label className="form-label">Open at Login</label>
            <ToggleSwitch
              checked={config.autostart}
              onChange={handleAutostartToggle}
            />
          </div>

          {/* Data */}
          <div className="section-title">Data</div>
          <div className="form-row">
            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
              History management is now on the main screen.
            </div>
          </div>

          {/* Transcription Engine */}
          <div className="section-title">Transcription Engine</div>
          <div
            className="form-row"
            style={{
              alignItems: 'flex-start',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center',
              }}
            >
              <label className="form-label">Provider</label>

              <SegmentedControl
                options={[
                  { value: 'cloud', label: 'Cloud (ChatGPT)' },
                  { value: 'local', label: 'Local (Whisper)' },
                ]}
                value={config.transcriptionEngine}
                onChange={handleEngineChange}
                dataKey="engine"
              />
            </div>
            <div className="form-text" id="engine-desc">
              {config.transcriptionEngine === 'local'
                ? 'Privacy focused. Runs entirely on your machine. No account needed.'
                : "High accuracy. Uses ChatGPT's reversed API. Requires session token."}
            </div>
          </div>

          {/* Local Model Section */}
          {config.transcriptionEngine === 'local' && (
            <div
              id="local-model-section"
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div className="form-label">Local Models (CPU Optimized)</div>
              <ModelManager />
            </div>
          )}

          {/* Authentication (Cloud) */}
          <div
            className="section-title section-auth"
            style={{
              opacity: config.transcriptionEngine === 'local' ? 0.5 : 1,
            }}
          >
            Authentication
          </div>
          <div
            className="form-group"
            style={{
              opacity: config.transcriptionEngine === 'local' ? 0.5 : 1,
              pointerEvents:
                config.transcriptionEngine === 'local' ? 'none' : 'auto',
            }}
          >
            <label className="form-label">ChatGPT Session Token</label>
            <input
              className="form-input"
              type="password"
              placeholder="Paste token here"
              value={config.token}
              onChange={(e) => updateSetting('token', e.target.value)}
            />
            <div className="form-text warning-text">
              ⚠️ <strong>DANGER</strong>: Only do this if you know what you are
              doing. Never share this token.
            </div>
          </div>

          <div
            className="form-group"
            style={{
              opacity: config.transcriptionEngine === 'local' ? 0.5 : 1,
              pointerEvents:
                config.transcriptionEngine === 'local' ? 'none' : 'auto',
            }}
          >
            <label className="form-label">User Agent (Browser Signature)</label>
            <input
              className="form-input"
              type="text"
              placeholder="Mozilla/5.0..."
              value={config.userAgent}
              onChange={(e) => updateSetting('userAgent', e.target.value)}
            />
            <div
              className="form-text"
              style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '4px' }}
            >
              Optional: Match this with your browser to avoid session conflicts.
            </div>
          </div>

          {/* Token Retrieval Guide */}
          <div className="guide-box">
            <div className="guide-header">How to retrieve your token</div>

            <div className="guide-method">
              <div
                style={{ fontWeight: 600, color: '#fff', marginBottom: '6px' }}
              >
                Method 1: Developer Tools (Recommended)
              </div>
              <div className="guide-step">
                <span className="step-num">1</span> Go to{' '}
                <a href="https://chatgpt.com" target="_blank">
                  chatgpt.com
                </a>
              </div>
              <div className="guide-step">
                <span className="step-num">2</span> Press <code>F12</code> →{' '}
                <strong>Application</strong> tab → <strong>Cookies</strong>
              </div>
              <div className="guide-step">
                <span className="step-num">3</span> Select{' '}
                <code>chatgpt.com</code> from list
              </div>
              <div className="guide-step">
                <span className="step-num">4</span> Copy value of{' '}
                <code>__Secure-next-auth.session-token</code>
              </div>
            </div>

            <div className="or-divider">— OR —</div>

            <div className="guide-method">
              <div
                style={{ fontWeight: 600, color: '#fff', marginBottom: '6px' }}
              >
                Method 2: Browser Extension
              </div>
              <div className="guide-step">
                Use{' '}
                <a
                  href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
                  target="_blank"
                >
                  Get cookies.txt LOCALLY
                </a>
              </div>
              <div className="guide-step">
                While you're at chatgpt.com, open extension → Find{' '}
                <code>__Secure-next-auth.session-token</code> → Copy value.
              </div>
              <div className="guide-step">Paste value into token input.</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-text-only" onClick={handleResetDefaults}>
            Reset Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

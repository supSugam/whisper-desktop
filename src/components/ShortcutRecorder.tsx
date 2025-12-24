import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/useConfigStore';

export const ShortcutRecorder: React.FC = () => {
  const { config, updateSetting } = useConfigStore();
  const [recording, setRecording] = useState(false);
  const [value, setValue] = useState(config.globalShortcut || 'Ctrl+Alt+Space');
  
  useEffect(() => {
    setValue(config.globalShortcut || 'Ctrl+Alt+Space');
  }, [config.globalShortcut]);
  
  const handleKey = async (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    
    let k = e.key.toUpperCase();
    if (k === ' ') k = 'Space';
    parts.push(k);
    
    const combo = parts.join('+');
    setValue(combo);
    await updateSetting('globalShortcut', combo);
    
    stopRecording();
  };
  
  const startRecording = () => {
    if (recording) {
      stopRecording();
      return;
    }
    setRecording(true);
    setValue('');
    window.addEventListener('keydown', handleKey);
    
    const cancel = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      if (!target.closest('.shortcut-recorder')) {
        stopRecording();
        setValue(config.globalShortcut || 'Ctrl+Alt+Space');
        document.removeEventListener('click', cancel);
      }
    };
    setTimeout(() => document.addEventListener('click', cancel), 100);
  };
  
  const stopRecording = () => {
    setRecording(false);
    window.removeEventListener('keydown', handleKey);
  };
  
  return (
    <div className="form-row" id="shortcut-recorder-row">
      <label className="form-label">Shortcut</label>
      <div className="shortcut-recorder">
        <input
          type="text"
          id="shortcut-value-input"
          className={`shortcut-input ${recording ? 'recording' : ''}`}
          readOnly
          placeholder={recording ? 'Press keys...' : 'Click to record...'}
          value={value}
          onClick={startRecording}
        />
        <button
          id="shortcut-record-btn"
          className="icon-btn-sm"
          title="Record New Shortcut"
          onClick={startRecording}
        >
          {recording ? '⬛' : '🔴'}
        </button>
      </div>
    </div>
  );
};

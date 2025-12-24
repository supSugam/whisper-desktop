import React, { useEffect, useState } from 'react';
import { documentDir, join } from '@tauri-apps/api/path';
import { useSrtConfigStore } from '../stores/useSrtConfigStore';

interface SrtPanelProps {
  disabled?: boolean;
}

export const SrtPanel: React.FC<SrtPanelProps> = ({ disabled = false }) => {
  const { 
    enabled, 
    filenameMode, 
    customFilename, 
    outputPath,
    setEnabled,
    setFilenameMode,
    setCustomFilename,
    setOutputPath
  } = useSrtConfigStore();
  
  const [defaultPath, setDefaultPath] = useState<string>('');

  // Get platform-specific documents directory
  useEffect(() => {
    const getDefaultPath = async () => {
      try {
        const docsDir = await documentDir();
        const srtOutputDir = await join(docsDir, 'WhisperOutputs');
        setDefaultPath(srtOutputDir);
      } catch (e) {
        setDefaultPath('Documents/WhisperOutputs');
      }
    };
    getDefaultPath();
  }, []);

  const isDisabled = disabled;

  return (
    <div className={`srt-panel ${isDisabled ? 'panel-disabled' : ''}`}>
      <div className="srt-options">
        {/* Enable Toggle */}
        <div className="srt-option-row">
          <div className="option-info">
            <span className="option-label">Enable SRT Output</span>
            <span className="option-hint">Generate subtitle file alongside transcription</span>
          </div>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isDisabled}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* Output Path */}
        <div className="srt-option-row">
          <div className="option-info">
            <span className="option-label">Output Location</span>
            <span className="option-hint">Where to save the .srt file</span>
          </div>
          <div className="filename-mode-toggle">
            <button 
              className={`mode-btn ${outputPath === 'default' ? 'active' : ''}`}
              onClick={() => setOutputPath('default')}
              disabled={isDisabled || !enabled}
            >
              Documents
            </button>
            <button 
              className={`mode-btn ${outputPath === 'sameas' ? 'active' : ''}`}
              onClick={() => setOutputPath('sameas')}
              disabled={isDisabled || !enabled}
            >
              Same as file
            </button>
          </div>
        </div>

        {/* Default path info */}
        {outputPath === 'default' && enabled && defaultPath && !isDisabled && (
          <div className="srt-path-info">
            {defaultPath}
          </div>
        )}

        {/* Filename Mode */}
        <div className="srt-option-row">
          <div className="option-info">
            <span className="option-label">Filename</span>
            <span className="option-hint">How the .srt file should be named</span>
          </div>
          <div className="filename-mode-toggle">
            <button 
              className={`mode-btn ${filenameMode === 'same' ? 'active' : ''}`}
              onClick={() => setFilenameMode('same')}
              disabled={isDisabled || !enabled}
            >
              Same as file
            </button>
            <button 
              className={`mode-btn ${filenameMode === 'custom' ? 'active' : ''}`}
              onClick={() => setFilenameMode('custom')}
              disabled={isDisabled || !enabled}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom Filename Input (only shown when custom mode) */}
        {filenameMode === 'custom' && !isDisabled && (
          <div className="srt-option-row custom-filename-row">
            <div className="option-info">
              <span className="option-label">Custom Filename</span>
              <span className="option-hint">Enter your preferred filename</span>
            </div>
            <div className="filename-input-group">
              <input
                type="text"
                className="srt-filename-input"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="transcription"
                disabled={isDisabled || !enabled}
              />
              <span className="filename-ext">.srt</span>
            </div>
          </div>
        )}
      </div>

      {/* Info Text */}
      {enabled && !isDisabled && (
        <div className="srt-info">
          <span className="info-icon">ℹ️</span>
          SRT file will be saved when transcription completes
        </div>
      )}
    </div>
  );
};

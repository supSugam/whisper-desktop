import React, { useState, useEffect } from 'react';
import {invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useConfigStore } from '../stores/useConfigStore';
import { useToastStore } from '../stores/useToastStore';
import { ICONS } from '../ui/icons';

const MODELS = [
  { name: 'Tiny', size: '~75 MB' },
  { name: 'Base', size: '~142 MB' },
  { name: 'Small', size: '~466 MB' },
  { name: 'Medium', size: '~1.5 GB' },
  { name: 'Large', size: '~2.9 GB' },
];

interface SystemStats {
  total_memory: number;
  free_memory: number;
  cpu_cores: number;
  has_nvidia: boolean;
  has_amd: boolean;
  backend: string;
}

interface DownloadProgress {
  model_name: string;
  total: number;
  downloaded: number;
  percentage: number;
}

export const ModelManager: React.FC = () => {
  const { config, updateSetting } = useConfigStore();
  const showToast = useToastStore(state => state.show);
  const [statuses, setStatuses] = useState<Map<string, boolean>>(new Map());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [distro, setDistro] = useState<string>('unknown');
  
  useEffect(() => {
    checkAllModels();
    getSystemStats();
    
    // Detect Linux distro
    invoke<string>('get_linux_distro').then(setDistro).catch(() => setDistro('unknown'));
    
    const unlisten = listen<DownloadProgress>('download_progress', (event) => {
      console.log('[ModelManager] Download progress:', event.payload);
      setProgress(prev => new Map(prev).set(event.payload.model_name, event.payload.percentage));
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);
  
  const getSystemStats = async () => {
    try {
      const stats = await invoke<SystemStats>('get_system_stats');
      setStats(stats);
    } catch (e) {
      console.error('Failed to get system stats', e);
    }
  };
  
  const checkAllModels = async () => {
    const newStatuses = new Map<string, boolean>();
    for (const m of MODELS) {
      try {
        const exists = await invoke<boolean>('check_model_exists', { modelName: m.name });
        newStatuses.set(m.name, exists);
      } catch (e) {
        console.error(`Check ${m.name} failed`, e);
      }
    }
    setStatuses(newStatuses);
  };
  
  const downloadModel = async (modelName: string) => {
    if (downloading.has(modelName)) {
      showToast('Download already in progress');
      return;
    }
    
    setDownloading(prev => new Set(prev).add(modelName));
    try {
      await invoke('download_model', { modelName });
      showToast(`${modelName} downloaded`);
      await checkAllModels();
    } catch (e) {
      showToast(`Download failed: ${e}`);
    } finally {
      setDownloading(prev => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
      setProgress(prev => {
        const next = new Map(prev);
        next.delete(modelName);
        return next;
      });
    }
  };
  
  const cancelDownload = async (modelName: string) => {
    try {
      // Call Rust backend to cancel the download
      await invoke('cancel_download', { modelName });
    } catch (e) {
      console.error('Cancel download error:', e);
    }
    
    // Update UI state
    setDownloading(prev => {
      const next = new Set(prev);
      next.delete(modelName);
      return next;
    });
    setProgress(prev => {
      const next = new Map(prev);
      next.delete(modelName);
      return next;
    });
    
    // Refresh model status
    await checkAllModels();
    
    showToast('Download cancelled');
  };
  
  const deleteModel = async (modelName: string) => {
    if (!confirm(`Delete ${modelName} model? This will permanently remove the model file from your device.`)) return;
    
    try {
      await invoke('delete_model', { modelName });
      showToast(`${modelName} deleted`);
      
      // Refresh to verify deletion
      await checkAllModels();
      
      // Double-check the model is actually gone
      const stillExists = await invoke<boolean>('check_model_exists', { modelName });
      if (stillExists) {
        showToast('Warning: Model file may still exist');
        console.error('Model deletion verification failed');
      }
    } catch (e) {
      showToast(`Delete failed: ${e}`);
      console.error('Delete error:', e);
    }
  };
  
  const selectModel = async (modelName: string) => {
    await updateSetting('localModel', modelName);
  };
  
  const toggleGPU = async () => {
    await updateSetting('useLocalGPU', !config.useLocalGPU);
  };
  
  const isGPUBackend = stats?.backend !== 'CPU';
  const memGB = stats ? Math.round(stats.total_memory / 1024 / 1024 / 1024) : 8;
  
  return (
    <div id="model-manager-container">
      <div className="model-list">
        {stats && (
          <div className={`hardware-card ${isGPUBackend ? 'gpu-ready' : ''}`}>
            <div className="hw-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span dangerouslySetInnerHTML={{ __html: isGPUBackend ? ICONS.gpu : ICONS.cpu }} />
                <strong>{stats.backend}</strong>
              </div>
              {isGPUBackend ? (
                <button className={`btn-sm gpu-toggle ${config.useLocalGPU ? 'active' : ''}`} onClick={toggleGPU}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span dangerouslySetInnerHTML={{ __html: ICONS.gpu }} />
                    <span>{config.useLocalGPU ? 'Enabled' : 'Enable GPU'}</span>
                  </div>
                </button>
              ) : (
                <span className="badge badge-warn">CPU Only</span>
              )}
            </div>
            <div className="hw-details">
              <div>CPU Cores: {stats.cpu_cores} | RAM: {memGB} GB</div>
              {!isGPUBackend && stats.has_nvidia && (
                <div className="gpu-setup-guide">
                  <div className="setup-header">
                    <span dangerouslySetInnerHTML={{ __html: ICONS.bulb }} />
                    <strong>NVIDIA GPU Detected - Enable GPU Acceleration</strong>
                  </div>
                  <div className="setup-instructions">
                    <p className="setup-desc">Install CUDA toolkit to enable GPU-accelerated transcription (10-50x faster):</p>
                    {distro === 'ubuntu' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo apt install nvidia-cuda-toolkit</code>
                      </div>
                    )}
                    {distro === 'fedora' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo dnf install cuda</code>
                      </div>
                    )}
                    {distro === 'arch' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo pacman -S cuda</code>
                      </div>
                    )}
                    {distro === 'unknown' && (
                      <div className="command-group">
                        <div className="command-label" style={{ color: '#f6d32d' }}>Install CUDA for your distribution</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
                          Visit <a href="https://developer.nvidia.com/cuda-downloads" target="_blank" rel="noopener noreferrer" style={{ color: '#2ec27e' }}>NVIDIA CUDA Downloads</a>
                        </div>
                      </div>
                    )}
                    <div className="setup-note">After installation, restart the app to enable GPU mode.</div>
                  </div>
                </div>
              )}
              {!isGPUBackend && stats.has_amd && (
                <div className="gpu-setup-guide">
                  <div className="setup-header">
                    <span dangerouslySetInnerHTML={{ __html: ICONS.bulb }} />
                    <strong>AMD GPU Detected - Enable GPU Acceleration</strong>
                  </div>
                  <div className="setup-instructions">
                    <p className="setup-desc">Install Vulkan drivers to enable GPU-accelerated transcription (5-20x faster):</p>
                    {distro === 'ubuntu' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo apt install mesa-vulkan-drivers vulkan-tools</code>
                      </div>
                    )}
                    {distro === 'fedora' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo dnf install vulkan mesa-vulkan-drivers</code>
                      </div>
                    )}
                    {distro === 'arch' && (
                      <div className="command-group">
                        <div className="command-label">Run this command:</div>
                        <code className="command-box">sudo pacman -S vulkan-icd-loader lib32-vulkan-icd-loader</code>
                      </div>
                    )}
                    {distro === 'unknown' && (
                      <div className="command-group">
                        <div className="command-label" style={{ color: '#f6d32d' }}>Install Vulkan for your distribution</div>
                        <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
                          Check your distribution's documentation for Vulkan driver installation
                        </div>
                      </div>
                    )}
                    <div className="setup-note">After installation, restart the app to enable GPU mode.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="form-info-box">
          ⚠️ Models are downloaded to your device. Performance depends on your CPU. "Tiny" is recommended for most users.
        </div>
        {MODELS.map(model => {
          const exists = statuses.get(model.name) || false;
          const isDownloading = downloading.has(model.name);
          const isActive = config.localModel === model.name;
          const downloadProgress = progress.get(model.name) || 0;
          
          let warning = '';
          let disabled = false;
          
          if (model.name === 'Large') {
            if (memGB < 8) { warning = 'Low RAM'; disabled = true; }
            else if (memGB < 12) warning = 'High RAM';
          }
          if (model.name === 'Medium' && memGB < 4) warning = 'May Freeze';
          
          let statusText = exists ? 'Ready' : 'Not Saved';
          if (isDownloading) statusText = 'Downloading...';
          
          return (
            <div
              key={model.name}
              className={`model-row ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''} ${isDownloading ? 'downloading' : ''}`}
              data-model={model.name}
            >
              <div className="model-row-content">
                <div className="col-main">
                  <div className="row-top">
                    <span className="model-name">{model.name}</span>
                    {isActive && (
                      <span className="icon-active" title="Active" dangerouslySetInnerHTML={{ __html: ICONS.check }} />
                    )}
                  </div>
                  <div className="row-sub">
                    <span className="model-size">
                      {model.size}
                      {isDownloading && <span className="download-percentage"> • {Math.round(downloadProgress)}%</span>}
                    </span>
                  </div>
                </div>

                <div className="col-status">
                  {!isDownloading && (
                    <>
                      <span className={`status-label ${exists ? 'ready' : ''}`}>{statusText}</span>
                      {warning && (
                        <span className="badge badge-warn">
                          <span dangerouslySetInnerHTML={{ __html: ICONS.warn }} /> {warning}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <div className="col-actions">
                  {!exists && !isDownloading && (
                    <button
                      className="btn-icon btn-download"
                      onClick={() => downloadModel(model.name)}
                      title="Download"
                      dangerouslySetInnerHTML={{ __html: ICONS.download }}
                    />
                  )}

                  {isDownloading && (
                    <button
                      className="btn-icon btn-cancel"
                      onClick={() => cancelDownload(model.name)}
                      title="Cancel Download"
                    >
                      ×
                    </button>
                  )}

                  {exists && !isDownloading && (
                    <>
                      {!isActive && (
                        <button className="btn-text" onClick={() => selectModel(model.name)}>
                          USE
                        </button>
                      )}
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => deleteModel(model.name)}
                        title="Delete"
                        dangerouslySetInnerHTML={{ __html: ICONS.trash }}
                      />
                    </>
                  )}
                </div>
              </div>
              
              {isDownloading && (
                <div className="model-progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${downloadProgress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConfigStore } from '../stores/useConfigStore';
import { useToastStore } from '../stores/useToastStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { Flex, Text, Button, Select, Box, Progress, IconButton, Badge, Separator, AlertDialog } from '@radix-ui/themes';
import { X, Download, Trash2, HardDrive } from 'lucide-react';

const MODELS = [
  { name: 'Tiny', size: '~75 MB', speed: 'Fastest' },
  { name: 'Base', size: '~142 MB', speed: 'Fast' },
  { name: 'Small', size: '~466 MB', speed: 'Balanced' },
  { name: 'Medium', size: '~1.5 GB', speed: 'Accurate' },
  { name: 'Large', size: '~2.9 GB', speed: 'Best' },
];

interface SystemStats {
  total_memory: number;
  free_memory: number;
  cpu_cores: number;
  backend: string;
}

export const ModelManager: React.FC = () => {
  const { config, updateSetting } = useConfigStore();
  const showToast = useToastStore(state => state.show);
  const { downloading, progress, startDownload, setDownloading, setProgress, cancelDownload } = useDownloadStore();
  
  const [statuses, setStatuses] = useState<Map<string, boolean>>(new Map());
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  
  useEffect(() => {
    checkAllModels();
    getSystemStats();
  }, [downloading]); // Re-check models when a download finishes
  
  const getSystemStats = async () => {
    try {
      const s = await invoke<SystemStats>('get_system_stats');
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  };
  
  const checkAllModels = async () => {
    const newStatuses = new Map<string, boolean>();
    for (const m of MODELS) {
      try {
        const exists = await invoke<boolean>('check_model_exists', { modelName: m.name });
        newStatuses.set(m.name, exists);
      } catch (e) {}
    }
    setStatuses(newStatuses);
  };
  
  const handleDownload = async (modelName: string) => {
    if (downloading.has(modelName)) return;
    startDownload(modelName);
    try {
      await invoke('download_model', { modelName });
      showToast(`${modelName} model ready`);
      await checkAllModels();
    } catch (e) {
      showToast(`Download failed`);
    } finally {
      setDownloading(modelName, false);
      setProgress(modelName, 0); // clear progress
    }
  };
  
  const handleCancelDownload = async (modelName: string) => {
    await cancelDownload(modelName);
    await checkAllModels();
  };
  
  const deleteModel = async (modelName: string) => {
    try {
      await invoke('delete_model', { modelName });
      showToast(`${modelName} deleted`);
      await checkAllModels();
    } catch (e) {}
  };
  
  const isGPUBackend = stats?.backend !== 'CPU';
  const currentModel = config.localModel || 'Tiny';
  const activeExists = statuses.get(currentModel) || false;
  const activeDownloading = downloading.has(currentModel);
  const activeProgress = progress.get(currentModel) || 0;
  const activeModelInfo = MODELS.find(m => m.name === currentModel) || MODELS[0];
  const installedCount = Array.from(statuses.values()).filter(Boolean).length;
  
  return (
    <Flex direction="column" gap="3">
      {/* Model Selection Row */}
      <Flex justify="between" align="center">
        <Box>
          <Text size="2" weight="medium" color="gray" as="div">Model</Text>
          <Text size="1" color="gray" style={{ opacity: 0.6 }}>{activeModelInfo.size} • {activeModelInfo.speed}</Text>
        </Box>
        <Select.Root value={currentModel} onValueChange={(val) => updateSetting('localModel', val)}>
          <Select.Trigger variant="surface" color="gray" style={{ minWidth: '130px' }} />
          <Select.Content color="gray">
            {MODELS.map((m) => {
              const installed = statuses.get(m.name);
              return (
                <Select.Item key={m.name} value={m.name}>
                  {m.name} {installed ? '✓' : ''}
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Root>
      </Flex>

      {/* Download Action if model not installed */}
      {!activeExists && !activeDownloading && (
        <Flex justify="between" align="center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px' }}>
          <Text size="1" color="gray">Selected model is not downloaded</Text>
          <Button size="1" variant="soft" color="gray" onClick={() => handleDownload(currentModel)}>
            <Download size={13} style={{ marginRight: 4 }} /> Download
          </Button>
        </Flex>
      )}

      {/* Download Progress Bar */}
      {activeDownloading && (
        <Box style={{ padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
          <Flex justify="between" align="center" mb="1">
            <Text size="1" color="gray">Downloading {currentModel}... ({Math.round(activeProgress)}%)</Text>
            <IconButton size="1" variant="ghost" color="gray" onClick={() => handleCancelDownload(currentModel)}>
              <X size={13} />
            </IconButton>
          </Flex>
          <Progress value={activeProgress} max={100} size="1" color="gray" />
        </Box>
      )}

      <Separator size="4" color="gray" />

      {/* Hardware Acceleration Row */}
      {stats && (
        <Flex justify="between" align="center">
          <Box>
            <Text size="2" weight="medium" color="gray" as="div">Hardware Engine</Text>
            <Text size="1" color="gray" style={{ opacity: 0.6 }}>Backend: {stats.backend}</Text>
          </Box>
          {isGPUBackend ? (
            <Button size="1" variant={config.useLocalGPU ? 'soft' : 'outline'} color="gray" onClick={() => updateSetting('useLocalGPU', !config.useLocalGPU)}>
              {config.useLocalGPU ? 'GPU Enabled' : 'Enable GPU'}
            </Button>
          ) : (
            <Badge color="gray" variant="surface" size="1">CPU Only</Badge>
          )}
        </Flex>
      )}

      <Separator size="4" color="gray" />

      {/* Storage Management Drawer */}
      <Box>
        <Flex justify="between" align="center">
          <Text size="2" weight="medium" color="gray">Storage</Text>
          <Button size="1" variant="ghost" color="gray" onClick={() => setShowStorage(!showStorage)} style={{ opacity: 0.7 }}>
            <HardDrive size={13} style={{ marginRight: 4 }} /> {showStorage ? 'Close' : `${installedCount} installed`}
          </Button>
        </Flex>

        {showStorage && (
          <Flex direction="column" gap="1" mt="2" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '6px' }}>
            {MODELS.map((m) => {
              const isInst = statuses.get(m.name);
              const isCurrent = m.name === currentModel;
              return (
                <Flex key={m.name} justify="between" align="center" py="1" px="2" style={{ opacity: isInst ? 1 : 0.4 }}>
                  <Text size="1" color="gray">{m.name} ({m.size}) {isCurrent ? '• Active' : ''}</Text>
                  {isInst ? (
                    <AlertDialog.Root>
                      <AlertDialog.Trigger>
                        <IconButton size="1" variant="ghost" color="gray" title="Delete Model File">
                          <Trash2 size={13} />
                        </IconButton>
                      </AlertDialog.Trigger>
                      <AlertDialog.Content maxWidth="450px" style={{ backgroundColor: 'var(--color-panel-solid)', borderRadius: '12px' }}>
                        <AlertDialog.Title>Delete Model</AlertDialog.Title>
                        <AlertDialog.Description size="2">
                          Are you sure you want to delete the {m.name} model from disk? You can always redownload it later.
                        </AlertDialog.Description>
                        <Flex gap="3" mt="4" justify="end">
                          <AlertDialog.Cancel>
                            <Button variant="soft" color="gray">Cancel</Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button variant="solid" color="red" onClick={() => deleteModel(m.name)}>
                              Delete
                            </Button>
                          </AlertDialog.Action>
                        </Flex>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  ) : (
                    <IconButton size="1" variant="ghost" color="gray" onClick={() => handleDownload(m.name)} title="Download Model">
                      <Download size={13} />
                    </IconButton>
                  )}
                </Flex>
              );
            })}
          </Flex>
        )}
      </Box>
    </Flex>
  );
};




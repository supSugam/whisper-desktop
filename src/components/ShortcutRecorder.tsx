import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/useConfigStore';
import { Flex, Text, Box } from '@radix-ui/themes';

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
    <Flex 
      className="shortcut-recorder" 
      align="center" 
      justify="between" 
      py="2"
      onClick={startRecording}
      style={{ cursor: 'pointer' }}
    >
      <Text size="2" weight="medium" style={{ color: '#d4d4d8' }}>Keys</Text>
      <Box 
        px="3" 
        py="1" 
        style={{ 
          backgroundColor: recording ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', 
          borderRadius: '8px', 
          border: recording ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.15s ease',
          minWidth: '100px',
          textAlign: 'center',
        }}
      >
        <Text size="2" weight="medium" style={{ color: recording ? '#e4e4e7' : '#a1a1aa', fontFamily: 'monospace', fontSize: '12px' }}>
          {recording ? 'Press keys...' : value}
        </Text>
      </Box>
    </Flex>
  );
};

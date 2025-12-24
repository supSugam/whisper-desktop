import React, { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TitleBar } from './components/TitleBar';
import { MainLayout } from './components/MainLayout';
import { Toast } from './components/Toast';
import { useConfigStore } from './stores/useConfigStore';
import { useHistoryStore } from './stores/useHistoryStore';
import { useRecording } from './hooks/useRecording';
import { useShortcuts } from './hooks/useShortcuts';
import { useCLIEvents } from './hooks/useCLIEvents';

const App: React.FC = () => {
  const initialize = useConfigStore(state => state.initialize);
  const initializeHistory = useHistoryStore(state => state.initialize);
  const { toggleRecord, startRecord, stopRecord } = useRecording();
  
  useEffect(() => {
    const init = async () => {
      // Initialize stores
      await initialize();
      await initializeHistory();
      
      // Show window after initialization
      await getCurrentWindow().show();
      
      // Periodic history time updates
      const interval = setInterval(() => {
        useHistoryStore.getState().refresh();
      }, 60000);
      
      return () => clearInterval(interval);
    };
    
    init();
  }, [initialize, initializeHistory]);
  
  // Set up shortcuts
  useShortcuts({
    onToggle: toggleRecord,
    onPress: startRecord,
    onRelease: stopRecord,
  });
  
  // Set up CLI events
  useCLIEvents({ onToggle: toggleRecord });
  
  return (
    <>
      <TitleBar />
      <MainLayout />
      <Toast />
    </>
  );
};

export default App;

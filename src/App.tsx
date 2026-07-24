import React, { useEffect, useState, createContext, useContext } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Flex } from '@radix-ui/themes';
import { MainView } from './components/MainView';
import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { Toast } from './components/Toast';
import { useConfigStore } from './stores/useConfigStore';
import { useHistoryStore } from './stores/useHistoryStore';
import { useShortcuts } from './hooks/useShortcuts';
import { useCLIEvents } from './hooks/useCLIEvents';
import { toggleRecord } from './lib/recordingController';
import { listen } from '@tauri-apps/api/event';
import { useDownloadStore } from './stores/useDownloadStore';
import { useUpdater } from './hooks/useUpdater';

export type ViewType = 'main' | 'settings' | 'history';

interface ViewContextType {
  view: ViewType;
  setView: (view: ViewType) => void;
}

export const ViewContext = createContext<ViewContextType>({
  view: 'main',
  setView: () => {},
});

export const useView = () => useContext(ViewContext);

const App: React.FC = () => {
  const [view, setViewState] = useState<ViewType>(() => {
    const hash = window.location.hash.replace('#', '');
    return (hash === 'settings' || hash === 'history') ? hash as ViewType : 'main';
  });

  const setView = (newView: ViewType) => {
    if (newView !== view) {
      window.history.pushState({}, '', `#${newView}`);
      setViewState(newView);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      const newView = (hash === 'settings' || hash === 'history') ? hash as ViewType : 'main';
      setViewState(newView);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const hash = window.location.hash.replace('#', '');
        if (hash === 'settings' || hash === 'history') {
          // If in an input, let it handle Escape first (unless it didn't stop propagation)
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
            return;
          }
          e.preventDefault();
          window.history.back(); // Natural browser back
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const initialize = useConfigStore((state) => state.initialize);
  const initializeHistory = useHistoryStore((state) => state.initialize);

  useEffect(() => {
    const init = async () => {
      await initialize();
      await initializeHistory();

      try {
        const isAutostarted = await invoke<boolean>('was_autostarted');
        if (!isAutostarted) {
          await getCurrentWindow().show();
        }
      } catch (e) {
        console.warn('Window show failed:', e);
      }
    };

    init();

    const interval = setInterval(() => {
      useHistoryStore.getState().refresh();
    }, 60000);

    return () => clearInterval(interval);
  }, [initialize, initializeHistory]);

  useShortcuts();
  useCLIEvents({ onToggle: toggleRecord });
  useUpdater();

  useEffect(() => {
    const unlisten = listen<{model_name: string, percentage: number}>('download_progress', (event) => {
      useDownloadStore.getState().setProgress(event.payload.model_name, event.payload.percentage);
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <Flex direction="column" height="100vh" style={{ overflow: 'hidden' }}>
        <Flex direction="column" flexGrow="1" position="relative" style={{ overflow: 'hidden' }}>
          <div key={view} className="view-enter" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            {view === 'main' && <MainView />}
            {view === 'settings' && <SettingsView />}
            {view === 'history' && <HistoryView />}
          </div>
        </Flex>
        <Toast />
      </Flex>
    </ViewContext.Provider>
  );
};

export default App;

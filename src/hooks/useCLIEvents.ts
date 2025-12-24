import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface UseCLIEventsProps {
  onToggle: () => void;
}

export const useCLIEvents = ({ onToggle }: UseCLIEventsProps) => {
  useEffect(() => {
    const unlisten = listen('cli-toggle', () => {
      console.log('CLI toggle triggered');
      onToggle();
    });
    
    return () => {
      unlisten.then(fn => fn());
    };
  }, [onToggle]);
};

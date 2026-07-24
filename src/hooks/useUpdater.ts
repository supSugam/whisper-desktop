import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToastStore } from '../stores/useToastStore';

export function useUpdater() {
  const { showToast } = useToastStore.getState();

  useEffect(() => {
    // Delay check so app init is fully settled first
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (!update?.available) return;

        const version = update.version ?? 'latest';

        showToast(
          `Update v${version} available`,
          0, // persistent — stays until dismissed or acted on
          {
            label: 'Install & Restart',
            onClick: async () => {
              showToast('Downloading update…', 0);
              try {
                await update.downloadAndInstall((event) => {
                  if (event.event === 'Progress' && event.data.chunkLength != null) {
                    // Could show progress here if wanted
                  }
                });
                await relaunch();
              } catch (e) {
                showToast('Update failed. Try again later.');
              }
            },
          }
        );
      } catch (_) {
        // Silently ignore — no network, no release, etc.
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);
}

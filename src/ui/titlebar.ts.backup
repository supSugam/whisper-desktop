import { getCurrentWindow } from '@tauri-apps/api/window';
import { ICONS } from './icons';

export function renderTitleBar() {
  const appWindow = getCurrentWindow();
  
  const titlebar = document.createElement('div');
  titlebar.id = 'titlebar';
  titlebar.setAttribute('data-tauri-drag-region', '');

  titlebar.innerHTML = `
    <div class="title-text">Whisper+</div>
    <div class="titlebar-controls">
      <div class="titlebar-btn" id="titlebar-minimize">
        ${ICONS.minimize}
      </div>
      <div class="titlebar-btn" id="titlebar-maximize">
        ${ICONS.maximize}
      </div>
      <div class="titlebar-btn" id="titlebar-close">
        ${ICONS.close}
      </div>
    </div>
  `;

  document.body.prepend(titlebar);

  // Double-click to toggle maximize
  titlebar.addEventListener('dblclick', () => appWindow.toggleMaximize());

  document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
  document.getElementById('titlebar-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
  document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());

  // Listen for maximize events to toggle icon (optional polish)
  /* 
  appWindow.listen('tauri://resize', async () => {
     const max = await appWindow.isMaximized();
     // swap icon
  });
  */
}

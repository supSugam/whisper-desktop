import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  
  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();
  
  return (
    <div data-tauri-drag-region className="titlebar">
      <div className="titlebar-button" onClick={handleMinimize}>
        <div className="titlebar-icon">−</div>
      </div>
      <div className="titlebar-button" onClick={handleMaximize}>
        <div className="titlebar-icon">□</div>
      </div>
      <div className="titlebar-button close" onClick={handleClose}>
        <div className="titlebar-icon">×</div>
      </div>
    </div>
  );
};

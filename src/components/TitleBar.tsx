import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Flex, IconButton } from '@radix-ui/themes';
import { Minus, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();

  return (
    <Flex 
      data-tauri-drag-region
      justify="end" 
      align="center"
      p="2"
      gap="2"
      style={{ userSelect: 'none' }}
    >
      <IconButton 
        variant="ghost" 
        color="gray"
        size="1" 
        onClick={() => appWindow.minimize()}
        title="Minimize"
        style={{ pointerEvents: 'auto' }}
      >
        <Minus size={14} />
      </IconButton>
      <IconButton 
        variant="ghost" 
        color="gray"
        size="1" 
        onClick={() => appWindow.close()}
        title="Close"
        style={{ pointerEvents: 'auto' }}
      >
        <X size={14} />
      </IconButton>
    </Flex>
  );
};

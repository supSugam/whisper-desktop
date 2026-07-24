import React, { useEffect, useState } from 'react';
import { useToastStore } from '../stores/useToastStore';
import { Flex, Text, IconButton, Button } from '@radix-ui/themes';
import { X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { message, isVisible, action, hide } = useToastStore();
  const [render, setRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) setRender(true);
  }, [isVisible]);

  const handleTransitionEnd = () => {
    if (!isVisible) setRender(false);
  };

  if (!render) return null;

  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: `translate(-50%, ${isVisible ? '0' : '16px'}) scale(${isVisible ? 1 : 0.95})`,
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 9999,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <Flex
        align="center"
        gap="3"
        px="4"
        py="2"
        style={{
          backgroundColor: 'rgba(24, 24, 27, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '9999px',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.6)',
          minWidth: 'min-content',
          whiteSpace: 'nowrap',
        }}
      >
        <Text size="2" weight="medium" style={{ color: '#e4e4e7' }}>
          {message}
        </Text>

        {action && (
          <Button
            size="1"
            variant="solid"
            radius="full"
            style={{ cursor: 'pointer', fontSize: '11px' }}
            onClick={() => {
              hide();
              action.onClick();
            }}
          >
            {action.label}
          </Button>
        )}

        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          radius="full"
          style={{ margin: '-4px -4px -4px 0', cursor: 'pointer' }}
          onClick={() => hide()}
        >
          <X size={14} />
        </IconButton>
      </Flex>
    </div>
  );
};

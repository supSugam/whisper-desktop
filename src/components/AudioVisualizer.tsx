import React, { useEffect, useState, useRef } from 'react';
import { Flex, Box } from '@radix-ui/themes';
import { listen } from '@tauri-apps/api/event';

interface Props {
  active: boolean;
}

const BAR_COUNT = 32;

export const AudioVisualizer: React.FC<Props> = ({ active }) => {
  const [history, setHistory] = useState<number[]>(Array(BAR_COUNT).fill(0));
  // Track ambient noise using an exponential moving average (more stable than absolute min)
  const ambientRef = useRef<number>(-1);

  useEffect(() => {
    if (!active) {
      setHistory(Array(BAR_COUNT).fill(0));
      ambientRef.current = -1;
      return;
    }

    const unlisten = listen<number>('audio-level', (e) => {
      const raw = e.payload;

      // Initialize ambient level on first sample
      if (ambientRef.current < 0) {
        ambientRef.current = raw;
      }

      // Slowly adapt the ambient level:
      // - Drops quickly to catch quieter moments (factor 0.1)
      // - Rises very slowly so speech doesn't raise the floor (factor 0.001)
      if (raw < ambientRef.current) {
        ambientRef.current = ambientRef.current * 0.9 + raw * 0.1;
      } else {
        ambientRef.current = ambientRef.current * 0.999 + raw * 0.001;
      }

      // Subtract most of the ambient level but leave a sliver so distant speech registers
      const clean = Math.max(0, raw - ambientRef.current * 0.98);

      setHistory((prev) => [clean, ...prev.slice(0, BAR_COUNT - 1)]);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [active]);

  // Newest on right, oldest on left
  const displayHistory = [...history].reverse();

  const bars = displayHistory.map((l) => {
    const base = Math.max(4, Math.round(l * 6000));
    return Math.min(base, 48);
  });

  return (
    <Flex align="center" justify="center" gap="1" style={{ height: '48px', width: '100%' }}>
      {bars.map((h, i) => (
        <Box
          key={i}
          style={{
            width: '3px',
            height: `${h}px`,
            background: active 
              ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' 
              : 'rgba(255, 255, 255, 0.15)',
            borderRadius: '9999px',
            transition: 'height 0.08s ease-out, background 0.2s ease',
            boxShadow: active && h > 6 ? '0 0 8px rgba(52, 211, 153, 0.4)' : 'none',
          }}
        />
      ))}
    </Flex>
  );
};

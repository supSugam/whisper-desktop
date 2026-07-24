import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { formatDuration } from './lib/utils';

const BAR_COUNT = 20;

// ─── Real microphone waveform driven by Rust audio-level events ───────────────
const Waveform: React.FC<{ level: number }> = ({ level }) => {
  // Keep a short history of levels to drive individual bars
  const historyRef = useRef<number[]>(Array(BAR_COUNT).fill(0));

  // Push the new level into history and shift
  useEffect(() => {
    historyRef.current = [level, ...historyRef.current.slice(0, BAR_COUNT - 1)];
  }, [level]);

  const bars = historyRef.current.map((l, i) => {
    // Center bars are taller; edges taper off
    const center = 1 - Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
    const h = Math.max(3, Math.round(l * 200 * (center * 0.6 + 0.4)));
    return h;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2.5px', height: '28px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: '2.5px',
            height: `${Math.min(h, 28)}px`,
            borderRadius: '9999px',
            background: h > 3
              ? `rgba(248, 113, 113, ${0.5 + (h / 28) * 0.5})`
              : 'rgba(255,255,255,0.12)',
            transition: 'height 0.06s ease-out, background 0.1s ease',
          }}
        />
      ))}
    </div>
  );
};

// ─── Pill overlay ─────────────────────────────────────────────────────────────
export const OverlayApp: React.FC = () => {
  const [active, setActive] = useState(true); // starts true — shown only when recording
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const unStart = listen<number>('overlay-start', (e) => {
      startTimeRef.current = e.payload;
      setDuration(0);
      setActive(true);
    });

    const unStop = listen('overlay-stop', () => {
      setActive(false);
      setLevel(0);
    });

    // Real microphone amplitude from Rust
    const unLevel = listen<number>('audio-level', (e) => {
      setLevel(e.payload);
    });

    return () => {
      unStart.then(f => f());
      unStop.then(f => f());
      unLevel.then(f => f());
    };
  }, []);

  // Timer
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setDuration(Date.now() - startTimeRef.current), 100);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 14px',
        height: '44px',
        background: 'rgba(12, 12, 16, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '999px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {/* Pulsing record dot */}
        <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            animation: 'pulse-ring 1.4s ease-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '1.5px',
            borderRadius: '50%',
            backgroundColor: '#fca5a5',
          }} />
        </div>

        {/* Duration */}
        <span style={{
          color: '#f4f4f5',
          fontSize: '13px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          letterSpacing: '0.02em',
          flexShrink: 0,
          minWidth: '42px',
        }}>
          {formatDuration(duration)}
        </span>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        <Waveform level={level} />
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 1;   }
          70%  { transform: scale(2.4); opacity: 0;   }
          100% { transform: scale(2.4); opacity: 0;   }
        }
      `}</style>
    </div>
  );
};

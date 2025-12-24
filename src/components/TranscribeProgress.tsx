import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRecordingStore } from '../stores/useRecordingStore';

interface ProgressPayload {
  percentage: number;
  processed_ms: number;
  total_ms: number;
  status: string;
}

// Animated number component
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ 
  value, 
  duration = 300 
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{displayValue}</>;
};

// Format duration as human-readable (1h 23m 45s)
const formatHumanDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
};

export const TranscribeProgress: React.FC = () => {
  const { isTranscribing } = useRecordingStore();
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    const unlisten1 = listen<ProgressPayload>(
      'transcribe-progress',
      (event) => {
        setProgress(event.payload);
      }
    );

    const unlisten2 = listen<ProgressPayload>('srt-progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlisten1.then((fn) => fn());
      unlisten2.then((fn) => fn());
    };
  }, []);

  // Track start time for ETA calculation
  useEffect(() => {
    if (isTranscribing && !startTime) {
      setStartTime(Date.now());
    } else if (!isTranscribing) {
      setProgress(null);
      setStartTime(null);
    }
  }, [isTranscribing, startTime]);

  if (!isTranscribing) {
    return null;
  }

  const statusLabels: Record<string, string> = {
    loading: 'Starting...',
    converting: 'Converting...',
    loading_model: 'Loading model...',
    loading_audio: 'Loading audio...',
    preprocessing: 'Preprocessing...',
    transcribing: 'Transcribing...',
    generating_srt: 'Generating SRT...',
    saving_file: 'Saving...',
    complete: 'Complete!',
  };

  const percentage = progress?.percentage ?? 0;
  const status = progress?.status
    ? statusLabels[progress.status] || progress.status
    : 'Processing...';
  const processedMs = progress?.processed_ms ?? 0;
  const totalMs = progress?.total_ms ?? 0;

  // Calculate estimated time remaining
  let etaDisplay = '';
  if (startTime && percentage > 10) {
    const elapsed = Date.now() - startTime;
    const estimatedTotal = elapsed / (percentage / 100);
    const remaining = Math.max(0, estimatedTotal - elapsed);
    etaDisplay = formatHumanDuration(remaining);
  }

  return (
    <div className="transcribe-progress">
      <div className="progress-info">
        <span className="progress-status">{status}</span>
        <span className="progress-percent">
          <AnimatedNumber value={percentage} />%
        </span>
      </div>
      <div className="progress-bar-row">
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {totalMs > 0 && (
          <div className="progress-time-info">
            <span className="time-processed">
              {formatHumanDuration(processedMs)}
            </span>
            <span className="time-separator">/</span>
            <span className="time-total">{formatHumanDuration(totalMs)}</span>
            {etaDisplay && (
              <span className="time-eta">• ~{etaDisplay} left</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

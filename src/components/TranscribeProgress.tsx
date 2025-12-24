import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRecordingStore } from '../stores/useRecordingStore';

interface ProgressPayload {
  percentage: number;
  processed_ms: number;
  total_ms: number;
  status: string;
}

export const TranscribeProgress: React.FC = () => {
  const { isTranscribing } = useRecordingStore();
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [displayPercent, setDisplayPercent] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const unlisten = listen<ProgressPayload>('transcribe-progress', (event) => {
      setProgress(event.payload);
      
      // When we get "transcribing" status, that's when real work starts
      if (event.payload.status === 'transcribing' && startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Timer for elapsed time and smooth progress
  useEffect(() => {
    if (isTranscribing) {
      startTimeRef.current = 0;
      setDisplayPercent(0);
      setElapsedSec(0);
      
      timerRef.current = window.setInterval(() => {
        if (startTimeRef.current > 0) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSec(elapsed);
        }
        
        // Smooth progress animation
        setDisplayPercent(prev => {
          if (progress?.status === 'complete' || progress?.status === 'finishing') {
            return Math.min(100, prev + 5);
          }
          if (progress?.status === 'transcribing') {
            // Slowly increase during transcription, cap at 85%
            return Math.min(85, prev + 0.3);
          }
          // Initial stages
          const target = progress?.percentage || 0;
          if (prev < target) {
            return Math.min(target, prev + 2);
          }
          return prev;
        });
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Brief delay before hiding
      const hideTimer = setTimeout(() => {
        setProgress(null);
        setDisplayPercent(0);
        setElapsedSec(0);
        startTimeRef.current = 0;
      }, 500);
      return () => clearTimeout(hideTimer);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTranscribing, progress?.status, progress?.percentage]);

  if (!isTranscribing) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDurationMs = (ms: number): string => {
    return formatDuration(Math.floor(ms / 1000));
  };

  const statusText: Record<string, string> = {
    loading: 'Starting...',
    converting: 'Converting media...',
    loading_model: 'Loading model...',
    loading_audio: 'Processing audio...',
    transcribing: 'Transcribing...',
    finishing: 'Finishing...',
    complete: 'Complete!',
  };

  const displayStatus = progress ? (statusText[progress.status] || progress.status) : 'Processing...';
  const totalDurationMs = progress?.total_ms || 0;
  const finalPercent = Math.round(displayPercent);

  return (
    <div className="transcribe-progress">
      <div className="progress-info">
        <span className="progress-status">{displayStatus}</span>
        <span className="progress-stats">
          {totalDurationMs > 0 && (
            <span className="progress-duration">
              {formatDuration(elapsedSec)} elapsed • {formatDurationMs(totalDurationMs)} audio
            </span>
          )}
          <span className="progress-percent">{finalPercent}%</span>
        </span>
      </div>
      <div className="progress-track">
        <div 
          className="progress-fill"
          style={{ width: `${finalPercent}%` }}
        />
      </div>
    </div>
  );
};

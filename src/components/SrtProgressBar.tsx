import React from 'react';
import { useRecordingStore } from '../stores/useRecordingStore';

export const SrtProgressBar: React.FC = () => {
  const { isTranscribing, isGeneratingSrt, srtProgress } = useRecordingStore();

  // Show progress bar during transcription or SRT generation
  if (!isTranscribing && !isGeneratingSrt) {
    return null;
  }

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const statusText: Record<string, string> = {
    loading_model: 'Loading model...',
    loading_audio: 'Loading audio...',
    preprocessing: 'Preprocessing...',
    transcribing: 'Transcribing...',
    generating_srt: 'Generating subtitles...',
    saving_file: 'Saving file...',
    complete: 'Complete!',
    starting: 'Starting...',
  };

  // If just regular transcription (no SRT progress), show indeterminate
  const hasProgress = isGeneratingSrt && srtProgress;
  const percentage = hasProgress ? srtProgress.percentage : null;
  const status = hasProgress ? (statusText[srtProgress.status] || srtProgress.status) : 'Processing...';

  return (
    <div className="srt-progress-container">
      <div className="srt-progress-header">
        <span className="srt-progress-status">{status}</span>
        {percentage !== null && (
          <span className="srt-progress-percent">{percentage}%</span>
        )}
      </div>
      <div className="srt-progress-bar">
        <div 
          className={`srt-progress-fill ${percentage === null ? 'indeterminate' : ''}`}
          style={percentage !== null ? { width: `${percentage}%` } : undefined}
        />
      </div>
      {hasProgress && srtProgress.totalMs > 0 && (
        <div className="srt-progress-duration">
          <span>{formatDuration(srtProgress.processedMs)}</span>
          <span className="duration-separator">/</span>
          <span>{formatDuration(srtProgress.totalMs)}</span>
        </div>
      )}
    </div>
  );
};

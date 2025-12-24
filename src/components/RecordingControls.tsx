import React, { useEffect, useState } from 'react';
import { useRecording } from '../hooks/useRecording';
import { formatDuration } from '../lib/utils';

export const RecordingControls: React.FC = () => {
  const { isRecording, isTranscribing, startTime, cancelRecord } = useRecording();
  const [duration, setDuration] = useState('00:00');
  
  useEffect(() => {
    if (!isRecording || isTranscribing) {
      setDuration('00:00');
      return;
    }
    
    const updateDuration = () => {
      setDuration(formatDuration(Date.now() - startTime));
    };
    
    updateDuration();
    const interval = setInterval(updateDuration, 500);
    
    return () => clearInterval(interval);
  }, [isRecording, isTranscribing, startTime]);
  
  return (
    <>
      <div id="rec-status" className={`status-label ${isRecording || isTranscribing ? 'visible' : ''}`}>
        {isTranscribing ? (
          <span className="processing-text">Processing...</span>
        ) : isRecording ? (
          duration
        ) : (
          '00:00'
        )}
      </div>
      
      <div id="recording-controls" style={{ display: (isRecording && !isTranscribing) || isTranscribing ? 'flex' : 'none', marginTop: '16px' }}>
        <button
          className="btn-text-only"
          id="cancel-btn"
          onClick={(e) => {
            e.stopPropagation();
            cancelRecord();
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
};

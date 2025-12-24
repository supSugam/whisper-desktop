import React from 'react';
import { useRecording } from '../hooks/useRecording';
import { ICONS } from '../ui/icons';

export const RecordButton: React.FC = () => {
  const { isRecording, isTranscribing, toggleRecord } = useRecording();
  
  const getClassName = () => {
    let className = 'mic-button';
    if (isRecording) className += ' recording';
    if (isTranscribing) className += ' processing';
    return className;
  };
  
  const getIcon = () => {
    if (isRecording) return ICONS.stop;
    return ICONS.mic;
  };
  
  return (
    <button
      id="record-btn"
      className={getClassName()}
      onClick={toggleRecord}
      dangerouslySetInnerHTML={{ __html: getIcon() }}
    />
  );
};

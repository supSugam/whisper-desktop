import React, { useState } from 'react';
import { useRecording } from '../hooks/useRecording';
import { ICONS } from '../ui/icons';
import { open } from '@tauri-apps/plugin-dialog';

interface SelectedFile {
  name: string;
  path: string;
  size: string;
  type: string;
}

export const FileDropArea: React.FC = () => {
  const { transcribeFile, isTranscribing, isRecording } = useRecording();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const videoExts = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'];
    const audioExts = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'aac', 'wma'];
    if (videoExts.includes(ext)) return 'Video';
    if (audioExts.includes(ext)) return 'Audio';
    return ext.toUpperCase();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    // Tauri drag-and-drop provides paths in dataTransfer
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Try to get full path from Tauri's extended File object
      const filePath = (file as any).path;
      if (filePath) {
        setSelectedFile({
          name: file.name,
          path: filePath,
          size: formatFileSize(file.size),
          type: getFileType(file.name)
        });
      } else {
        // If no path available, prompt user to use file picker
        handleAreaClick();
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAreaClick = async () => {
    if (selectedFile) return;
    
    try {
      const result = await open({
        multiple: false,
        filters: [{
          name: 'Media Files',
          extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'mp3', 'wav', 'm4a', 'flac', 'ogg', 'opus', 'aac', 'wma']
        }]
      });

      if (result) {
        const filePath = typeof result === 'string' ? result : result;
        const filename = filePath.split(/[\/\\]/).pop() || 'unknown';
        setSelectedFile({
          name: filename,
          path: filePath,
          size: 'N/A', // File dialog doesn't provide size
          type: getFileType(filename)
        });
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  const handleTranscribe = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedFile) {
      transcribeFile(selectedFile.path);
      setSelectedFile(null);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  const isDisabled = isRecording || isTranscribing;

  return (
    <div 
      className={`file-drop-area ${isDragOver ? 'dragging' : ''} ${isDisabled ? 'disabled' : ''} ${selectedFile ? 'has-file' : ''}`}
      onDragOver={!isDisabled ? handleDragOver : undefined}
      onDragLeave={!isDisabled ? handleDragLeave : undefined}
      onDrop={!isDisabled ? handleDrop : undefined}
      onClick={!isDisabled ? handleAreaClick : undefined}
    >
      {!selectedFile ? (
        <>
          <div className="drop-icon" dangerouslySetInnerHTML={{ __html: ICONS.upload }} />
          <div className="drop-text">
            <span className="drop-primary">Click to browse&nbsp;</span>
            <span className="drop-secondary">or drag and drop files here</span>
          </div>
          <div className="drop-formats">MP4, MKV, MP3, WAV, M4A, FLAC, OGG</div>
        </>
      ) : (
        <div className="selected-file-preview">
          <div className="file-info">
            <span className="file-type-badge">{selectedFile.type}</span>
            <span className="selected-file-name">{selectedFile.name}</span>
          </div>
          <div className="file-actions">
            <button className="transcribe-hint" onClick={handleTranscribe} disabled={isDisabled}>
              Transcribe
            </button>
            <button className="clear-file-btn" onClick={handleClear} disabled={isDisabled}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

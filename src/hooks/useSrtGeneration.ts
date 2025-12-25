import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useToastStore } from '../stores/useToastStore';
import { useSrtConfigStore } from '../stores/useSrtConfigStore';
import { documentDir, join } from '@tauri-apps/api/path';

interface SrtProgressPayload {
  percentage: number;
  processed_ms: number;
  total_ms: number;
  status: string;
}

export const useSrtGeneration = () => {
  const { isGeneratingSrt, srtProgress, setGeneratingSrt, setSrtProgress } =
    useRecordingStore();
  const { isTranscribing, isRecording } = useRecordingStore();
  const { config } = useConfigStore();
  const { duplicateHandling } = useSrtConfigStore();
  const { addItem } = useHistoryStore();
  const showToast = useToastStore((state) => state.show);

  // Listen for SRT progress events
  useEffect(() => {
    const unlisten = listen<SrtProgressPayload>('srt-progress', (event) => {
      setSrtProgress({
        percentage: event.payload.percentage,
        processedMs: event.payload.processed_ms,
        totalMs: event.payload.total_ms,
        status: event.payload.status,
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setSrtProgress]);

  const generateSrt = useCallback(
    async (audioPath: string, customOutputPath?: string) => {
      if (isGeneratingSrt || isTranscribing || isRecording) {
        showToast('Busy with another task');
        return;
      }

      if (config.transcriptionEngine !== 'local') {
        showToast('SRT generation requires local Whisper');
        return;
      }

      setGeneratingSrt(true);
      setSrtProgress({
        percentage: 0,
        processedMs: 0,
        totalMs: 0,
        status: 'starting',
      });

      try {
        // Determine output path
        let outputPath = customOutputPath;
        if (!outputPath) {
          const docsDir = await documentDir();
          const outputDir = await join(docsDir, 'WhisperOutputs');
          const filename =
            audioPath
              .split('/')
              .pop()
              ?.replace(/\.[^/.]+$/, '') || 'transcription';
          outputPath = await join(outputDir, `${filename}.srt`);
        }

        const result = await invoke<string>('generate_srt', {
          audioPath,
          model: config.localModel || 'Tiny',
          outputPath,
          translate: config.localTranslate || false,
          useGpu: config.useLocalGPU || false,
          duplicateMode: duplicateHandling || 'rename',
        });

        // Add to history
        const srtFilename = result.split('/').pop() || 'transcription.srt';
        await addItem({
          timestamp: Date.now(),
          text: srtFilename,
          duration: srtProgress?.totalMs || 0,
          backend: 'SRT',
          processingTime: 0,
          isSrt: true,
          srtPath: result,
        });

        showToast('SRT file generated!');
      } catch (err: any) {
        console.error('SRT Generation Error', err);
        showToast(`SRT Error: ${String(err)}`);
      } finally {
        setGeneratingSrt(false);
        setSrtProgress(null);
      }
    },
    [
      isGeneratingSrt,
      isTranscribing,
      isRecording,
      config,
      duplicateHandling,
      srtProgress,
      setGeneratingSrt,
      setSrtProgress,
      addItem,
      showToast,
    ]
  );

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    isGeneratingSrt,
    srtProgress,
    generateSrt,
    formatDuration,
  };
};

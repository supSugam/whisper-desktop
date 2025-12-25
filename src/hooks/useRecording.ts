import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { documentDir, join, dirname } from '@tauri-apps/api/path';
import { recordingController } from '../lib/recordingController';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import { useSrtConfigStore } from '../stores/useSrtConfigStore';

interface ProgressPayload {
  percentage: number;
  processed_ms: number;
  total_ms: number;
  status: string;
}

// Helper to build SRT output path based on config
async function buildSrtOutputPath(
  inputFilePath: string,
  srtConfig: {
    outputPath: 'default' | 'sameas';
    filenameMode: 'same' | 'custom';
    customFilename: string;
  }
): Promise<string> {
  // Get the input filename without extension
  const inputFilename =
    inputFilePath
      .split('/')
      .pop()
      ?.replace(/\.[^/.]+$/, '') || 'transcription';

  // Determine output filename
  const outputFilename =
    srtConfig.filenameMode === 'custom' && srtConfig.customFilename
      ? srtConfig.customFilename
      : inputFilename;

  // Determine output directory
  let outputDir: string;
  if (srtConfig.outputPath === 'sameas') {
    // Save in same directory as input file
    outputDir = await dirname(inputFilePath);
    console.log('[SRT] Using same directory as input:', outputDir);
  } else {
    // Save in default WhisperOutputs directory
    const docsDir = await documentDir();
    outputDir = await join(docsDir, 'WhisperOutputs');
    console.log('[SRT] Using default directory:', outputDir);
  }

  const outputPath = await join(outputDir, `${outputFilename}.srt`);
  console.log('[SRT] Final output path:', outputPath);

  return outputPath;
}

export const useRecording = () => {
  const store = useRecordingStore();
  const { config } = useConfigStore();
  const showToast = useToastStore((state) => state.show);

  // Progress tracking
  useEffect(() => {
    const unlisten = listen<ProgressPayload>('transcribe-progress', () => {
      // Progress handled elsewhere
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // transcribeFile function for file imports
  const transcribeFile = useCallback(
    async (filePath: string) => {
      if (store.isTranscribing || store.isRecording) {
        showToast('Busy recording or processing');
        return;
      }

      // Get SRT config state
      const srtConfig = useSrtConfigStore.getState();
      const useSrt =
        srtConfig.enabled && config.transcriptionEngine === 'local';

      console.log('[transcribeFile] File path:', filePath);
      console.log('[transcribeFile] SRT config:', {
        enabled: srtConfig.enabled,
        outputPath: srtConfig.outputPath,
        filenameMode: srtConfig.filenameMode,
        customFilename: srtConfig.customFilename,
        duplicateHandling: srtConfig.duplicateHandling,
      });
      console.log('[transcribeFile] Using SRT:', useSrt);

      useRecordingStore.setState({
        isTranscribing: true,
        isGeneratingSrt: useSrt,
      });

      const id = Date.now();
      const tStart = Date.now();
      const addItem = useHistoryStore.getState().addItem;

      try {
        let text = '';
        let backendInfo = '';

        // Check if SRT output is enabled (only works with local engine)
        if (useSrt) {
          console.log('[transcribeFile] Using SRT generation mode');
          const useGpu = config.useLocalGPU || false;
          backendInfo = useGpu ? 'SRT (GPU)' : 'SRT (CPU)';

          // Build output path using ALL config options
          const outputPath = await buildSrtOutputPath(filePath, srtConfig);

          const result = await invoke<string>('generate_srt', {
            audioPath: filePath,
            model: config.localModel || 'Tiny',
            outputPath,
            translate: config.localTranslate || false,
            useGpu,
            duplicateMode: srtConfig.duplicateHandling || 'rename',
          });

          console.log('[transcribeFile] SRT generated:', result);
          text = `SRT saved: ${result.split('/').pop()}`;
          const processingTime = Date.now() - tStart;

          // Add to history as SRT
          await addItem({
            timestamp: id,
            text: result.split('/').pop() || 'transcription.srt',
            duration: 0,
            error: false,
            backend: backendInfo,
            processingTime,
            isSrt: true,
            srtPath: result,
          });

          showToast('SRT file generated!');
        } else if (config.transcriptionEngine === 'local') {
          // Normal local transcription
          const useGpu = config.useLocalGPU || false;
          backendInfo = useGpu ? 'Local (GPU)' : 'Local (CPU)';

          text = await invoke<string>('transcribe_local', {
            path: filePath,
            model: config.localModel || 'Tiny',
            useGpu,
            translate: config.localTranslate || false,
          });

          const processingTime = Date.now() - tStart;

          await addItem({
            timestamp: id,
            text: text || '',
            duration: 0,
            error: false,
            backend: backendInfo,
            processingTime,
          });
        } else {
          // Cloud transcription
          if (!config.token)
            throw new Error('Please set your ChatGPT token in settings.');

          backendInfo = 'Cloud (ChatGPT)';
          text = await invoke<string>('transcribe', {
            path: filePath,
            token: config.token,
            userAgent: config.userAgent,
          });

          const processingTime = Date.now() - tStart;

          await addItem({
            timestamp: id,
            text: text || '',
            duration: 0,
            error: false,
            backend: backendInfo,
            processingTime,
          });
        }
      } catch (err: unknown) {
        console.error('Transcribe file error:', err);
        const addItem = useHistoryStore.getState().addItem;
        await addItem({
          timestamp: id,
          text: String(err),
          duration: 0,
          error: true,
        });
      } finally {
        useRecordingStore.setState({
          isTranscribing: false,
          isGeneratingSrt: false,
        });
      }
    },
    [config, showToast, store.isTranscribing, store.isRecording]
  );

  return {
    isRecording: store.isRecording,
    isTranscribing: store.isTranscribing,
    startTime: store.startTime,
    toggleRecord: useCallback(() => recordingController.toggleRecord(), []),
    startRecord: useCallback(() => recordingController.startRecord(), []),
    stopRecord: useCallback(() => recordingController.stopRecord(), []),
    cancelRecord: useCallback(() => recordingController.cancelRecord(), []),
    transcribeFile,
  };
};

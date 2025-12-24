import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { documentDir, join } from '@tauri-apps/api/path';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import { useSrtConfigStore } from '../stores/useSrtConfigStore';
import { audioController } from '../lib/audio';

interface ProgressPayload {
  percentage: number;
  processed_ms: number;
  total_ms: number;
  status: string;
}

export const useRecording = () => {
  const {
    isRecording,
    isTranscribing,
    isCancelled,
    startTime,
    recordTimer,
    setRecording,
    setTranscribing,
    setCancelled,
    setStartTime,
    setRecordTimer,
  } = useRecordingStore();
  
  const { config } = useConfigStore();
  const { addItem } = useHistoryStore();
  const showToast = useToastStore(state => state.show);
  const srtConfig = useSrtConfigStore();
  
  // Progress state management
  const progressRef = useRef<{ percentage: number; status: string }>({ percentage: 0, status: '' });
  
  // Listen for progress events
  useEffect(() => {
    const unlisten = listen<ProgressPayload>('transcribe-progress', (event) => {
      progressRef.current = {
        percentage: event.payload.percentage,
        status: event.payload.status,
      };
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);
  
  const startRecord = useCallback(async () => {
    if (isRecording) return;
    
    if (isTranscribing) {
      showToast('Wait for previous task to finish');
      return;
    }
    
    if (!config.token && config.transcriptionEngine !== 'local') {
      alert('Please set your ChatGPT token in settings first.');
      return;
    }
    
    try {
      await invoke('start_recording');
      setRecording(true);
      setStartTime(Date.now());
      if (config.soundEnabled) audioController.playStart();
      
      // Start timer
      const timer = setInterval(() => {
        // Timer updates handled by component
      }, 500);
      setRecordTimer(timer);
    } catch (e) {
      console.error('Start Error', e);
      showToast('Error starting recording');
    }
  }, [isRecording, isTranscribing, config, setRecording, setStartTime, setRecordTimer, showToast]);
  
  const stopRecord = useCallback(async () => {
    if (!isRecording) return;
    
    setRecording(false);
    setCancelled(false);
    if (config.soundEnabled) audioController.playEnd();
    if (recordTimer) clearInterval(recordTimer);
    
    setTranscribing(true);
    
    const duration = Date.now() - startTime;
    
    try {
      const path = await invoke<string>('stop_recording');
      
      if (duration < 500) {
        showToast('Too short, discarded');
        setTranscribing(false);
        return;
      }
      
      const id = Date.now();
      
      try {
        let text = '';
        const tStart = Date.now();
        let backendInfo = '';
        
        if (config.transcriptionEngine === 'local') {
          const useGpu = config.useLocalGPU || false;
          backendInfo = useGpu ? 'Local (GPU)' : 'Local (CPU)';
          
          text = await invoke<string>('transcribe_local', {
            path,
            model: config.localModel || 'Tiny',
            useGpu,
            translate: config.localTranslate || false,
          });
        } else {
          if (!config.token) throw new Error('Please set your ChatGPT token in settings.');
          
          backendInfo = 'Cloud (ChatGPT)';
          text = await invoke<string>('transcribe', {
            path,
            token: config.token,
            userAgent: config.userAgent,
          });
        }
        
        const processingTime = Date.now() - tStart;
        
        // Check if cancelled
        if (isCancelled) {
          setCancelled(false);
          return;
        }
        
        if (!text || text.trim().length === 0) {
          await addItem({
            timestamp: id,
            text: '',
            duration,
            error: false,
            backend: backendInfo,
            processingTime,
          });
        } else {
          await addItem({
            timestamp: id,
            text,
            duration,
            backend: backendInfo,
            processingTime,
          });
          
          // Auto Copy
          if (config.autoCopy) {
            await writeText(text);
            
            // Auto-paste if enabled
            if (config.autoPaste) {
              // Wait for clipboard to be ready (X11 needs more time)
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Attempt paste with retry
              let pasted = false;
              for (let i = 0; i < 3 && !pasted; i++) {
                try {
                  await invoke('paste_text');
                  pasted = true;
                  showToast('Pasted');
                } catch (e) {
                  console.log(`Paste attempt ${i + 1} failed:`, e);
                  if (i < 2) await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
              
              if (!pasted) {
                showToast('Copied (paste failed)');
                console.error('Auto-paste failed after 3 attempts');
              }
            }
            
            // Send notification if enabled
            if (config.notificationEnabled) {
              try {
                await invoke('send_notification', {
                  title: 'Whisper+',
                  body: config.autoPaste
                    ? 'Transcription pasted!'
                    : 'Transcription copied to clipboard. Press Ctrl+V to paste.',
                });
              } catch (notifErr) {
                console.error('Notification error:', notifErr);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Transcribe Error', err);
        await addItem({
          timestamp: id,
          text: String(err),
          duration,
          error: true,
        });
      }
    } catch (e: any) {
      if (String(e).includes('SILENCE_DETECTED')) {
        showToast('Skipped: Silence Detected');
      } else {
        console.error('Stop/Transcribe Error', e);
        showToast('Error processing audio');
      }
    } finally {
      setTranscribing(false);
    }
  }, [isRecording, config, recordTimer, startTime, isCancelled, setRecording, setCancelled, setTranscribing, addItem, showToast]);
  
  const cancelRecord = useCallback(async () => {
    if (isTranscribing) {
      setCancelled(true);
      setTranscribing(false);
      showToast('Cancelled');
      return;
    }
    
    if (isRecording && config.soundEnabled) audioController.playEnd();
    setRecording(false);
    if (recordTimer) clearInterval(recordTimer);
    invoke('stop_recording').catch(console.error);
  }, [isTranscribing, isRecording, config, recordTimer, setCancelled, setTranscribing, setRecording, showToast]);
  
  const toggleRecord = useCallback(async () => {
    if (isRecording) await stopRecord();
    else await startRecord();
  }, [isRecording, startRecord, stopRecord]);

  const transcribeFile = useCallback(async (filePath: string) => {
    if (isTranscribing || isRecording) {
      showToast('Busy recording or processing');
      return;
    }

    setTranscribing(true);
    const id = Date.now();
    const tStart = Date.now();

    try {
      let text = '';
      let backendInfo = '';

      if (config.transcriptionEngine === 'local') {
        const useGpu = config.useLocalGPU || false;
        backendInfo = useGpu ? 'Local (GPU)' : 'Local (CPU)';

        text = await invoke<string>('transcribe_local', {
          path: filePath,
          model: config.localModel || 'Tiny',
          useGpu,
          translate: config.localTranslate || false,
        });
        
        // Generate SRT if enabled
        if (srtConfig.enabled && text && text.trim().length > 0) {
          console.log('SRT generation enabled, starting...');
          try {
            let outputPath = '';
            const filename = filePath.split(/[\/\\]/).pop()?.replace(/\.[^/.]+$/, '') || 'transcription';
            
            if (srtConfig.outputPath === 'default') {
              const docsDir = await documentDir();
              const outputDir = await join(docsDir, 'WhisperOutputs');
              const srtFilename = srtConfig.filenameMode === 'custom' ? srtConfig.customFilename : filename;
              outputPath = await join(outputDir, `${srtFilename}.srt`);
            } else {
              // Same directory as source file
              const dir = filePath.substring(0, filePath.lastIndexOf('/'));
              const srtFilename = srtConfig.filenameMode === 'custom' ? srtConfig.customFilename : filename;
              outputPath = await join(dir, `${srtFilename}.srt`);
            }
            
            console.log('SRT output path:', outputPath);
            console.log('Calling generate_srt with:', { audioPath: filePath, model: config.localModel, outputPath });
            
            const srtPath = await invoke<string>('generate_srt', {
              audioPath: filePath,
              model: config.localModel || 'Tiny',
              outputPath,
              translate: config.localTranslate || false,
              useGpu: config.useLocalGPU || false,
            });
            
            console.log('SRT generated successfully:', srtPath);
            
            // Add SRT to history with full path displayed
            await addItem({
              timestamp: Date.now(),
              text: srtPath, // Show full path
              duration: 0,
              backend: 'SRT',
              isSrt: true,
              srtPath,
            });
            
            showToast('SRT file generated!');
          } catch (srtErr: any) {
            console.error('SRT generation failed:', srtErr);
            showToast(`SRT failed: ${String(srtErr).substring(0, 50)}`);
          }
        } else if (srtConfig.enabled) {
          console.log('SRT enabled but no text to generate from');
        }
      } else {
        if (!config.token) throw new Error('Set ChatGPT token in settings.');
        backendInfo = 'Cloud (ChatGPT)';
        text = await invoke<string>('transcribe', {
          path: filePath,
          token: config.token,
          userAgent: config.userAgent,
        });
      }

      const processingTime = Date.now() - tStart;

      if (isCancelled) {
        setCancelled(false);
        return;
      }

      if (text && text.trim().length > 0) {
        await addItem({
          timestamp: id,
          text,
          duration: 0,
          backend: backendInfo,
          processingTime,
        });

        // Auto copy/paste logic
        if (config.autoCopy) {
          await writeText(text);
          if (config.autoPaste) {
            await new Promise(resolve => setTimeout(resolve, 300));
              let pasted = false;
              for (let i = 0; i < 3 && !pasted; i++) {
                try {
                  await invoke('paste_text');
                  pasted = true;
                  showToast('Pasted');
                } catch (e) {
                  if (i < 2) await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
              if (!pasted) showToast('Copied (paste failed)');
          } else {
              showToast('Copied to clipboard');
          }
        } else {
            showToast('Transcription Complete');
        }
      }
    } catch (err: any) {
      console.error('File Transcription Error', err);
      showToast('Error processing file');
      await addItem({
        timestamp: id,
        text: String(err),
        duration: 0,
        error: true,
      });
    } finally {
      setTranscribing(false);
    }
  }, [isTranscribing, isRecording, config, srtConfig, setTranscribing, isCancelled, setCancelled, addItem, showToast]);

  return {
    isRecording,
    isTranscribing,
    startTime,
    startRecord,
    stopRecord,
    cancelRecord,
    toggleRecord,
    transcribeFile,
  };
};

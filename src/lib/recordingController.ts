// Module-level recording controller - stable references for shortcuts
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { documentDir, join } from '@tauri-apps/api/path';
import { audioController } from './audio';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import { useConfigStore } from '../stores/useConfigStore';
import { useSrtConfigStore } from '../stores/useSrtConfigStore';

// State
let _isRecording = false;
let _isTranscribing = false;
let _isCancelled = false;
let _startTime = 0;
let _recordTimer: ReturnType<typeof setInterval> | null = null;

// Helper to get fresh state from stores
const getConfig = () => useConfigStore.getState().config;
const getSrtConfig = () => useSrtConfigStore.getState();
const getShowToast = () => useToastStore.getState().show;
const getAddItem = () => useHistoryStore.getState().addItem;

// Update React state
const updateReactState = () => {
  useRecordingStore.setState({
    isRecording: _isRecording,
    isTranscribing: _isTranscribing,
    startTime: _startTime,
  });
};

export const recordingController = {
  // Getters
  get isRecording() { return _isRecording; },
  get isTranscribing() { return _isTranscribing; },
  get isCancelled() { return _isCancelled; },
  get startTime() { return _startTime; },

  async startRecord() {
    if (_isRecording) return;
    
    const config = getConfig();
    const showToast = getShowToast();
    
    if (_isTranscribing) {
      showToast('Wait for previous task to finish');
      return;
    }
    
    if (!config.token && config.transcriptionEngine !== 'local') {
      alert('Please set your ChatGPT token in settings first.');
      return;
    }
    
    try {
      console.log('[RecordingController] Starting recording...');
      await invoke('start_recording');
      _isRecording = true;
      _startTime = Date.now();
      if (config.soundEnabled) audioController.playStart();
      
      if (_recordTimer) clearInterval(_recordTimer);
      _recordTimer = setInterval(() => {
        updateReactState();
      }, 500);
      
      updateReactState();
      console.log('[RecordingController] Recording started');
    } catch (e) {
      console.error('[RecordingController] Start Error', e);
      showToast('Error starting recording');
    }
  },

  async stopRecord() {
    if (!_isRecording) return;
    
    const config = getConfig();
    const srtConfig = getSrtConfig();
    const showToast = getShowToast();
    const addItem = getAddItem();
    
    console.log('[RecordingController] Stopping recording...');
    console.log('[RecordingController] SRT enabled:', srtConfig.enabled);
    
    _isRecording = false;
    _isCancelled = false;
    if (config.soundEnabled) audioController.playEnd();
    if (_recordTimer) clearInterval(_recordTimer);
    
    _isTranscribing = true;
    
    // Also set isGeneratingSrt if SRT mode
    if (srtConfig.enabled && config.transcriptionEngine === 'local') {
      useRecordingStore.setState({ isGeneratingSrt: true });
    }
    
    updateReactState();
    
    const duration = Date.now() - _startTime;
    
    try {
      const path = await invoke<string>('stop_recording');
      
      if (duration < 500) {
        showToast('Too short, discarded');
        _isTranscribing = false;
        useRecordingStore.setState({ isGeneratingSrt: false });
        updateReactState();
        return;
      }
      
      const id = Date.now();
      
      try {
        let text = '';
        const tStart = Date.now();
        let backendInfo = '';
        
        // Check if SRT output is enabled (only works with local engine)
        if (srtConfig.enabled && config.transcriptionEngine === 'local') {
          console.log('[RecordingController] Using SRT generation mode');
          console.log('[RecordingController] SRT config:', {
            outputPath: srtConfig.outputPath,
            filenameMode: srtConfig.filenameMode,
            customFilename: srtConfig.customFilename,
            duplicateHandling: srtConfig.duplicateHandling,
          });
          
          const useGpu = config.useLocalGPU || false;
          backendInfo = useGpu ? 'SRT (GPU)' : 'SRT (CPU)';
          
          // Build output path - for recordings, we always use default dir (no source file path)
          const docsDir = await documentDir();
          const outputDir = await join(docsDir, 'WhisperOutputs');
          
          // Use custom filename if set, otherwise use timestamp
          let filename: string;
          if (srtConfig.filenameMode === 'custom' && srtConfig.customFilename) {
            filename = srtConfig.customFilename;
          } else {
            filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || `recording_${Date.now()}`;
          }
          
          const outputPath = await join(outputDir, `${filename}.srt`);
          console.log('[RecordingController] SRT output path:', outputPath);
          
          const result = await invoke<string>('generate_srt', {
            audioPath: path,
            model: config.localModel || 'Tiny',
            outputPath,
            translate: config.localTranslate || false,
            useGpu,
            duplicateMode: srtConfig.duplicateHandling || 'rename',
          });
          
          text = `SRT saved: ${result.split('/').pop()}`;
          
          // Add to history as SRT
          const processingTime = Date.now() - tStart;
          addItem({
            timestamp: id,
            text: result.split('/').pop() || 'transcription.srt',
            duration,
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
            path,
            model: config.localModel || 'Tiny',
            useGpu,
            translate: config.localTranslate || false,
          });
          
          const processingTime = Date.now() - tStart;
          
          if (_isCancelled) {
            _isCancelled = false;
            return;
          }
          
          addItem({
            timestamp: id,
            text: text || '',
            duration,
            error: false,
            backend: backendInfo,
            processingTime,
          });
          
          if (text && config.autoCopy) {
            await writeText(text);
            
            if (config.autoPaste) {
              setTimeout(() => invoke('paste_text'), 100);
              showToast('Pasted');
            }
            
            if (config.notificationEnabled) {
              try {
                await invoke('send_notification', {
                  title: 'Whisper+',
                  body: config.autoPaste
                    ? 'Transcription pasted!'
                    : 'Transcription copied to clipboard. Press Ctrl+V to paste.',
                });
              } catch (e) {
                console.error('Notification error:', e);
              }
            }
          }
        } else {
          // Cloud transcription
          if (!config.token) throw new Error('Please set your ChatGPT token in settings.');
          
          backendInfo = 'Cloud (ChatGPT)';
          text = await invoke<string>('transcribe', {
            path,
            token: config.token,
            userAgent: config.userAgent,
          });
          
          const processingTime = Date.now() - tStart;
          
          if (_isCancelled) {
            _isCancelled = false;
            return;
          }
          
          addItem({
            timestamp: id,
            text: text || '',
            duration,
            error: false,
            backend: backendInfo,
            processingTime,
          });
          
          if (text && config.autoCopy) {
            await writeText(text);
            
            if (config.autoPaste) {
              setTimeout(() => invoke('paste_text'), 100);
              showToast('Pasted');
            }
          }
        }
      } catch (err: unknown) {
        console.error('[RecordingController] Transcribe Error', err);
        addItem({
          timestamp: id,
          text: String(err),
          duration,
          error: true,
        });
      }
    } catch (e: unknown) {
      if (String(e).includes('SILENCE_DETECTED')) {
        showToast('Skipped: Silence Detected');
      } else {
        console.error('[RecordingController] Stop Error', e);
        showToast('Error processing audio');
      }
    } finally {
      _isTranscribing = false;
      useRecordingStore.setState({ isGeneratingSrt: false });
      updateReactState();
    }
  },

  async toggleRecord() {
    console.log('[RecordingController] Toggle, isRecording:', _isRecording);
    if (_isRecording) {
      await this.stopRecord();
    } else {
      await this.startRecord();
    }
  },

  async cancelRecord() {
    const config = getConfig();
    const showToast = getShowToast();
    
    if (_isTranscribing) {
      try {
        await invoke('cancel_transcription');
      } catch (e) {
        console.error('Failed to cancel:', e);
      }
      _isCancelled = true;
      _isTranscribing = false;
      useRecordingStore.setState({ isGeneratingSrt: false });
      showToast('Cancelled');
      updateReactState();
      return;
    }
    
    if (_isRecording && config.soundEnabled) audioController.playEnd();
    _isRecording = false;
    if (_recordTimer) clearInterval(_recordTimer);
    updateReactState();
    invoke('stop_recording').catch(console.error);
  },
};

// Stable function references for shortcut manager
export const toggleRecord = () => recordingController.toggleRecord();
export const startRecord = () => recordingController.startRecord();
export const stopRecord = () => recordingController.stopRecord();

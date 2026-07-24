import React, { useContext, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ViewContext } from '../App';
import { useRecording } from '../hooks/useRecording';
import { useConfigStore } from '../stores/useConfigStore';
import { useRecordingStore } from '../stores/useRecordingStore';
import { useToastStore } from '../stores/useToastStore';
import { formatDuration } from '../lib/utils';
import { toggleRecord } from '../lib/recordingController';
import { AudioVisualizer } from './AudioVisualizer';
import { Flex, IconButton, Text, Box, Button } from '@radix-ui/themes';
import { Mic, Square, History, Settings, Loader2 } from 'lucide-react';

export const MainView: React.FC = () => {
  const { view, setView } = useContext(ViewContext);
  const { isRecording, isTranscribing, startTime, cancelRecord } = useRecording();
  const config = useConfigStore((state) => state.config);
  
  const resultMessage = useRecordingStore((state) => state.resultMessage);
  const setResultMessage = useRecordingStore((state) => state.setResultMessage);
  const showToast = useToastStore((state) => state.show);
  
  const prevTranscribingRef = useRef(isTranscribing);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: number;
    if (isRecording && startTime) {
      interval = window.setInterval(() => {
        setDuration(Date.now() - startTime);
      }, 100);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [isRecording, startTime]);

  useEffect(() => {
    if (prevTranscribingRef.current && !isTranscribing && !isRecording) {
      let msg = resultMessage;
      if (!msg) {
        if (config.autoPaste) {
          msg = 'Pasted!';
        } else if (config.autoCopy) {
          msg = 'Copied to clipboard';
        } else {
          msg = 'Transcription complete';
        }
      }
      
      showToast(msg);
      setResultMessage(null);
    }
    prevTranscribingRef.current = isTranscribing;
  }, [isTranscribing, isRecording, config.autoPaste, config.autoCopy, setResultMessage, resultMessage, showToast]);

  const processingBlinkRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isTranscribing) {
      let isBlack = true;
      processingBlinkRef.current = window.setInterval(() => {
        invoke('set_tray_icon', { variant: isBlack ? 'black' : 'default' }).catch(() => {});
        isBlack = !isBlack;
      }, 500);
    } else {
      if (processingBlinkRef.current !== null) {
        window.clearInterval(processingBlinkRef.current);
        processingBlinkRef.current = null;
        invoke('set_tray_icon', { variant: 'default' }).catch(() => {});
      }
    }
    return () => {
      if (processingBlinkRef.current !== null) {
        window.clearInterval(processingBlinkRef.current);
        invoke('set_tray_icon', { variant: 'default' }).catch(() => {});
      }
    };
  }, [isTranscribing]);

  const getEngineText = () => {
    return `Local · ${config.localModel || 'Tiny'}`;
  };

  const getShortcutText = () => {
    if (config.globalShortcut && config.shortcutEnabled) {
      return config.globalShortcut;
    }
    return 'Click to record';
  };

  const handleRecordClick = () => {
    toggleRecord();
  };

  const handleCancelClick = () => {
    if (isRecording) {
      cancelRecord();
    }
  };

  return (
    <Flex direction="column" align="center" justify="center" height="100%" position="relative" px="4">
      {/* App Header */}
      <Flex position="absolute" align="center" gap="1" style={{ top: '24px', opacity: 0.8 }}>
        <img src="/src/assets/yappie.svg" alt="Yappie Logo" style={{ width: '28px', height: '28px' }} />
        <Text size="5" weight="bold" style={{ letterSpacing: '-0.02em' }}>Yappie</Text>
      </Flex>

      <Flex direction="column" align="center" justify="center" gap="5">
        
        {/* Record Button Container */}
        <Box 
          onClick={handleRecordClick}
          role="button"
          tabIndex={0}
          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          aria-pressed={isRecording}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleRecordClick();
            }
          }}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: isRecording 
              ? 'var(--ruby-9)' 
              : 'var(--gray-3)',
            border: '1px solid var(--gray-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: isRecording ? '0 0 0 4px var(--ruby-4)' : '0 2px 8px var(--black-a4)',
          }}
        >
          {isRecording ? (
            <Square size={24} color="white" fill="white" />
          ) : isTranscribing ? (
            <Loader2 size={24} color="var(--gray-11)" style={{ animation: 'spinSlow 1s linear infinite' }} />
          ) : (
            <Mic size={28} color="var(--gray-11)" />
          )}
        </Box>

        {/* State 1: Idle */}
        {!isRecording && !isTranscribing && (
          <Flex direction="column" align="center" gap="1">
            <Text size="2" weight="medium" color="gray">{getShortcutText()}</Text>
            <Text size="1" color="gray" style={{ opacity: 0.8 }}>{getEngineText()}</Text>
          </Flex>
        )}

        {/* State 2: Recording */}
        {isRecording && (
          <Flex direction="column" align="center" gap="3" aria-live="polite">
            <Text size="5" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={`Recording duration: ${formatDuration(duration)}`}>
              {formatDuration(duration)}
            </Text>
            <AudioVisualizer active={true} />
            <Button variant="ghost" color="gray" size="1" onClick={handleCancelClick} style={{ marginTop: '4px' }}>
              Cancel
            </Button>
          </Flex>
        )}

        {/* State 3: Transcribing */}
        {isTranscribing && (
          <Flex direction="column" align="center" gap="2" aria-live="polite">
            <Text size="2" weight="medium" color="gray" role="status">Processing...</Text>
            <Button variant="ghost" color="gray" size="1" onClick={handleCancelClick}>
              Cancel
            </Button>
          </Flex>
        )}
      </Flex>

      {/* Bottom Dock */}
      <Flex 
        position="absolute" 
        bottom="24px" 
        align="center"
        style={{
          background: 'var(--gray-2)',
          border: '1px solid var(--gray-5)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px var(--black-a3)'
        }}
      >
        {isRecording ? (
          <Flex align="center" gap="2" px="4" py="2">
            <Box style={{
              width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ruby-9)',
              boxShadow: '0 0 0 2px var(--ruby-4)',
              animation: 'pulse 1.5s infinite'
            }} />
            <Text size="1" weight="medium" color="ruby">Recording</Text>
          </Flex>
        ) : isTranscribing ? (
          <Flex align="center" gap="2" px="4" py="2">
            <Loader2 size={12} color="var(--gray-11)" style={{ animation: 'spinSlow 1s linear infinite' }} />
            <Text size="1" weight="medium" color="gray">Processing</Text>
          </Flex>
        ) : (
          <Flex align="center" style={{ width: '100%' }} role="group" aria-label="Navigation">
            <IconButton 
              variant={view === 'history' ? 'soft' : 'ghost'} 
              color="gray"
              onClick={() => setView('history')}
              title="History"
              aria-label="History"
              aria-current={view === 'history' ? 'page' : undefined}
              style={{ flex: 1, padding: '6px 12px', borderRadius: 0, margin: 0, cursor: 'pointer', height: 'auto' }}
            >
              <History size={17} aria-hidden="true" />
            </IconButton>
            <Box style={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'var(--gray-6)' }} role="separator" />
            <IconButton 
              variant={view === 'settings' ? 'soft' : 'ghost'} 
              color="gray"
              onClick={() => setView('settings')}
              title="Settings"
              aria-label="Settings"
              aria-current={view === 'settings' ? 'page' : undefined}
              style={{ flex: 1, padding: '6px 12px', borderRadius: 0, margin: 0, cursor: 'pointer', height: 'auto' }}
            >
              <Settings size={17} aria-hidden="true" />
            </IconButton>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};



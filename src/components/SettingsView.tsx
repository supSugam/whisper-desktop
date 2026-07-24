import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable } from '@tauri-apps/plugin-autostart';
import { useConfigStore } from '../stores/useConfigStore';
import { useToastStore } from '../stores/useToastStore';
import { ShortcutRecorder } from './ShortcutRecorder';
import { ModelManager } from './ModelManager';
import { DEFAULT_CONFIG } from '../types';
import { useView } from '../App';
import { Flex, Box, Text, Switch, SegmentedControl, IconButton, Button, Separator, ScrollArea, Code, AlertDialog } from '@radix-ui/themes';
import { ChevronLeft, Info, RotateCcw } from 'lucide-react';

// Reusable setting row: label on left, control on right
const SettingRow: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <Flex justify="between" align="center" py="2">
    <Box style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
      <Text as="div" size="2" weight="medium" style={{ color: '#d4d4d8' }}>{label}</Text>
      {hint && <Text as="div" size="1" style={{ color: '#71717a', marginTop: '2px' }}>{hint}</Text>}
    </Box>
    <Box style={{ flexShrink: 0 }}>
      {children}
    </Box>
  </Flex>
);

// Lightweight section header
const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <Text size="1" weight="medium" as="div" mt="3" mb="1" style={{ color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '11px' }}>
    {label}
  </Text>
);

export const SettingsView: React.FC = () => {
  const { setView } = useView();
  const { config, updateSetting } = useConfigStore();
  const showToast = useToastStore(state => state.show);

  const [sessionType, setSessionType] = useState<string>('x11');

  useEffect(() => {
    invoke<string>('get_session_type')
      .then(setSessionType)
      .catch(console.error);
  }, []);

  const isWayland = sessionType === 'wayland';

  const handleAutostartToggle = async (checked: boolean) => {
    try {
      if (checked) await enable();
      else await disable();
    } catch (err) {
      console.error('Autostart toggle error', err);
    }
  };

  const performReset = async () => {
    const keys: (keyof typeof DEFAULT_CONFIG)[] = [
      'autoCopy', 'autoPaste', 'soundEnabled',
      'notificationEnabled', 'shortcutEnabled', 'recordMode'
    ];

    for (const key of keys) {
      await updateSetting(key, DEFAULT_CONFIG[key]);
    }

    try { await disable(); } catch (e) { /* ignore */ }

    showToast('Settings Reset');
  };

  return (
    <Flex direction="column" height="100%" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <Flex align="center" gap="3" px="4" py="3" style={{ flexShrink: 0 }}>
        <IconButton variant="ghost" color="gray" onClick={() => setView('main')}>
          <ChevronLeft size={18} />
        </IconButton>
        <Text size="3" weight="medium" style={{ color: '#d4d4d8' }}>Settings</Text>
      </Flex>

      <ScrollArea type="scroll" scrollbars="vertical" style={{ flexGrow: 1, overflowX: 'hidden' }}>
        <Flex 
          direction="column" 
          px="4" 
          pb="5" 
          style={{ maxWidth: '800px', margin: '0 auto', width: '100%', outline: 'none' }} 
          tabIndex={0} 
          ref={(el) => {
            if (el) {
              // Only focus if active element is body to avoid stealing focus from actual inputs
              if (document.activeElement === document.body) {
                el.focus();
              }
            }
          }}
        >

          {/* ─── Shortcut ─── */}
          <SectionHeader label="Shortcut" />

          {/* Wayland Notice */}
          {isWayland && (
            <Box py="2" px="3" my="1" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <Flex gap="2" align="start">
                <Info size={14} color="#71717a" style={{ marginTop: '2px', flexShrink: 0 }} />
                <Box>
                  <Text as="div" size="2" weight="medium" style={{ color: '#a1a1aa' }}>Wayland Detected</Text>
                  <Text as="div" size="1" style={{ color: '#71717a', marginTop: '4px' }}>
                    Due to Wayland security, the shortcut below will <strong>only work when the app is in focus</strong>. For a true global shortcut, bind <Code variant="ghost" size="1">yappie --toggle</Code> in your System Settings.
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          <SettingRow label="Global Shortcut" hint={isWayland ? "Works only when focused on Wayland" : "Trigger recording from anywhere"}>
            <Switch 
              checked={config.shortcutEnabled} 
              onCheckedChange={(c) => updateSetting('shortcutEnabled', c)} 
            />
          </SettingRow>

          <ShortcutRecorder />

          <SettingRow 
            label="Activation Mode" 
            hint={isWayland ? 'Hold mode is not supported on Wayland due to key-release event restrictions.' : (config.recordMode === 'toggle' ? 'Press to start/stop' : 'Hold to record')}
          >
            <SegmentedControl.Root
              size="1"
              value={isWayland ? 'toggle' : config.recordMode}
              onValueChange={(value) => {
                if (!isWayland) updateSetting('recordMode', value as 'toggle' | 'hold');
              }}
            >
              <SegmentedControl.Item value="toggle">Toggle</SegmentedControl.Item>
              <SegmentedControl.Item value="hold" style={isWayland ? { opacity: 0.4, pointerEvents: 'none' } : {}}>Hold</SegmentedControl.Item>
            </SegmentedControl.Root>
          </SettingRow>

          <Separator size="4" my="2" />

          {/* ─── Behavior ─── */}
          <SectionHeader label="Behavior" />

          <SettingRow label="Auto-copy" hint="Copy text to clipboard">
            <Switch 
              checked={config.autoCopy} 
              onCheckedChange={(c) => updateSetting('autoCopy', c)} 
            />
          </SettingRow>

          <SettingRow label="Auto-paste" hint={isWayland ? 'Not available on Wayland' : 'Paste into active input'}>
            <Switch 
              checked={isWayland ? false : config.autoPaste} 
              onCheckedChange={(c) => updateSetting('autoPaste', c)} 
              disabled={isWayland}
            />
          </SettingRow>

          <SettingRow label="Sound effects">
            <Switch 
              checked={config.soundEnabled} 
              onCheckedChange={(c) => updateSetting('soundEnabled', c)} 
            />
          </SettingRow>

          <SettingRow label="Notifications">
            <Switch 
              checked={config.notificationEnabled} 
              onCheckedChange={(c) => updateSetting('notificationEnabled', c)} 
            />
          </SettingRow>

          <SettingRow label="Start at login">
            <Switch 
              checked={config.autostart} 
              onCheckedChange={handleAutostartToggle} 
            />
          </SettingRow>

          <Separator size="4" my="2" />

          {/* ─── Transcription ─── */}
          <SectionHeader label="Transcription" />

          <ModelManager />

          <SettingRow label="Translate to English" hint="Auto-translate non-English audio">
            <Switch 
              checked={config.localTranslate || false} 
              onCheckedChange={(c) => updateSetting('localTranslate', c)} 
            />
          </SettingRow>

          <Separator size="4" my="2" />

          {/* ─── Reset ─── */}
          <Box py="2">
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button 
                  color="gray" 
                  variant="ghost" 
                  style={{ width: '100%', opacity: 0.6 }}
                  size="2"
                >
                  <RotateCcw size={14} style={{ marginRight: 6 }} />
                  Reset Defaults
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="450px" style={{ backgroundColor: 'var(--color-panel-solid)', borderRadius: '12px' }}>
                <AlertDialog.Title>Reset Settings</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  Are you sure you want to reset all settings back to their default values?
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">
                      Cancel
                    </Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button variant="solid" color="red" onClick={performReset}>
                      Reset
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Box>

        </Flex>
      </ScrollArea>
    </Flex>
  );
};

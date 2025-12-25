import React, { useState } from 'react';
import { RecordButton } from './RecordButton';
import { RecordingControls } from './RecordingControls';
import { SettingsModal } from './SettingsModal';
import { ICONS } from '../ui/icons';
import { SearchBar } from './SearchBar';
import { HistoryList } from './HistoryList';
import { FileDropArea } from './FileDropArea';
import { DashboardCard } from './DashboardCard';
import { SrtPanel } from './SrtPanel';
import { TranscribeProgress } from './TranscribeProgress';
import { TranslateToggle } from './TranslateToggle';
import { useConfigStore } from '../stores/useConfigStore';
import { useRecordingStore } from '../stores/useRecordingStore';

export const MainLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { config } = useConfigStore();
  const { isRecording, isTranscribing } = useRecordingStore();

  const isCloudMode = config.transcriptionEngine === 'cloud';
  const isBusy = isRecording || isTranscribing;

  return (
    <div className="main-layout-grid">
      {/* Sidebar: Search & History */}
      <div className="sidebar">
        <div className="sidebar-header">
          <SearchBar />
        </div>
        <div className="sidebar-content">
          <HistoryList />
        </div>
      </div>

      {/* Main Content: Dashboard */}
      <div className="main-content">
        <header className="main-header">
          <div className="branding">
            <h1 className="app-title">Whisper+</h1>
          </div>
          <button
            className="icon-btn settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            dangerouslySetInnerHTML={{ __html: ICONS.settings }}
            disabled={isBusy}
          />
        </header>

        <main className="dashboard">
          {/* Audio Input Card - Combined Record & Import */}
          <DashboardCard
            title="Audio Input"
            icon={ICONS.mic}
            subtitle="Record or import audio/video files"
            fullWidth
          >
            <div className="audio-input-container">
              {/* Record Section */}
              <div className="audio-input-section record-section">
                <div className="section-label">Record</div>
                <div className="record-area">
                  <RecordButton />
                  <RecordingControls />
                </div>
              </div>

              {/* Divider */}
              <div className="audio-input-divider">
                <span>or</span>
              </div>

              {/* Import Section - Disabled when recording */}
              <div
                className={`audio-input-section import-section ${
                  isRecording ? 'section-disabled' : ''
                }`}
              >
                <div className="section-label">Import</div>
                <FileDropArea />
              </div>
            </div>

            {/* Translate Toggle - Only shows for local engine */}
            <TranslateToggle />

            {/* Progress Bar - integrated at bottom */}
            <TranscribeProgress />
          </DashboardCard>

          {/* SRT Generation Card - Disabled for Cloud Mode or when busy */}
          <DashboardCard
            title="Subtitle Generation"
            icon={ICONS.download}
            subtitle={
              isCloudMode
                ? 'Only available with local Whisper'
                : 'Generate SRT files from transcriptions'
            }
            fullWidth
            disabled={isCloudMode || isBusy}
          >
            <SrtPanel disabled={isCloudMode || isBusy} />
          </DashboardCard>
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

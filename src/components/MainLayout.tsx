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
import { useConfigStore } from '../stores/useConfigStore';

export const MainLayout: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { config } = useConfigStore();
  
  const isCloudMode = config.transcriptionEngine === 'cloud';

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

              {/* Import Section */}
              <div className="audio-input-section import-section">
                <div className="section-label">Import</div>
                <FileDropArea />
              </div>
            </div>
            
            {/* Progress Bar - integrated at bottom */}
            <TranscribeProgress />
          </DashboardCard>

          {/* SRT Generation Card - Disabled for Cloud Mode */}
          <DashboardCard 
            title="Subtitle Generation" 
            icon={ICONS.download}
            subtitle={isCloudMode ? "Only available with local Whisper" : "Generate SRT files from transcriptions"}
            fullWidth
            disabled={isCloudMode}
          >
            <SrtPanel disabled={isCloudMode} />
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

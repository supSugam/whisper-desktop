import React from 'react';
import { HistoryItem as HistoryItemType } from '../types';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { ICONS } from '../ui/icons';
import { timeAgo, formatDuration } from '../lib/utils';

interface HistoryItemProps {
  item: HistoryItemType;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ item }) => {
  const { removeItem } = useHistoryStore();
  const showToast = useToastStore(state => state.show);
  
  const handleCopy = async () => {
    try {
      if (item.isSrt && item.srtPath) {
        // For SRT, copy the file path
        await writeText(item.srtPath);
        showToast('Path copied');
      } else {
        await writeText(item.text);
        showToast('Copied');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenFile = async () => {
    if (item.srtPath) {
      try {
        await invoke('open_link', { url: item.srtPath });
      } catch (e) {
        console.error('Failed to open file:', e);
      }
    }
  };
  
  const handleDelete = async () => {
    await removeItem(item.timestamp);
  };
  
  const isError = !!item.error;
  const isEmpty = !item.text || item.text.trim().length === 0;
  const isSrt = !!item.isSrt;
  
  const ago = timeAgo(item.timestamp);
  const dur = item.duration ? formatDuration(item.duration) : '';
  
  let cardClass = 'history-item';
  if (isError) cardClass += ' error';
  if (isEmpty && !isSrt) cardClass += ' empty';
  if (isSrt) cardClass += ' srt-item';
  
  const leftElements: React.ReactNode[] = [<span key="ago">{ago}</span>];
  
  if (dur && !isSrt) {
    leftElements.push(<span key="dur" className="duration-chip">{dur}</span>);
  }
  if (!dur && isEmpty && !isSrt) {
    leftElements.push(<span key="silence" style={{ color: 'var(--warning-color)' }}>Silence</span>);
  }
  if (isError) {
    leftElements.splice(0, leftElements.length, 
      <span key="error" style={{ color: 'var(--danger-color)' }}>{ago} • Error</span>
    );
  }
  
  const processDur = item.processingTime ? `${(item.processingTime / 1000).toFixed(1)}s` : '';
  const backend = item.backend || '';
  
  const pills: React.ReactNode[] = [];
  
  // SRT badge
  if (isSrt) {
    pills.push(
      <span key="srt" className="info-pill pill-srt" title="Subtitle File">
        <span dangerouslySetInnerHTML={{ __html: ICONS.download }} /> SRT
      </span>
    );
  } else if (backend) {
    const isCloud = backend.includes('Cloud');
    const isGPU = backend.includes('GPU');
    const cls = isCloud ? 'pill-cloud' : isGPU ? 'pill-gpu' : 'pill-cpu';
    const icon = isCloud ? ICONS.cloud : isGPU ? ICONS.gpu : ICONS.cpu;
    pills.push(
      <span key="backend" className={`info-pill ${cls}`} title="Engine">
        <span dangerouslySetInnerHTML={{ __html: icon }} /> {backend}
      </span>
    );
  }
  if (processDur && !isSrt) {
    pills.push(
      <span key="time" className="info-pill pill-time" title="Processing Time">
        <span dangerouslySetInnerHTML={{ __html: ICONS.timer }} /> {processDur}
      </span>
    );
  }
  
  const actions: React.ReactNode[] = [];
  
  if (isSrt && item.srtPath) {
    // Open file action for SRT
    actions.push(
      <button key="open" className="action-btn" onClick={handleOpenFile} title="Open File">
        <span dangerouslySetInnerHTML={{ __html: ICONS.external }} />
      </button>
    );
  }
  
  if (!isError && (!isEmpty || isSrt)) {
    actions.push(
      <button key="copy" className="action-btn" onClick={handleCopy} title={isSrt ? "Copy Path" : "Copy"}>
        <span dangerouslySetInnerHTML={{ __html: ICONS.copy }} />
      </button>
    );
  }
  actions.push(
    <button key="delete" className="action-btn delete" onClick={handleDelete} title="Delete">
      <span dangerouslySetInnerHTML={{ __html: ICONS.trash }} />
    </button>
  );
  
  let content: React.ReactNode;
  if (isError) {
    content = <div>{item.text}</div>;
  } else if (isSrt) {
    // SRT item - show filename prominently
    content = (
      <div className="item-content srt-filename">
        <span className="srt-icon" dangerouslySetInnerHTML={{ __html: ICONS.download }} />
        {item.text}
      </div>
    );
  } else if (isEmpty) {
    content = <div><em>(No speech detected)</em></div>;
  } else {
    content = <div className="item-content">{item.text}</div>;
  }
  
  return (
    <div className={cardClass} id={`item-${item.timestamp}`}>
      <div className="meta-row">
        <div className="meta-left">
          {leftElements}
        </div>
        <div className="meta-right">
          <div className="pills-row">
            {pills}
          </div>
          <div className="item-actions">
            {actions}
          </div>
        </div>
      </div>
      {content}
    </div>
  );
};

import React from 'react';
import { useHistoryStore } from '../stores/useHistoryStore';
import { HistoryItem } from './HistoryItem';
import { ICONS } from '../ui/icons';

export const HistoryList: React.FC = () => {
  const filteredItems = useHistoryStore(state => state.filteredItems());
  
  if (filteredItems.length === 0) {
    return (
      <div className="history-container" id="history-list">
        <div className="empty-state">
          <div className="empty-icon" dangerouslySetInnerHTML={{ __html: ICONS.mic }} />
          <div className="empty-title">No recordings yet</div>
          <div className="empty-subtitle">
            Hit the mic or press <span className="shortcut-pill">Ctrl+Alt+Space</span> to start.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="history-container" id="history-list">
      {filteredItems.map(item => (
        <HistoryItem key={item.timestamp} item={item} />
      ))}
    </div>
  );
};

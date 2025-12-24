import React from 'react';
import { useHistoryStore } from '../stores/useHistoryStore';
import { ICONS } from '../ui/icons';

export const SearchBar: React.FC = () => {
  const { searchFilter, setSearchFilter, clearHistory } = useHistoryStore();
  
  const handleClear = async () => {
    if (confirm('Clear all history?')) {
      await clearHistory();
    }
  };
  
  return (
    <div className="search-container">
      <div className="search-wrapper">
        <input
          type="text"
          id="search-input"
          className="search-input"
          placeholder="Search history..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
        <div className="search-icon" dangerouslySetInnerHTML={{ __html: ICONS.search }} />
      </div>
      
      <div className="clear-zone">
        <button
          className="icon-btn-danger"
          id="init-clear-btn"
          title="Clear All History"
          onClick={handleClear}
          dangerouslySetInnerHTML={{ __html: ICONS.trash }}
        />
      </div>
    </div>
  );
};

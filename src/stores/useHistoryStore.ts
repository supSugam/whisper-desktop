import { create } from 'zustand';
import { HistoryItem } from '../types';
import { historyManager } from '../lib/history';

interface HistoryState {
  items: HistoryItem[];
  searchFilter: string;
  
  // Computed
  filteredItems: () => HistoryItem[];
  
  // Actions
  initialize: () => Promise<void>;
  addItem: (item: HistoryItem) => Promise<void>;
  removeItem: (timestamp: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  setSearchFilter: (filter: string) => void;
  refresh: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  items: [],
  searchFilter: '',
  
  filteredItems: () => {
    const { items, searchFilter } = get();
    if (!searchFilter) return items;
    
    const filter = searchFilter.toLowerCase();
    return items.filter(item => 
      item.text.toLowerCase().includes(filter)
    );
  },
  
  initialize: async () => {
    const items = await historyManager.getHistory();
    set({ items });
    
    // Subscribe to changes from historyManager
    historyManager.subscribe(async () => {
      const items = await historyManager.getHistory();
      set({ items });
    });
  },
  
  addItem: async (item) => {
    await historyManager.add(item);
    // The subscription will update the store
  },
  
  removeItem: async (timestamp) => {
    await historyManager.remove(timestamp);
    // The subscription will update the store
  },
  
  clearHistory: async () => {
    await historyManager.clear();
    // The subscription will update the store
  },
  
  setSearchFilter: (filter) => set({ searchFilter: filter }),
  
  refresh: async () => {
    const items = await historyManager.getHistory();
    set({ items });
  },
}));

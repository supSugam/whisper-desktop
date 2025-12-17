import { getStore } from "./config";
import { HistoryItem } from "../types";

const MAX_HISTORY = 50;
type Listener = () => void;

export class HistoryManager {
    private listeners: Listener[] = [];

    subscribe(listener: Listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    async getHistory(): Promise<HistoryItem[]> {
        const store = getStore();
        if (!store) return [];
        return (await store.get<HistoryItem[]>('history')) || [];
    }

    async add(item: HistoryItem) {
        const store = getStore();
        if (!store) return;
        
        let list = await this.getHistory();
        // Remove existing if updating same ID (e.g. placeholder)
        list = list.filter(h => h.timestamp !== item.timestamp);
        
        list.unshift(item);
        if (list.length > MAX_HISTORY) list.pop();
        
        await store.set('history', list);
        await store.save();
        this.notify();
    }

    async remove(timestamp: number) {
        const store = getStore();
        if (!store) return;

        let list = await this.getHistory();
        list = list.filter(h => h.timestamp !== timestamp);
        
        await store.set('history', list);
        await store.save();
        this.notify();
    }

    async clear() {
        const store = getStore();
        if (!store) return;
        await store.set('history', []);
        await store.save();
        this.notify();
    }
}

export const historyManager = new HistoryManager();

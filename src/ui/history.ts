import { HistoryItem } from "../types";
import { ICONS } from "./icons";
import { timeAgo, formatDuration } from "../lib/utils";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { historyManager } from "../lib/history";
import { showToast } from "./toast";

export class HistoryUI {
    container: HTMLElement | null = null;
    searchInput: HTMLInputElement | null = null;

    init() {
        this.container = document.getElementById('history-list');
        this.searchInput = document.getElementById('search-input') as HTMLInputElement;
        
        // Listeners for global actions (delete/copy) are tricky with vanilla JS modules
        // We will attach a global handler or use delegation
        this.container?.addEventListener('click', this.handleItemClick.bind(this));
        
        // Search listener
        this.searchInput?.addEventListener('input', () => this.render());

        // Initial render
        this.render();
    }

    private async handleItemClick(e: Event) {
        const target = e.target as HTMLElement;
        const btn = target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = Number(btn.dataset.id);
        const text = btn.dataset.text;

        if (action === 'delete' && id) {
            await historyManager.remove(id);
            // this.render(); // Handled by subscription
        } else if (action === 'copy' && text) {
            try {
                await writeText(text);
                showToast("Copied");
            } catch(e) { console.error(e); }
        }
    }

    async render() {
        if (!this.container) return;
        
        let items = await historyManager.getHistory();
        const filter = this.searchInput?.value.toLowerCase() || '';
        
        if (filter) {
            items = items.filter(i => i.text.toLowerCase().includes(filter));
        }

        if (items.length === 0) {
           this.renderEmptyState();
           return;
        }

        this.container.innerHTML = items.map(item => this.buildItem(item)).join('');
    }

    private renderEmptyState() {
        if (!this.container) return;
        // Check if filter is active for correct message? For now generic.
        this.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${ICONS.mic}</div>
                <div class="empty-title">No recordings yet</div>
                <div class="empty-subtitle">Hit the mic or press <span class="shortcut-pill">Ctrl+Alt+Space</span> to start.</div>
            </div>
        `;
    }

    private buildItem(item: HistoryItem): string {
        const safeText = this.escapeHtml(item.text);
        // We put raw text in data attribute for copy (be careful of size, but usually ok for phrases)
        // Actually, cleaner to keep it simple.
        
        const isError = !!item.error;
        const isEmpty = !item.text || item.text.trim().length === 0;
        
        const ago = timeAgo(item.timestamp);
        const dur = item.duration ? formatDuration(item.duration) : '';

        // Determine specific class
        let cardClass = 'history-item';
        if (isError) cardClass += ' error';
        if (isEmpty) cardClass += ' empty';

        // Meta Row
        let metaContent = '';
        if (isError) {
             metaContent = `<span style="color: var(--danger-color)">${ago} • Error</span>`;
        } else if (isEmpty) {
             metaContent = `<span>${ago} ${dur ? `<span class="duration-chip">${dur}</span>` : ''}</span> <span style="color: var(--warning-color)">Silence</span>`;
        } else {
             metaContent = `<span>${ago} ${dur ? `<span class="duration-chip">${dur}</span>` : ''}</span>`;
        }

        // Actions
        let actions = '';
        if (!isError && !isEmpty) {
            actions = `
             <button class="action-btn" data-action="copy" data-text="${this.escapeAttr(item.text)}" title="Copy">${ICONS.copy}</button>
             <button class="action-btn delete" data-action="delete" data-id="${item.timestamp}" title="Delete">${ICONS.trash}</button>
            `;
        } else {
            actions = `<button class="action-btn delete" data-action="delete" data-id="${item.timestamp}">${ICONS.trash}</button>`;
        }

        // Content
        let content = '';
        if (isError) content = `<div>${safeText}</div>`;
        else if (isEmpty) content = `<div><em>(No speech detected)</em></div>`;
        else content = `<div class="item-content">${safeText}</div>`;

        return `
        <div class="${cardClass}" id="item-${item.timestamp}">
            <div class="meta-row">
                ${metaContent}
                <div class="item-actions">
                    ${actions}
                </div>
            </div>
            ${content}
        </div>
        `;
    }

    private escapeHtml(unsafe: string): string {
         return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
    }

    private escapeAttr(unsafe: string): string {
        return unsafe.replace(/"/g, '&quot;');
    }
}

export const historyUI = new HistoryUI();

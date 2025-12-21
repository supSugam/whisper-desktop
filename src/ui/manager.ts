import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ICONS } from './icons';
import { showToast } from './toast';
import { updateConfig, getConfig } from '../lib/config';

const MODELS = [
    { name: 'Tiny', size: '~75 MB' },
    { name: 'Base', size: '~142 MB' },
    { name: 'Small', size: '~466 MB' },
    { name: 'Medium', size: '~1.5 GB' },
    { name: 'Large', size: '~2.9 GB' },
];

interface DownloadProgress {
    model_name: string;
    total: number;
    downloaded: number;
    percentage: number;
}

interface SystemStats {
    total_memory: number;
    free_memory: number;
    cpu_cores: number;
    has_nvidia: boolean;
    has_amd: boolean;
    backend: string;
}

export class ModelManagerUI {
    private container: HTMLElement | null = null;
    private statuses: Map<string, boolean> = new Map(); // exists?
    private downloading: Set<string> = new Set();
    private activeModel: string = 'Tiny';
    private useGPU: boolean = false;
    private stats: SystemStats | null = null;

    async init(containerId: string) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        const config = await getConfig();
        this.activeModel = config.localModel || 'Tiny';
        this.useGPU = config.useLocalGPU || false;

        try {
            this.stats = await invoke<SystemStats>('get_system_stats');
        } catch (e) {
            console.error('Failed to get system stats', e);
        }

        await this.checkAll();
        this.render();

        // Listen for progress
        listen<DownloadProgress>('download_progress', (event) => {
            this.updateProgress(event.payload);
        });

        // Bind events (Delegation)
        this.container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            // GPU Toggle
            if (target.closest('.gpu-toggle')) {
                this.toggleGPU();
                return;
            }

            // Model Actions
            const btn = target.closest('button');
            if (!btn) return;
            
            const model = btn.dataset.target;
            const action = btn.dataset.action;
            
            if (model && action) {
                if (action === 'download') this.download(model);
                if (action === 'delete') this.delete(model);
                if (action === 'select') this.selectModel(model);
            }
        });
    }

    async checkAll() {
        for (const m of MODELS) {
            try {
                const exists = await invoke<boolean>('check_model_exists', { modelName: m.name });
                this.statuses.set(m.name, exists);
            } catch (e) {
                console.error(`Check ${m.name} failed`, e);
            }
        }
    }

    private updateProgress(p: DownloadProgress) {
        // Find the progress bar and label for this model
        const card = this.container?.querySelector(`[data-model="${p.model_name}"]`);
        if (!card) return;

        const bar = card.querySelector('.progress-fill') as HTMLElement;
        const status = card.querySelector('.model-status') as HTMLElement;
        
        if (bar) bar.style.width = `${p.percentage}%`;
        if (status) status.innerText = `Downloading ${Math.round(p.percentage)}%`;
    }

    async download(modelName: string) {
        if (this.downloading.has(modelName)) return;
        this.downloading.add(modelName);
        this.render(); // disable button

        try {
            await invoke('download_model', { modelName });
            showToast(`${modelName} downloaded`);
            await this.checkAll();
        } catch (e) {
            showToast(`Download failed: ${e}`);
        } finally {
            this.downloading.delete(modelName);
            this.render();
        }
    }

    async delete(modelName: string) {
        if (!confirm(`Delete ${modelName} model?`)) return;
        try {
            await invoke('delete_model', { modelName });
            showToast(`${modelName} deleted`);
            await this.checkAll();
            this.render();
        } catch (e) {
            showToast(`Delete failed: ${e}`);
        }
    }

    async selectModel(modelName: string) {
        // Only verify if downloading? No, just set config
        this.activeModel = modelName;
        await updateConfig('localModel', modelName);
        this.render();
    }

    async toggleGPU() {
        this.useGPU = !this.useGPU;
        await updateConfig('useLocalGPU', this.useGPU);
        this.render();
    }

    render() {
        if (!this.container) return;
        
        let html = `<div class="model-list">`;

        if (this.stats) {
            const isGPUBackend = this.stats.backend !== 'CPU';
            const memGB = Math.round(this.stats.total_memory / 1024 / 1024 / 1024);
            
            html += `
            <div class="hardware-card ${isGPUBackend ? 'gpu-ready' : ''}">
                <div class="hw-header">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span>${isGPUBackend ? ICONS.gpu : ICONS.cpu}</span>
                        <strong>${this.stats.backend}</strong>
                    </div>
                    ${isGPUBackend ? 
                        `<button class="btn-sm gpu-toggle ${this.useGPU ? 'active' : ''}">
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${ICONS.gpu} <span>${this.useGPU ? 'Enabled' : 'Enable GPU'}</span>
                            </div>
                        </button>` 
                        : '<span class="badge badge-warn">CPU Only</span>'}
                </div>
                <div class="hw-details">
                    <div>CPU Cores: ${this.stats.cpu_cores} | RAM: ${memGB} GB</div>
                    ${!isGPUBackend && this.stats.has_nvidia ? `<div class="hw-tip">${ICONS.bulb} NVIDIA GPU detected. Enable CUDA feature.</div>` : ''}
                    ${!isGPUBackend && this.stats.has_amd ? `<div class="hw-tip">${ICONS.bulb} AMD GPU detected. Enable Vulkan feature.</div>` : ''}
                </div>
            </div>
            `;
        }
        
        MODELS.forEach(model => {
            const m = model.name;
            const exists = this.statuses.get(m) || false;
            const isDownloading = this.downloading.has(m);
            const isActive = this.activeModel === m;
            
            let warning = '';
            let disabled = false;
            const memGB = this.stats ? (this.stats.total_memory / 1024 / 1024 / 1024) : 8;
            
            if (m === 'Large') {
                if (memGB < 8) { warning = 'Low RAM'; disabled = true; }
                else if (memGB < 12) warning = 'High RAM';
            }
            if (m === 'Medium' && memGB < 4) warning = 'May Freeze';
            
            let statusText = exists ? 'Ready' : 'Not Saved';
            if (isDownloading) statusText = 'Downloading...';
            
            html += `
                <div class="model-row ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}" data-model="${m}">
                    
                    <div class="col-main">
                        <div class="row-top">
                            <span class="model-name">${m}</span>
                            ${isActive ? `<span class="icon-active" title="Active">${ICONS.check}</span>` : ''}
                        </div>
                        <div class="row-sub">
                            <span class="model-size">${model.size}</span>
                        </div>
                    </div>

                    <div class="col-status">
                         ${isDownloading ? 
                           `<div class="mini-progress">
                                <div class="progress-fill" style="width:0%"></div>
                                <span class="progress-text">0%</span>
                            </div>` 
                            : 
                            `<span class="status-label ${exists ? 'ready' : ''}">${statusText}</span>`
                         }
                         ${warning ? `<span class="badge badge-warn">${ICONS.warn} ${warning}</span>` : ''}
                    </div>
                    
                    <div class="col-actions">
                         ${!exists && !isDownloading ? `
                            <button class="btn-icon btn-download" data-action="download" data-target="${m}" title="Download">
                                ${ICONS.download}
                            </button>
                         ` : ''}

                         ${exists ? `
                             ${!isActive ? `
                                <button class="btn-text" data-action="select" data-target="${m}">USE</button>
                             ` : ''}
                             <button class="btn-icon btn-danger" data-action="delete" data-target="${m}" title="Delete">
                                ${ICONS.trash}
                            </button>
                         ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        this.container.innerHTML = html;
    }
}

export const modelManager = new ModelManagerUI();

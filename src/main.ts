import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

let appEl: HTMLElement | null;
let isRecording = false;
let startTime = 0;
let recordTimer: any = null;
let store: Store | null = null;

// Config state
interface AppConfig {
    token: string;
    autoCopy: boolean;
    autostart: boolean;
    shortcutEnabled: boolean;
    recordMode: 'toggle' | 'hold';
}

// Default Config
const DEFAULT_CONFIG: AppConfig = {
    token: "",
    autoCopy: true,
    autostart: false,
    shortcutEnabled: true,
    recordMode: 'toggle'
};

// Icons (Simplified V4) + Mode Icons
const ICONS = {
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    mic: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`,
    stop: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

const GLOBAL_SHORTCUT = "Ctrl+Alt+Space";
let isUpdatingShortcut = false;

async function updateShortcut(enabled: boolean, mode: 'toggle' | 'hold') {
    if (isUpdatingShortcut) return;
    isUpdatingShortcut = true;
    
    const statusEl = document.getElementById("shortcut-status");
    try {
        await unregisterAll();
        if(enabled) {
            await register(GLOBAL_SHORTCUT, (event) => {
                console.log(`Shortcut Event: ${event.state}`);
                if (mode === 'toggle') {
                    if (event.state === "Pressed") {
                         toggleRecord();
                    }
                } else {
                    // Hold Mode
                    if (event.state === "Pressed") {
                        if (!isRecording) startRecord();
                    } else if (event.state === "Released") {
                        if (isRecording) stopRecord(); 
                    }
                }
            });
            console.log(`Registered ${mode} shortcut: ${GLOBAL_SHORTCUT}`);
            if(statusEl) {
                statusEl.textContent = `Active: ${GLOBAL_SHORTCUT} (${mode})`;
                statusEl.style.color = "#4caf50"; // Green
            }
        } else {
             if(statusEl) {
                statusEl.textContent = "Disabled";
                statusEl.style.color = "#888";
            }
        }
    } catch(e: any) { 
        console.error("Shortcut Reg Error:", e);
        const errStr = String(e);
        if(statusEl) {
            if (errStr.includes("already registered")) {
                 statusEl.textContent = `Active: ${GLOBAL_SHORTCUT} (${mode})`;
                 statusEl.style.color = "#4caf50";
            } else {
                statusEl.textContent = "Error: " + e;
                statusEl.style.color = "#ff4444";
            }
        }
    } finally {
        isUpdatingShortcut = false;
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        appEl = document.getElementById("app");
        store = await Store.load("settings.json");
        const config = await getConfig();
        await renderApp(); // Render UI first so status element exists
        await updateShortcut(config.shortcutEnabled, config.recordMode);
        
        setInterval(() => loadHistory(), 60000);
    } catch (e) {
        alert("Startup Error: " + e);
    }
});

// ... Error Handler ...

async function getConfig(): Promise<AppConfig> {
    if (!store) return DEFAULT_CONFIG;
    
    const token = await store.get<string>("token");
    const autoCopy = await store.get<boolean>("autoCopy");
    const shortcutEnabled = await store.get<boolean>("shortcutEnabled");
    const recordMode = await store.get<'toggle'|'hold'>("recordMode");
    
    // Check Autostart
    let autostart = false;
    try { autostart = await isEnabled(); } catch(e) {}
    
    return { 
        token: token ?? DEFAULT_CONFIG.token, 
        autoCopy: autoCopy ?? DEFAULT_CONFIG.autoCopy, 
        autostart,
        shortcutEnabled: shortcutEnabled ?? DEFAULT_CONFIG.shortcutEnabled,
        recordMode: recordMode ?? DEFAULT_CONFIG.recordMode
    };
}
// Utility funcs
function timeAgo(timestamp: number): string {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'});
}

function formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`; // 0:05
}

async function renderApp() {
    if (!appEl) return;
    const config = await getConfig();

    appEl.innerHTML = `
        <div class="main-layout">
           <!-- Header, Action Area, Search, History same as before -->
           <header>
                <div class="header-content">
                    <h1>Whisper</h1>
                    <div class="subtitle">Minimal Transcriber</div>
                </div>
                <button class="icon-btn" id="settings-btn" title="Settings">${ICONS.settings}</button>
            </header>
            
            <div class="action-area" id="action-area">
                <button id="record-btn" class="mic-button">${ICONS.mic}</button>
                <div id="rec-status" class="status-label">Ready</div>
                
                <div id="recording-controls" style="display:none; margin-top:16px;">
                     <button class="btn-text-only" id="cancel-btn">Cancel</button>
                </div>
            </div>
    
            <div class="search-container">
                <input type="text" id="search-input" class="search-input" placeholder="Search history...">
                <div class="search-icon">${ICONS.search}</div>
            </div>
            
            <div class="history-container" id="history-list"></div>
        </div>
        
        <!-- Settings Overlay -->
        <div class="overlay settings-overlay" id="settings-overlay">
            <div class="modal-card">
                <div class="modal-header">
                    <div class="modal-title">Settings</div>
                    <button class="close-btn" id="close-settings" style="background:transparent; border:none;">${ICONS.close}</button>
                </div>
                
                <div class="modal-body">
                    <div class="section-title">Authentication</div>
                    <div class="form-group">
                        <label class="form-label">ChatGPT Session Token</label>
                        <input id="token-input" class="form-input" type="password" placeholder="Paste token here" value="${config.token}">
                         <div class="form-text" style="color: var(--warning-color); margin-top: 8px;">
                            ⚠️ <strong>DANGER</strong>: Only do this if you know what you are doing.
                        </div>
                    </div>

                     <!-- Simplified Guide -->
                    <div class="guide-box">
                         <div class="guide-step"><span class="step-num">1</span> Log in to chatgpt.com</div>
                         <div class="guide-step"><span class="step-num">2</span> Copy <code>__Secure-next-auth.session-token</code> cookie</div>
                    </div>
                    
                    <div class="section-title">Shortcut</div>
                    <div class="form-row">
                        <label class="form-label">Enable Global Shortcut</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="shortcut-enable-input" ${config.shortcutEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div id="shortcut-status" style="font-size: 0.8em; margin-top:-8px; margin-bottom:12px; opacity:0.8; padding-left: 2px;">Checking...</div>
                    
                    <div class="form-row" style="align-items: flex-start; flex-direction:column; gap:12px;">
                        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                            <label class="form-label">Activation Mode</label>
                            
                            <div class="segmented-control">
                                <button class="segment-btn ${config.recordMode==='toggle'?'active':''}" data-mode="toggle">Toggle</button>
                                <button class="segment-btn ${config.recordMode==='hold'?'active':''}" data-mode="hold" title="Hold key to record">Hold</button>
                            </div>
                        </div>
                        <div style="font-size:0.85em; opacity:0.6; line-height:1.4;" id="mode-desc">
                            Use <strong>Cmd/Ctrl + Alt + Space</strong>.<br>
                            ${config.recordMode==='toggle' ? 'Press to Start, Press again to Stop.' : 'Hold to Record, Release to Stop.'}
                        </div>
                    </div>

                    <div class="section-title">Preferences</div>
                    <!-- AutoCopy, Autostart same as before -->
                    <div class="form-row">
                        <label class="form-label">Auto-copy to Clipboard</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autocopy-input" ${config.autoCopy ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Open at Login</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autostart-input" ${config.autostart ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="section-title">Data</div>
                    <div class="form-row">
                        <button class="btn-danger-outline" id="clear-history">Clear History</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Confirm Modal (same) -->
        <div class="overlay" id="confirm-overlay">
            <div class="modal-card" style="max-width: 320px;">
               <div class="confirm-content">
                   <h3 style="margin-bottom:12px;">Clear History?</h3>
                   <button class="confirm-btn danger" id="confirm-clear" style="margin-top:20px;">Delete All</button>
                   <button class="confirm-btn cancel" id="cancel-clear" style="margin-top:10px; background:none; border:none; text-decoration:underline;">Cancel</button>
               </div>
            </div>
        </div>
    `;
    
    // ... UI Logic ...
    setupListeners();
}

function setupListeners() {
     const settingsBtn = document.getElementById("settings-btn");
     const closeSettingsBtn = document.getElementById("close-settings");
     const overlay = document.getElementById("settings-overlay");
     const tokenInput = document.getElementById("token-input") as HTMLInputElement;
     const shortcutEnableInput = document.getElementById("shortcut-enable-input") as HTMLInputElement;
     
     // Basic Interactions
     settingsBtn?.addEventListener("click", () => overlay?.classList.add("open"));
     closeSettingsBtn?.addEventListener("click", () => overlay?.classList.remove("open"));
     overlay?.addEventListener("click", (e) => { if(e.target===overlay) overlay.classList.remove("open"); });

     // Shortcut Logic
     shortcutEnableInput?.addEventListener("change", async (e: any) => {
         if(!store) return;
         const enabled = e.target.checked;
         await store.set("shortcutEnabled", enabled);
         await store.save();
         const mode = (await store.get("recordMode")) as 'toggle'|'hold';
         await updateShortcut(enabled, mode);
     });
     
     // Mode Switching (Segmented Control)
     const modeBtns = document.querySelectorAll(".segment-btn");
     modeBtns.forEach(btn => {
         btn.addEventListener("click", async (e: any) => {
             const mode = e.target.dataset.mode;
             if(!store || !mode) return;
             
             // Update UI
             modeBtns.forEach(b => b.classList.remove("active"));
             e.target.classList.add("active");
             
             const desc = document.getElementById("mode-desc");
             if(desc) desc.innerHTML = `Use <strong>Cmd/Ctrl + Alt + Space</strong>.<br>
                            ${mode==='toggle' ? 'Press to Start, Press again to Stop.' : 'Hold to Record, Release to Stop.'}`;

             // Save & Apply
             await store.set("recordMode", mode);
             await store.save();
             const enabled = (await store.get("shortcutEnabled")) as boolean;
             await updateShortcut(enabled, mode);
         });
     });
     
     // ... Rest of listeners (Token, Autostart, Autocopy, Rec, etc) ...
     const autoCopyInput = document.getElementById("autocopy-input") as HTMLInputElement;
     autoCopyInput?.addEventListener("change", async (e: any) => {
         if(!store) return;
        await store.set("autoCopy", e.target.checked);
        await store.save();
    });

    const autostartInput = document.getElementById("autostart-input") as HTMLInputElement;
    autostartInput?.addEventListener("change", async (e: any) => {
        try {
            if (e.target.checked) await enable(); else await disable();
        } catch(err) { e.target.checked = !e.target.checked; }
    });
    
    tokenInput?.addEventListener("input", async (e: any) => {
        if(!store) return;
        await store.set("token", e.target.value);
        await store.save();
    });
    
    // Rec & Extras
    document.getElementById("record-btn")?.addEventListener("click", toggleRecord);
    document.getElementById("cancel-btn")?.addEventListener("click", (e) => {
         e.stopPropagation();
         cancelRecord();
    });
    
    document.getElementById("clear-history")?.addEventListener("click", () => document.getElementById("confirm-overlay")?.classList.add("open"));
    document.getElementById("cancel-clear")?.addEventListener("click", () => document.getElementById("confirm-overlay")?.classList.remove("open"));
    document.getElementById("confirm-clear")?.addEventListener("click", async () => {
         if(store) { await store.set("history", []); await store.save(); }
         loadHistory();
         document.getElementById("confirm-overlay")?.classList.remove("open");
    });
}

function resetRecUI() {
    const btn = document.getElementById("record-btn");
    const status = document.getElementById("rec-status");
    const controls = document.getElementById("recording-controls");
    
    if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = ICONS.mic;
    }
    if (status) {
        status.classList.remove("visible");
        status.innerText = "Ready";
    }
    if (controls) controls.style.display = "none";
}

// Separated start/stop for Hold logic
async function startRecord() {
    if(isRecording) return;
    const btn = document.getElementById("record-btn");
    const controls = document.getElementById("recording-controls");
    const tokenInput = document.getElementById("token-input") as HTMLInputElement;
    const token = tokenInput?.value?.trim();
    
    if (!token) {
        // Can't show overlay from global shortcut if app hidden, but logic holds
        return; 
    }
    
    try {
        await invoke("start_recording");
        isRecording = true;
        startTime = Date.now();
        
        if (btn) { btn.classList.add("recording"); btn.innerHTML = ICONS.stop; }
        if (controls) controls.style.display = "flex";
        
        updateTimerDisplay(0);
        clearInterval(recordTimer);
        recordTimer = setInterval(() => {
            if(!isRecording) return;
            updateTimerDisplay(Date.now() - startTime);
        }, 500);
    } catch(e) { console.error(e); }
}

async function stopRecord() {
    if(!isRecording) return;
    isRecording = false;
    clearInterval(recordTimer);
    resetRecUI();
    
    const duration = Date.now() - startTime;
    const tokenInput = document.getElementById("token-input") as HTMLInputElement;
    
    try {
        const path = await invoke("stop_recording");
        if(duration < 500) { cancelRecord(); return; } // Too short
        await transcribe(path as string, tokenInput?.value?.trim(), duration);
    } catch(e) { console.error(e); }
}

function cancelRecord() {
    isRecording = false;
    clearInterval(recordTimer);
    resetRecUI();
    invoke("stop_recording").catch(console.error);
}

function showToast(msg: string) {
    const el = document.createElement("div");
    el.innerText = msg;
    el.style.position = "fixed";
    el.style.bottom = "20px";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.background = "rgba(0,0,0,0.8)";
    el.style.color = "#fff";
    el.style.padding = "8px 16px";
    el.style.borderRadius = "20px";
    el.style.zIndex = "9999";
    el.style.fontSize = "12px";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

async function toggleRecord() {
    showToast("Shortcut Triggered");
    if (isRecording) await stopRecord();
    else await startRecord();
}

function updateTimerDisplay(ms: number) {
    const status = document.getElementById("rec-status");
    if (status) {
        status.classList.add("visible");
        status.innerText = formatDuration(ms);
    }
}

async function transcribe(path: string, token: string, duration: number) {
    const historyList = document.getElementById("history-list");
    const id = Date.now();
    const config = await getConfig();
    
    // Optimistic UI
    const tempHtml = `
        <div class="history-item" id="item-${id}">
            <div class="meta-row">
                <span>Just now</span>
            </div>
            <div style="opacity: 0.7">Uploading audio...</div>
        </div>`;
        
    if (historyList) {
        historyList.innerHTML = tempHtml + historyList.innerHTML;
    }
    
    try {
        const text: string = await invoke("transcribe", { path, token });
        const isEmpty = !text || text.trim().length === 0;

        const itemData = { timestamp: id, text, error: false, duration }; 
        await saveHistoryItem(itemData);
        
        const item = document.getElementById(`item-${id}`);
        if (item) {
            if (isEmpty) {
                item.classList.add("empty");
                item.innerHTML = buildHistoryItemContent(itemData, true, true);
            } else {
                item.innerHTML = buildHistoryItemContent(itemData, false, false);
                if (config.autoCopy) {
                    try {
                        await writeText(text); // Use Plugin
                    } catch(e) { console.error("Clipboard Error:", e); }
                }
            }
        }
    } catch (e: any) {
        console.error("Transcribe Error:", e);
        // Handle Error
        const item = document.getElementById(`item-${id}`);
        const itemData = { timestamp: id, text: String(e), error: true, duration };
        await saveHistoryItem(itemData);
        if(item) {
            item.classList.add("error");
            item.innerHTML = buildHistoryItemContent(itemData, false, true);
        }
    }
}

async function saveHistoryItem(item: any) {
    if (!store) return;
    const hist = await store.get<any[]>("history") || [];
    hist.unshift(item);
    if (hist.length > 50) hist.pop();
    await store.set("history", hist);
    await store.save();
}

(window as any).deleteItem = async function(id: number) {
     if (!store) return;
    const hist = await store.get<any[]>("history") || [];
    const newHist = hist.filter((h: any) => h.timestamp !== id);
    await store.set("history", newHist);
    await store.save();
    
    const searchVal = (document.getElementById("search-input") as HTMLInputElement)?.value;
    loadHistory(searchVal);
};

(window as any).copyText = async function(text: string) {
     // navigator.clipboard.writeText(text);
     try {
        await writeText(text);
     } catch(e) { alert("Copy failed: " + e); }
};

function buildHistoryItemContent(item: any, isEmpty: boolean, isError: boolean) {
    const safeText = item.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const safeTextArg = safeText.replace(/`/g, "\\`").replace(/"/g, "&quot;").replace(/\$/g, "\\$"); 
    
    const ago = timeAgo(item.timestamp);
    const dur = item.duration ? formatDuration(item.duration) : "";

    let contentHtml = "";
    if (isError) {
        contentHtml = `
            <div class="meta-row" style="color: var(--danger-color)">
                <span>${ago} • Error</span>
            </div>
            <div>${safeText}</div>`;
    } else if (isEmpty) {
        contentHtml = `
            <div class="meta-row">
                <span>${ago} ${dur ? `<span class="duration-chip">${dur}</span>` : ''}</span>
                <span style="color: var(--warning-color)">Silence</span>
            </div>
            <div><em>(No speech detected)</em></div>`;
    } else {
        contentHtml = `
            <div class="meta-row">
                <span>${ago} ${dur ? `<span class="duration-chip">${dur}</span>` : ''}</span>
                <div class="item-actions">
                     <button class="action-btn" onclick="copyText(\`${safeTextArg}\`)" title="Copy">${ICONS.copy}</button>
                     <button class="action-btn delete" onclick="deleteItem(${item.timestamp})" title="Delete">${ICONS.trash}</button>
                </div>
            </div>
            <div class="item-content">${safeText}</div>`;
    }
    
    if (isError || isEmpty) {
         contentHtml += `
            <div class="item-actions">
                <button class="action-btn delete" onclick="deleteItem(${item.timestamp})">${ICONS.trash}</button>
            </div>`;
    }

    return contentHtml;
}

async function loadHistory(filterStr: string = "") {
    if (!store) return;
    const hist = await store.get<any[]>("history") || [];
    const list = document.getElementById("history-list");
    if (!list) return;

    let filtered = hist;
    if (filterStr.trim()) {
        const lower = filterStr.toLowerCase();
        filtered = hist.filter((h: any) => h.text.toLowerCase().includes(lower));
    }

    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center; color:#555; margin-top: 20px;">No history found</div>`;
        return;
    }

    const html = filtered.map((h: any) => {
        const isError = h.error === true;
        const isEmpty = !h.text || h.text.trim().length === 0;
        return `<div class="history-item ${isError?'error':''} ${isEmpty?'empty':''}" id="item-${h.timestamp}">${buildHistoryItemContent(h, isEmpty, isError)}</div>`;
    }).join('');
    
    list.innerHTML = html; 
}

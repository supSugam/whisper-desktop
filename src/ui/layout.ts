import { ICONS } from "./icons";

export function renderLayout(appEl: HTMLElement) {
    appEl.innerHTML = `
        <div class="main-layout">
            <div class="app-container">
                <header>
                        <div class="header-content">
                            <h1>Whisper+</h1>
                            <div class="subtitle">ChatGPT's speech-to-text to your desktop.</div>
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
                    <div class="search-wrapper">
                        <input type="text" id="search-input" class="search-input" placeholder="Search history...">
                        <div class="search-icon">${ICONS.search}</div>
                    </div>
                    
                    <div class="clear-zone">
                         <button class="icon-btn-danger" id="init-clear-btn" title="Clear All History">${ICONS.trash}</button>
                    </div>
            </div>
            
            <div class="history-container" id="history-list"></div>
            </div>
        </div>
        
        <!-- Settings Overlay -->
        <div class="overlay settings-overlay" id="settings-overlay">
            <div class="modal-card">
                <div class="modal-header">
                    <h2 class="modal-title">Settings</h2>
                    <button class="close-btn" id="close-settings" style="background:transparent; border:none;">${ICONS.close}</button>
                </div>
                
                <div class="modal-body">
                    <div class="section-title">Shortcut</div>
                    <div class="form-row">
                        <label class="form-label">Enable Global Shortcut</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="shortcut-enable-input">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div id="shortcut-status" class="status-text">Checking...</div>
                    
                    <div class="form-row" style="align-items: flex-start; flex-direction:column; gap:12px;">
                        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                            <label class="form-label">Activation Mode</label>
                            
                            <div class="segmented-control">
                                <button class="segment-btn" data-mode="toggle">Toggle</button>
                                <button class="segment-btn" data-mode="hold" title="Hold key to record">Hold</button>
                            </div>
                        </div>
                        <div class="mode-desc" id="mode-desc"></div>
                    </div>

                    <div class="section-title">Preferences</div>
                    <div class="form-row">
                        <label class="form-label">Auto-copy to Clipboard</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autocopy-input">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Auto-paste to Input</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autopaste-input">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div id="autopaste-wayland-info" class="form-info-box" style="display: none;">
                        ⚠️ On Wayland, auto-paste only works with apps running in XWayland mode (most Electron/browser apps). Native Wayland apps won't receive the paste.
                    </div>
                    <div class="form-row">
                        <label class="form-label">Sound Effects</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="sound-input">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Desktop Notifications</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="notification-input">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Open at Login</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autostart-input">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="section-title">Data</div>
                    <div class="form-row">
                         <div style="font-size:0.8rem; opacity:0.6;">History management is now on the main screen.</div>
                    </div>

                    <div class="section-title section-auth">Authentication</div>
                    <div class="form-group">
                        <label class="form-label">ChatGPT Session Token</label>
                        <input id="token-input" class="form-input" type="password" placeholder="Paste token here">
                         <div class="form-text warning-text">
                            ⚠️ <strong>DANGER</strong>: Only do this if you know what you are doing. Never share this token.
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">User Agent (Browser Signature)</label>
                        <input id="ua-input" class="form-input" type="text" placeholder="Mozilla/5.0...">
                        <div class="form-text" style="font-size:0.75rem; color:#aaa; margin-top:4px;">
                            Optional: Match this with your browser to avoid session conflicts.
                        </div>
                    </div>

                     <!-- Detailed Guide -->
                    <div class="guide-box">
                        <div class="guide-header">How to retrieve your token</div>

                        <div class="guide-method">
                            <div style="font-weight:600; color:#fff; margin-bottom:6px;">Method 1: Developer Tools (Recommended)</div>
                            <div class="guide-step"><span class="step-num">1</span> Go to <a href="https://chatgpt.com" target="_blank">chatgpt.com</a></div>
                            <div class="guide-step"><span class="step-num">2</span> Press <code>F12</code> &rarr; <strong>Application</strong> tab &rarr; <strong>Cookies</strong></div>
                            <div class="guide-step"><span class="step-num">3</span> Select <code>chatgpt.com</code> from list</div>
                            <div class="guide-step"><span class="step-num">4</span> Copy value of <code>__Secure-next-auth.session-token</code></div>
                        </div>

                        <div class="or-divider">&mdash; OR &mdash;</div>

                        <div class="guide-method">
                            <div style="font-weight:600; color:#fff; margin-bottom:6px;">Method 2: Browser Extension</div>
                            <div class="guide-step">
                                Use <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank">Get cookies.txt LOCALLY</a>
                            </div>
                            <div class="guide-step">While you're at chatgpt.com, open extension &rarr; Find <code>__Secure-next-auth.session-token</code> &rarr; Copy value.</div>
                            <div class="guide-step">Paste value into token input.</div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn-text-only" id="reset-defaults-btn">Reset Defaults</button>
                    <!-- <button class="btn-primary" id="save-settings-btn">Done</button> --> 
                </div>
            </div>
        </div>
    `;
}

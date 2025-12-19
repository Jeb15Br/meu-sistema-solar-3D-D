/**
 * RPOD: RED PANEL OF DEATH (Global Error Handler)
 * Ported from "Relogio Espacial" Project
 */

// Error Sound (Optional - acts as fallback or placeholder)
const audioError = new Audio('assets/sound_effects/hover.mp3'); // Using available sound for now

window.RPOD = {
    init: function () {
        window.onerror = this.showRPOD;
        window.addEventListener('unhandledrejection', (event) => {
            this.showRPOD("Promessa Rejeitada: " + event.reason, "", 0, 0, event.reason);
        });

        // Intercept console.error
        const originalConsoleError = console.error;
        console.error = function (...args) {
            originalConsoleError.apply(console, args); // Keep original behavior

            // Format message
            const msg = args.map(arg =>
                (typeof arg === 'object') ? (arg.message || JSON.stringify(arg)) : String(arg)
            ).join(' ');

            // Avoid infinite loop if RPOD itself causes an error
            if (msg.includes('RPOD')) return;

            window.RPOD.showRPOD("Console Error: " + msg, "console", 0, 0, args[0]);
        };

        console.log("🔥 RPOD (Red Panel of Death) Initialized");
    },

    showRPOD: function (msg, source, lineno, colno, error) {
        // Play Error Sound
        if (audioError) {
            audioError.play().catch(e => console.warn("Audio play failed (Autoplay blocked?):", e));
        }

        let container = document.getElementById('rpod-main-container');

        // Create Main Container if it doesn't exist
        if (!container) {
            container = document.createElement('div');
            container.id = 'rpod-main-container';
            Object.assign(container.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(20, 0, 0, 0.95)', // Slightly transparent background
                zIndex: '999999',
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                overflowY: 'auto' // Allow scrolling for multiple errors
            });

            // Header with Global Actions
            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom: 2px solid #ff4444; padding-bottom:10px;">
                    <h2 style="color:#ff4444; margin:0; display:flex; align-items:center;">
                        <span style="font-size:1.5em; margin-right:10px;">🚨</span> ERROS: <span id="rpod-error-count" style="margin-left:10px; color:white;">0</span>
                    </h2>
                    <div style="display:flex; gap:10px;">
                        <button id="btn-copy-all" 
                            style="padding:10px 20px; background:#0044aa; color:white; border:1px solid #4488ff; border-radius:6px; cursor:pointer; font-weight:bold;">
                            📚 COPIAR TUDO
                        </button>
                        <button onclick="location.reload()" 
                            style="padding:10px 20px; background:#fff; color:#aa0000; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                            🔄 RECARREGAR
                        </button>
                        <button onclick="document.getElementById('rpod-main-container').remove(); window.rpodErrors = [];" 
                            style="padding:10px 20px; background:#440000; color:white; border:1px solid #ff4444; border-radius:6px; cursor:pointer; font-weight:bold;">
                            ❌ FECHAR TUDO
                        </button>
                    </div>
                </div>
                <div id="rpod-cards-area" style="display:flex; flex-direction:column; gap:20px;"></div>
            `;
            document.body.appendChild(container); // Append to body

            // Setup Copy All Logic
            document.getElementById('btn-copy-all').onclick = () => {
                const allErrors = (window.rpodErrors || []).join('\n\n========================================\n\n');
                navigator.clipboard.writeText(allErrors).then(() => {
                    const btn = document.getElementById('btn-copy-all');
                    const originalText = btn.innerText;
                    btn.innerText = "✅ COPIADO!";
                    setTimeout(() => btn.innerText = originalText, 2000);
                });
            };
        }

        // --- Create Individual Error Card ---
        let stack = error && error.stack ? error.stack : `at ${source}:${lineno}:${colno}`;
        let timestamp = new Date().toLocaleTimeString();
        let fullErrorText = `[${timestamp}] ERRO: ${msg}\nSTACK: ${stack}`;

        // Store error for "Copy All"
        if (!window.rpodErrors) window.rpodErrors = [];
        window.rpodErrors.push(fullErrorText);

        // Update Count
        document.getElementById('rpod-error-count').innerText = window.rpodErrors.length;

        const card = document.createElement('div');
        Object.assign(card.style, {
            backgroundColor: 'rgba(80, 0, 0, 1)',
            border: '1px solid #ff4444',
            borderRadius: '8px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            position: 'relative'
        });

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong style="color:#ffdddd; font-size:1.1em;">${msg}</strong>
                <span style="color:#aaa; font-size:0.9em;">${timestamp}</span>
            </div>
            <pre style="background:rgba(0,0,0,0.3); padding:10px; overflow-x:auto; margin:0; font-size:0.85em; color:#ddd; border: 1px solid #400;">${stack}</pre>
            <div style="text-align:right; margin-top:10px;">
                 <button class="btn-copy-single" 
                    style="padding:5px 10px; background:#333; color:#ccc; border:1px solid #555; border-radius:4px; cursor:pointer; font-size:0.8em;">
                    📋 Copiar
                </button>
            </div>
        `;

        // Bind Single Copy Button
        card.querySelector('.btn-copy-single').onclick = function () {
            navigator.clipboard.writeText(fullErrorText).then(() => {
                this.innerText = "✅";
                setTimeout(() => this.innerText = "📋 Copiar", 1500);
            });
        };

        document.getElementById('rpod-cards-area').appendChild(card);

        // Auto -scroll to latest
        container.scrollTop = container.scrollHeight;

        console.error("RPOD Triggered:", msg, error);
        return false;
    },

    log: function (msg, type = 'log') {
        const panel = document.getElementById('rpod-error-panel');
        if (panel) {
            const logDiv = document.createElement('div');
            logDiv.style.marginTop = '10px';
            logDiv.style.padding = '10px';
            logDiv.style.backgroundColor = type === 'success' ? '#004400' : (type === 'warn' ? '#553300' : '#444');
            logDiv.style.border = type === 'success' ? '1px solid #0f0' : (type === 'warn' ? '1px solid #fa0' : '1px solid #888');
            logDiv.style.color = '#fff';
            logDiv.style.borderRadius = '4px';
            logDiv.innerText = msg;

            // Try to find the content area to append, or just append to main div for now
            panel.querySelector('div[style*="max-height"]').appendChild(logDiv);
        } else {
            console.log(`[RPOD ${type}] ${msg}`);
            // Fallback: Show a mini notification if no critical error panel exists
            const notif = document.createElement('div');
            Object.assign(notif.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                backgroundColor: type === 'success' ? 'rgba(0,100,0,0.9)' : 'rgba(200,100,0,0.9)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                zIndex: '9999999',
                fontFamily: 'monospace',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                transition: 'opacity 0.5s'
            });
            notif.innerText = msg;
            document.body.appendChild(notif);
            setTimeout(() => {
                notif.style.opacity = '0';
                setTimeout(() => notif.remove(), 500);
            }, 3000);
        }
    }
};

// Auto-initialize immediately
window.RPOD.init();

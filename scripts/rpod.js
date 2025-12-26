/**
 * RPOD: RED PANEL OF DEATH (Global Error Handler)
 * Ported from "Relogio Espacial" Project
 */

// Error Sound (Optional - acts as fallback or placeholder)
const audioError = null; // Áudio desativado para evitar 404

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

    activeErrors: {},

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
                backgroundColor: 'rgba(20, 0, 0, 0.95)',
                zIndex: '999999',
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                overflowY: 'auto'
            });

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
                        <button onclick="document.getElementById('rpod-main-container').remove(); window.RPOD.activeErrors = {}; window.rpodErrors = [];" 
                            style="padding:10px 20px; background:#440000; color:white; border:1px solid #ff4444; border-radius:6px; cursor:pointer; font-weight:bold;">
                            ❌ FECHAR TUDO
                        </button>
                    </div>
                </div>
                <div id="rpod-cards-area" style="display:flex; flex-direction:column; gap:20px;"></div>
            `;
            document.body.appendChild(container);

            document.getElementById('btn-copy-all').onclick = () => {
                const allErrors = (window.rpodErrors || []).join('\n\n========================================\n\n');

                // Fallback for Non-Secure Contexts (HTTP IP)
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(allErrors).then(() => {
                        const btn = document.getElementById('btn-copy-all');
                        const originalText = btn.innerText;
                        btn.innerText = "✅ COPIADO!";
                        setTimeout(() => btn.innerText = originalText, 2000);
                    }).catch(err => {
                        console.warn("Clipboard API failed:", err);
                        fallbackCopy(allErrors);
                    });
                } else {
                    fallbackCopy(allErrors);
                }

                function fallbackCopy(text) {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        const btn = document.getElementById('btn-copy-all');
                        const originalText = btn.innerText;
                        btn.innerText = "✅ COPIADO!";
                        setTimeout(() => btn.innerText = originalText, 2000);
                    } catch (err) {
                        console.error('Fallback copy failed', err);
                        alert("Não foi possível copiar automaticamente (Bloqueio do Navegador).");
                    }
                    document.body.removeChild(textArea);
                }
            };
        }

        const stack = error && error.stack ? error.stack : `at ${source}:${lineno}:${colno}`;
        const errorKey = msg + stack;
        const timestamp = new Date().toLocaleTimeString();

        // Check if error already exists
        if (window.RPOD.activeErrors[errorKey]) {
            window.RPOD.activeErrors[errorKey].count++;
            const card = window.RPOD.activeErrors[errorKey].element;
            const titleEl = card.querySelector('.rpod-msg-title');
            titleEl.innerText = `${msg} (${window.RPOD.activeErrors[errorKey].count}x)`;

            // Update timestamp to latest
            card.querySelector('.rpod-timestamp').innerText = timestamp;

            // Highlight briefly
            card.style.borderColor = '#ffffff';
            setTimeout(() => card.style.borderColor = '#ff4444', 300);
        } else {
            // New error
            const fullErrorText = `[${timestamp}] ERRO: ${msg}\nSTACK: ${stack}`;
            if (!window.rpodErrors) window.rpodErrors = [];
            window.rpodErrors.push(fullErrorText);

            const card = document.createElement('div');
            Object.assign(card.style, {
                backgroundColor: 'rgba(80, 0, 0, 1)',
                border: '1px solid #ff4444',
                borderRadius: '8px',
                padding: '20px',
                color: 'white',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                position: 'relative',
                transition: 'border-color 0.3s'
            });

            const isRivalError = msg.includes("Time Pequeno");

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong class="rpod-msg-title" style="color:#ffdddd; font-size:1.1em;">${msg} (1x)</strong>
                    <span class="rpod-timestamp" style="color:#aaa; font-size:0.9em;">${timestamp}</span>
                </div>
                <pre style="background:rgba(0,0,0,0.3); padding:10px; overflow-x:auto; margin:0; font-size:0.85em; color:#ddd; border: 1px solid #400;">${stack}</pre>
                <div style="text-align:right; margin-top:10px;">
                     <button class="btn-copy-single" 
                        style="padding:5px 10px; background:#333; color:#ccc; border:1px solid #555; border-radius:4px; cursor:pointer; font-size:0.8em; display: ${isRivalError ? 'none' : 'inline-block'};">
                        📋 Copiar
                    </button>
                </div>
            `;

            card.querySelector('.btn-copy-single').onclick = function () {
                const count = window.RPOD.activeErrors[errorKey] ? window.RPOD.activeErrors[errorKey].count : 1;
                const textToCopy = `[${timestamp}] ERRO: ${msg} (${count}x)\nSTACK: ${stack}`;

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        this.innerText = "✅";
                        setTimeout(() => this.innerText = "📋 Copiar", 1500);
                    });
                } else {
                    // Fallback Inline
                    const textArea = document.createElement("textarea");
                    textArea.value = textToCopy;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        this.innerText = "✅";
                        setTimeout(() => this.innerText = "📋 Copiar", 1500);
                    } catch (err) {
                        console.error('Fallback copy failed', err);
                    }
                    document.body.removeChild(textArea);
                }
            };

            document.getElementById('rpod-cards-area').appendChild(card);
            window.RPOD.activeErrors[errorKey] = {
                count: 1,
                element: card
            };
        }

        // Update Total Count (distinct errors)
        document.getElementById('rpod-error-count').innerText = Object.keys(window.RPOD.activeErrors).length;

        // Auto-scroll to latest
        container.scrollTop = container.scrollHeight;

        console.error("RPOD Triggered:", msg, error);

        // --- ENVIAR PARA O TERMINAL (User Request - Exclusive Locally) ---
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
            fetch('http://localhost:9999/log', {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    msg: msg,
                    stack: stack,
                    timestamp: timestamp
                })
            }).catch(err => {
                // Silencioso se o servidor não estiver rodando
            });
        }


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

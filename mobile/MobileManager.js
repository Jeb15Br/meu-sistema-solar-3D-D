import { simulationManager } from '../modules/SimulationManager.js?v=2';
import { inputState } from '../modules/InputManager.js?v=2';
import { AndroidManager } from './AndroidManager.js?v=1';
import { IOSManager } from './IOSManager.js?v=1';

export const MobileManager = {
    platformManager: null, // Will be set to AndroidManager or IOSManager

    init: function () {
        // [FIX] Strict Mobile Detection (User Agent)
        const ua = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);
        const isMobileDevice = isAndroid || isIOS || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

        if (isMobileDevice) {
            document.body.classList.add('is-mobile');

            // Select Platform Manager
            this.platformManager = isIOS ? IOSManager : AndroidManager;
            console.log(`📱 Mobile Mode Active via ${this.platformManager.config.platform}Manager`);

            if (this.platformManager.init) {
                this.platformManager.init();
            }

            // Only toggle specific bits if mobile
            this.setupMobileControls();
            this.setupResizeHandler();
            this.setupFullscreenHandler();
            this.setupMenuCloseHandler();

            // [FIX] Prevent Android Context Menu (Long Press = Copy/Select)
            // This fixes the issue where holding Earth triggers "Copy Screen" instead of Easter Egg
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, { passive: false });


        } else {
            console.log("💻 Desktop Mode (Mobile layout disabled even if resized)");
            document.body.classList.remove('is-mobile');
        }
    },

    // [NEW] robust background click detection for closing menus on mobile
    setupMenuCloseHandler: function () {
        if (window.innerWidth > 1024) return;

        // Listen for taps on the container/body that are NOT on UI elements
        const handleBackgroundTap = (e) => {
            const infoMenu = document.getElementById('info-menu');
            const infoPanel = document.getElementById('info-panel');
            const musicPanel = document.getElementById('music-modal');

            // Check if tap target is inside any active UI
            const target = e.target;
            const isInsideMenu = infoMenu && !infoMenu.classList.contains('hidden') && infoMenu.contains(target);
            const isInsidePanel = infoPanel && !infoPanel.classList.contains('hidden') && infoPanel.contains(target);
            const isInsideMusic = musicPanel && musicPanel.style.display !== 'none' && musicPanel.contains(target);

            // Also ignore control buttons
            const isControl = target.closest('.control-btn') || target.closest('#ui-container') || target.closest('#info-btn');

            if (!isInsideMenu && !isInsidePanel && !isInsideMusic && !isControl) {
                // It's a background tap! Close everything.
                if (infoMenu && !infoMenu.classList.contains('hidden')) {
                    infoMenu.classList.add('hidden');
                }
            }
        };

        // Use 'touchstart' for immediate response, or 'click' if scrolling is a concern. 
        // 'click' is safer to avoid accidental closes while dragging, but 'touchend' might be better.
        // Let's use 'click' as the base, ensuring it fires on the canvas.
        document.body.addEventListener('click', handleBackgroundTap);
    },
    setupFullscreenHandler: function () {
        if (window.innerWidth > 1024) return; // Only for mobile

        const fullscreenReactivator = () => {
            // [FIX] Check if we are ALREADY in fullscreen
            const isFullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;

            if (!isFullscreen && this.platformManager) {
                // If not in fullscreen, try to enter it again on interaction
                this.platformManager.setupFullscreen();
            }
        };

        // Keep listener active to allow restoring fullscreen if user exits
        // Use 'click' as the primary gesture trigger
        window.addEventListener('click', fullscreenReactivator);

        // Optional: Listen to visibility change to reset/re-check if needed
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // We can't auto-trigger fullscreen here (needs gesture), 
                // but we know we are back. The next click will handle it.
            }
        });
    },

    setupMobileControls: function () {
        const buttons = document.querySelectorAll('.control-btn');
        buttons.forEach(btn => {
            const key = btn.getAttribute('data-key');
            if (!key) return;

            const setKey = (active) => {
                if (active) {
                    inputState.keyState[key] = true;
                    btn.classList.add('active');
                } else {
                    inputState.keyState[key] = false;
                    btn.classList.remove('active');
                }
            };

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent scroll/zoom
                setKey(true);
                // Haptic Feedback (Vibration)
                if (navigator.vibrate) navigator.vibrate(15);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                setKey(false);
            }, { passive: false });

            // Fallback for mouse testing on desktop
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                setKey(true);
            });
            btn.addEventListener('mouseup', (e) => setKey(false));
            btn.addEventListener('mouseleave', (e) => setKey(false));
        });
    },

    setupResizeHandler: function () {
        // [FIX] Robust Resize Handler for Mobile Orientation
        const handleResize = () => {
            simulationManager.handleWindowResize();
            // Trigger generic re-check for late-settling mobile browsers
            setTimeout(() => simulationManager.handleWindowResize(), 100);
            setTimeout(() => simulationManager.handleWindowResize(), 500);
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResize, 100);
        });
    },

    // [NEW] Helper to keep mobile HTML logic separate
    getMobileControlsHTML: function () {
        return `
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; text-align: center;">
                <p style="margin-bottom: 20px; color: #aaa; font-size: 0.9rem;">Toque e arraste para explorar o cosmos.</p>
                
                <div style="margin-bottom: 20px;">
                    <div style="margin-bottom: 5px; color: #00ccff; font-weight: bold;">Mover Câmera</div>
                    <code style="background: #333; padding: 4px 8px; border-radius: 4px; color: #ffcc00; font-size: 1.2rem;">⬅️ ⬆️ ⬇️ ➡️</code>
                    <p style="font-size: 0.85rem; margin-top: 5px;">Use o <strong>D-Pad Esquerdo</strong> para voar</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="margin-bottom: 5px; color: #00ccff; font-weight: bold;">Alterar Altitude</div>
                    <code style="background: #333; padding: 4px 8px; border-radius: 4px; color: #ffcc00; font-size: 1.2rem;">⬆️ ⬇️</code>
                    <p style="font-size: 0.85rem; margin-top: 5px;">Use os <strong>Botões Direitos</strong> para subir/descer</p>
                </div>

                <div style="margin-bottom: 10px;">
                    <div style="margin-bottom: 5px; color: #00ccff; font-weight: bold;">Olhar ao Redor</div>
                    <span style="font-size: 2rem;">👆 ↔️</span>
                    <p style="font-size: 0.85rem; margin-top: 5px;"><strong>Deslize o dedo</strong> na tela para girar</p>
                </div>
            </div>
        `;
    },

    // [NEW] Logic to check if we should close modal on background click (Mobile Only)
    shouldCloseOnBackgroundClick: function () {
        return window.innerWidth <= 1024;
    },

    getMobileTipsHTML: function () {
        return `
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; text-align: left;">
                <p style="text-align: center; color: #00ccff; font-weight: bold; margin-bottom: 15px;">Mecânicas Rápidas ⚡</p>
                <ul style="padding-left: 20px; line-height: 1.6; color: #ddd;">
                    <li style="margin-bottom: 10px;">
                        <strong>Fechar Painéis:</strong><br>
                        Toque em qualquer área vazia do espaço. 🌌
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Resetar Segredos:</strong><br>
                        Mantenha o botão <strong style="color: #ffcc00; border: 1px solid #ffcc00; padding: 0 4px; border-radius: 4px;">i</strong> pressionado por <strong>3 segundos</strong>. 🔥
                    </li>
                        <strong>Segredos Ocultos:</strong><br>
                        "Já pensou no que acontece se você sair tocando e apertando nos planetas? Vai que acontece alguma coisa aí :D" 🤔
                    </li>
                </ul>
            </div>
        `;
    }
};

import * as THREE from 'three';
// [FIX] State injected via init to avoid module duplication issues
// import { state } from './GameState.js';

let appState = null;
let animationFrameId = null;
let lastRenderTime = 0;
let backgroundTimer = null;
let storedUpdateCallback = null;

const SLEEP_DELAY_MS = 10000;
const BACKGROUND_FPS = 15;
const MODAL_FPS = 30;

export const animationLoop = {
    /**
     * @param {Object} state - The shared game state
     * @param {Function} updateCallback - Function to call every frame (delta, now)
     */
    init: function (state, updateCallback) {
        appState = state;
        storedUpdateCallback = updateCallback;

        // Visibility Listeners
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('blur', () => this.handleVisibilityChange(false));
        window.addEventListener('focus', () => this.handleVisibilityChange(true));

        console.log("🎬 AnimationLoop: Initialized");
        this.start();
    },

    start: function () {
        if (!storedUpdateCallback) {
            console.error("AnimationLoop: Cannot start without an update callback!");
            return;
        }

        const animate = (now) => {
            if (appState.isSleeping) {
                animationFrameId = null;
                return;
            }

            animationFrameId = requestAnimationFrame(animate);

            // --- WATCHDOG (NaN check) ---
            if (appState.camera && (isNaN(appState.camera.position.x) || isNaN(appState.camera.position.y))) {
                console.error("🔥 AnimationLoop: Camera NaN detected. Resetting.");
                appState.camera.position.set(0, 200, 400); // [FIX] Consistent with initial view
                if (appState.controls) appState.controls.target.set(0, 0, 0);
            }

            // --- FPS LIMITER ---
            // If page is hidden or a heavy modal is open, we cap the FPS to save resources
            const isCapped = !appState.isPageVisible || appState.isModalOpen;
            if (isCapped) {
                const limit = appState.isModalOpen ? MODAL_FPS : BACKGROUND_FPS;
                if (now - lastRenderTime < (1000 / limit)) return;
            }
            lastRenderTime = now;

            // --- DELTA TIME ---
            // We use THREE.Clock or a manual delta. state.clock is set in SceneManager.
            let delta = appState.clock.getDelta();
            if (delta > 0.1) delta = 0.1; // Clamp

            // --- UPDATE SIMULATION ---
            storedUpdateCallback(delta, now);

            // --- RENDER ---
            this.render();
        };

        if (appState.clock) appState.clock.getDelta(); // Clear delta before starting
        appState.isSleeping = false;
        lastRenderTime = performance.now();
        animate(lastRenderTime);
        console.log("▶️ AnimationLoop: Loop Started");
    },

    render: function () {
        if (appState.controls && appState.controls.enabled) {
            appState.controls.update();
        }

        // Bloom Composer Priority
        if (appState.composer) {
            appState.composer.render();
        } else if (appState.renderer) {
            appState.renderer.render(appState.scene, appState.camera);
        }

        // Labels
        if (appState.labelRenderer) {
            appState.labelRenderer.render(appState.scene, appState.camera);
        }
    },

    handleVisibilityChange: function (forcedState = null) {
        const newState = forcedState !== null ? forcedState : !document.hidden;

        if (appState.isPageVisible === newState) return;
        appState.isPageVisible = newState;

        console.log(`📡 AnimationLoop: Visibility -> ${appState.isPageVisible ? 'VISIBLE' : 'HIDDEN'}`);

        if (appState.isPageVisible) {
            // Wake Up
            if (backgroundTimer) clearTimeout(backgroundTimer);
            backgroundTimer = null;
            if (appState.isSleeping) this.toggleSleep(false);
        } else {
            // Potential Sleep
            if (backgroundTimer) clearTimeout(backgroundTimer);
            backgroundTimer = setTimeout(() => {
                this.toggleSleep(true);
            }, SLEEP_DELAY_MS);
        }
    },

    toggleSleep: function (shouldSleep) {
        if (shouldSleep) {
            if (!appState.isSleeping) {
                console.log("💤 AnimationLoop: Entering Deep Sleep");
                appState.isSleeping = true;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        } else {
            if (appState.isSleeping) {
                console.log("🌞 AnimationLoop: Waking Up");
                appState.isSleeping = false;
                this.start();
            }
        }
    }
}; export function initAnimationLoop(state, updateCallback) {
    animationLoop.init(state, updateCallback);
}

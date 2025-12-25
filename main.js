import * as THREE from 'three';
import { state, loadEggs } from './modules/GameState.js?v=2';
import { initInput, focusOnPlanet, setupLabelInteraction, highlightBody } from './modules/InputManager.js?v=2';
import { audioManager } from './modules/AudioManager.js?v=2';
import {
    initUI, setupMenu, setupTimeControls, showChromeWarning,
    closeActiveModal, updateInfoPanel, closeInfo, showEasterToast, toggleMoonCheese
} from './modules/UIManager.js?v=2';
import { sceneManager } from './modules/SceneManager.js?v=2';
import { initSpaceFactory, createSystem, createStars, createAsteroidBelts, createFluminensePlanet } from './modules/SpaceFactory.js?v=2';
import { initAnimationLoop } from './modules/AnimationLoop.js?v=2';
import { simulationManager, initSimulation, updateSimulation } from './modules/SimulationManager.js?v=2';

// --- INITIAL STATE ---
state.eggsFound = loadEggs();
state.clock = new THREE.Clock();

// --- EXPOSE FOR CONSOLE/DEBUG ---
window.solarSystem = {
    get celestialBodies() { return state.celestialBodies; },
    focusOnPlanet: (name) => {
        const body = state.celestialBodies.find(b => b.data && b.data.name === name);
        if (body) focusOnPlanet(body);
    },
    getCamera: () => state.camera
};

// --- APP INITIALIZATION ---
function initApp() {
    // 1. Scene Setup
    sceneManager.init(state);

    // 2. Solar System Content
    initSpaceFactory(state, () => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 800);
        }
    });

    createStars();
    createAsteroidBelts();
    createSystem();

    // 3. Module Initialization
    initInput(state, {
        focusOnPlanet,
        highlightBody,
        setupLabelInteraction,
        closeInfo,
        toggleAudio: () => audioManager.toggle(),
        updateInfoPanel,
        closeActiveModal,
        createFluminensePlanet,
        showEasterToast,
        toggleTimePause: () => simulationManager.toggleTimePause()
    });

    initUI(state, {
        startExplosion: () => simulationManager.startExplosion(),
        resetSolarSystem: () => simulationManager.resetSolarSystem(),
        highlightBody,
        toggleMoonCheese
    });

    setupMenu();
    setupTimeControls();
    audioManager.init();

    window.addEventListener('resize', () => simulationManager.handleWindowResize());

    // Initial Checks
    // showChromeWarning(); // Disabled

    // 4. Update Loop
    console.log("🚀 Starting Simulation Loop...");
    initSimulation(state);
    simulationManager.init(state);

    initAnimationLoop(state, (delta, now) => updateSimulation(delta, now));
}

initApp();
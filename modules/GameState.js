// modules/GameState.js

export const state = {
    // --- SCENE OBJECTS (Set by SceneManager) ---
    scene: null,
    camera: null,
    renderer: null,
    labelRenderer: null,
    controls: null,
    composer: null,
    sunLight: null,

    // --- SOLAR SYSTEM DATA ---
    celestialBodies: [],
    asteroidSystem: null,
    kuiperSystem: null,

    // --- INTERACTION STATE ---
    focusedBody: null,
    hoveredBody: null,

    // --- UI FLAGS ---
    isPageVisible: true,
    isHoveringLabel: false,
    isSleeping: false,
    isInteractingWithUI: false,  // Block 3D interaction
    isModalOpen: false,          // Heavy modal open (FPS cap)

    // --- EASTER EGGS ---
    eggsFound: { pluto: false, moon: false, fluminense: false },
    isCheeseMode: false,

    // --- TIME & PHYSICS ---
    // 1.0 = 1 day per frame (approx 60 days/sec) - Default OLD
    // New Logic: 1/86400 = Real Time (1 sec/sec)
    timeScale: 1 / 86400,
    isRealTime: true,
    isTimePaused: false,
    currentDate: new Date(),
    currentYearAstronomical: null, // For +5 Billion years
    clock: null, // Will be set in main

    // --- EXPLOSION STATE ---
    explosionActive: false,
    explosionPhase: 0, // 0: Stable, 1: Expansion, 3: Fade-out
    whiteDwarfMesh: null,

    // --- FLIGHT & NAVIGATION ---
    isFlying: false,
    flightStartTime: 0,
    flightDuration: 1000,
    flightStartPos: null, // Will be set in main
    flightEndPos: null,
    flightStartTarget: null,
    flightEndTarget: null
};

// --- PERSISTENCE HELPERS ---
export function loadEggs() {
    try {
        const saved = localStorage.getItem('solar_system_eggs');
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log("📂 Eggs loaded from storage:", parsed);
            state.eggsFound = parsed;
            return parsed;
        }
    } catch (e) { console.warn("Erro ao carregar eggs:", e); }
    return { pluto: false, moon: false, fluminense: false };
}

export function saveEggs() {
    try {
        localStorage.setItem('solar_system_eggs', JSON.stringify(state.eggsFound));
        console.debug("💾 Eggs saved to localStorage:", state.eggsFound);
    } catch (e) { console.warn("Erro ao salvar eggs:", e); }
}

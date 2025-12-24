import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { solarSystemData } from './planet-data.js?v=33';
import { textureGenerator } from './texture-generator.js';

// --- VISIBILITY & PERFORMANCE MANAGER ---
let isPageVisible = true;
// hoverTimer declared at line 956
let isHoveringLabel = false; // Flag to prevent raycaster interference
let isSleeping = false;
let backgroundTimer = null;
let animationFrameId = null;
let lastRenderTime = 0;
let lastTime = performance.now(); // For FPS calculation
const SLEEP_DELAY_MS = 10000; // Reduzido para 10s para o usuário sentir a economia
const BACKGROUND_FPS = 15; // Aumentado para 15 FPS para manter fluidez mínima no fundo
const UI_FPS = 60; // Aumentado para 60 FPS para máxima fluidez em PCs potentes
let isInteractingWithUI = false; // Flag para bloquear tudo quando menu/modal estiver aberto
let isModalOpen = false; // Flag específica para modais (que travam tudo)
let selectedMenuItemIndex = -1; // Para navegação por teclado 

// --- LÓGICA DE DIGITAÇÃO & ESTADO DOS EASTER EGGS ---
let typedBuffer = "";
let isTypingLocked = false;
let typingLockTimer = null;

function loadEggs() {
    try {
        const saved = localStorage.getItem('solar_system_eggs');
        if (saved) {
            const parsed = JSON.parse(saved);
            console.log("📂 Eggs loaded from storage:", parsed);
            return parsed;
        }
    } catch (e) { console.warn("Erro ao carregar eggs:", e); }
    return { pluto: false, moon: false, fluminense: false };
}

function saveEggs() {
    try {
        localStorage.setItem('solar_system_eggs', JSON.stringify(eggsFound));
        console.debug("💾 Eggs saved to localStorage:", eggsFound);
    } catch (e) { console.warn("Erro ao salvar eggs:", e); }
}

let eggsFound = loadEggs();
let eggResetTimer = null;
let eggResetToast = null;

function toggleTimePause() {
    isTimePaused = !isTimePaused;
    const pauseBtn = document.getElementById('pause-time-btn');
    if (!pauseBtn) return;

    if (isTimePaused) {
        pauseBtn.innerText = 'Retomar Tempo';
        pauseBtn.classList.add('paused');
    } else {
        pauseBtn.innerText = 'Pausar Tempo';
        pauseBtn.classList.remove('paused');
    }
}

// --- KEYBOARD BLOCKER & UI NAVIGATOR ---
// Capturing listener to handle UI interaction BEFORE any other logic (like OrbitControls)
const handleGlobalKeyDown = (e) => {
    // --- LÓGICA DE DIGITAÇÃO (FLUMINENSE) ---
    if (e.key.length === 1) {
        typedBuffer += e.key.toLowerCase();
        if (typedBuffer.length > 15) typedBuffer = typedBuffer.substring(typedBuffer.length - 15);

        // [FIX] Resetar buffer após 2s de inatividade para não travar o 'M' para sempre
        if (window._bufferResetTimer) clearTimeout(window._bufferResetTimer);
        window._bufferResetTimer = setTimeout(() => {
            typedBuffer = "";
            isTypingLocked = false;
        }, 3000);

        // Se começar com "flu", bloqueamos teclas de atalho
        if (typedBuffer.includes("flu")) {
            if (!isTypingLocked) console.log("⚽ FLUMINENSE DETECTADO: Bloqueando I/M...");
            isTypingLocked = true;
        } else {
            // Se o que foi digitado NÃO contém "flu", liberamos o bloqueio imediatamente
            isTypingLocked = false;
        }

        // GATILHO FINAL
        if (typedBuffer.endsWith("flamengo") || typedBuffer.endsWith("vasco") || typedBuffer.endsWith("botafogo")) {
            console.log("🤣 Rival detected: " + typedBuffer);
            if (window.RPOD && window.RPOD.showRPOD) {
                // Mensagem personalizada para a zueira notificada pelo usuário
                const msg = "ERRO CRÍTICO: Time Pequeno Detectado. Por favor, insira um time grande.";
                window.RPOD.showRPOD(msg, "Sistema", 0, 0, new Error("ExcecaoTimeRival: TimeDeBaixaQualidadeDetectado"));
            }
            typedBuffer = ""; // Resetar buffer para evitar múltiplas chamadas
        }

        if (typedBuffer.includes("fluminense")) {
            // [FIX] Prevenir duplicação
            const alreadyExists = celestialBodies.some(b => b.isEasterEgg && b.data.name === "Fluminense");
            if (alreadyExists) {
                console.log("🏆 Fluminense já está em campo!");
                typedBuffer = ""; // Limpar buffer
                isTypingLocked = false;
                return;
            }

            // [FIX] Garantir que o jogo RODE para mostrar o planeta girando
            if (isTimePaused) toggleTimePause();
            if (isModalOpen) closeActiveModal();
            isInteractingWithUI = false;

            console.log("🏆 VENCE O FLUMINENSE! Easter Egg Ativado.");
            const fluPlanet = createFluminensePlanet();

            // Som de segredo apenas na primeira descoberta
            if (!eggsFound.fluminense) {
                audioManager.playSecretAction('fluminense');
            } else {
                // Se já descoberto, só faz um toast simples ou som curto
                if (audioManager.playHover) audioManager.playHover();
            }

            // Focar após um pequeno delay para garantir que o objeto está no mundo
            // setTimeout(() => { if (fluPlanet) focusOnPlanet(fluPlanet); }, 100); // ❌ REMOVIDO: Não focar automaticamente

            typedBuffer = "";
            isTypingLocked = false;
            if (typingLockTimer) clearTimeout(typingLockTimer);
        }
    }

    // [FIX] Se estivermos digitando um segredo ("flu..."), IMPEDIR qualquer outro comando
    // Isso evita que a tecla 'E' mova a câmera ou 'M' mute a música enquanto se digita "fluminense"
    if (isTypingLocked) return;

    // 1. Always track key state for general physics/zoom
    keyState[e.code] = true;

    // --- ATALHOS GLOBAIS PRIORITÁRIOS (Funcionam SEMPRE) ---

    // Atalho para Música (M) - No topo para ignorar bloqueios de UI
    if (e.code === 'KeyM' || e.key.toLowerCase() === 'm') {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log("🎶 Toggle Music via Keyboard (M/m)");
        if (audioManager) audioManager.toggle();
        return;
    }

    // Atalhos para Navegação de Música (Vírgula e Ponto)
    if (e.key === ',' || e.key === '<') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (audioManager) audioManager.prevTrack();
        return;
    }
    if (e.key === '.' || e.key === '>') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (audioManager) audioManager.nextTrack();
        return;
    }

    // --- BLOQUEIO GLOBAL DE NAVEGAÇÃO SE UI ESTIVER ABERTA ---
    if (isInteractingWithUI || isModalOpen) {
        // Navigation keys for Menu or Modals
        if (e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
            const infoMenu = document.getElementById('info-menu');
            if (infoMenu && !infoMenu.classList.contains('hidden')) {
                const items = Array.from(document.querySelectorAll('.info-menu-item'));
                if (e.code === 'ArrowDown') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    selectedMenuItemIndex = (selectedMenuItemIndex + 1) % items.length;
                    updateMenuSelection(items);
                    return;
                } else if (e.code === 'ArrowUp') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    selectedMenuItemIndex = (selectedMenuItemIndex - 1 + items.length) % items.length;
                    updateMenuSelection(items);
                    return;
                } else if (e.code === 'Enter' && selectedMenuItemIndex !== -1) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    items[selectedMenuItemIndex].click();
                    return;
                }
            }

            // Enter/Espaço para fechar modais
            if ((e.code === 'Enter' || e.code === 'Space') && isModalOpen) {
                const closeBtn = document.getElementById('close-modal-btn');
                if (closeBtn) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    closeBtn.click();
                    return;
                }
            }

            // Escape Handler
            if (e.code === 'Escape') {
                e.preventDefault(); e.stopImmediatePropagation();
                console.log("🔒 ESC Pressed - Closing UI");

                if (isModalOpen) {
                    closeActiveModal();
                } else if (infoMenu && !infoMenu.classList.contains('hidden')) {
                    infoMenu.classList.add('hidden');
                    isInteractingWithUI = false;
                    if (controls) {
                        controls.enabled = true;
                        controls.enableKeys = true;
                    }
                } else if (focusedBody) {
                    closeInfo();
                }
                return;
            }

            // General block for arrows/space when reading/navigating UI
            if (e.code.startsWith('Arrow') || e.code === 'Space') {
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }
    }

    // --- ATALHOS GLOBAIS (APENAS QUANDO UI ESTÁ FECHADA OU ESPECÍFICOS) ---

    // 1. Menu de Teclado / Info (I)
    if (e.code === 'KeyI' && !isModalOpen) {
        e.preventDefault();
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) infoBtn.click();
    }

    // 3. Zoom (Z/X)
    if (!isInteractingWithUI && !isModalOpen) {
        if (e.code === 'KeyZ') {
            const dist = camera.position.distanceTo(controls.target);
            if (dist > controls.minDistance) {
                const moveDir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
                camera.position.add(moveDir.multiplyScalar(dist * 0.1));
                controls.update();
            }
        } else if (e.code === 'KeyX') {
            const dist = camera.position.distanceTo(controls.target);
            if (dist < controls.maxDistance) {
                const moveDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                camera.position.add(moveDir.multiplyScalar(dist * 0.1));
                controls.update();
            }
        }
    }

    // --- LÓGICA DE RESET DE EASTER EGGS (DEL por 5s) ---
    if (e.code === 'Delete') {
        const hasAnyEgg = Object.values(eggsFound).some(v => v === true);
        if (hasAnyEgg && !eggResetTimer) {
            console.log("🔥 Iniciando contagem de reset (5s)...");
            eggResetToast = document.createElement('div');
            eggResetToast.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: rgba(255, 50, 50, 0.9);
                color: white; padding: 15px 25px; border-radius: 10px; border: 2px solid white;
                font-family: 'Exo 2', sans-serif; font-weight: bold; z-index: 12000;
                box-shadow: 0 0 20px rgba(0,0,0,0.5); text-align: center;
            `;
            eggResetToast.innerHTML = '🔥 Mantenha DEL pressionado para resetar segredos... (5s)';
            document.body.appendChild(eggResetToast);
            let secondsLeft = 5;
            eggResetTimer = setInterval(() => {
                secondsLeft--;
                if (eggResetToast) eggResetToast.innerHTML = `🔥 Mantenha DEL pressionado para resetar segredos... (${secondsLeft}s)`;
                if (secondsLeft <= 0) {
                    clearInterval(eggResetTimer);
                    eggResetTimer = null;
                    eggsFound = { pluto: false, moon: false, fluminense: false };
                    saveEggs(); // Persistência imediata
                    playResetSound();
                    if (eggResetToast) {
                        eggResetToast.style.background = 'rgba(0, 255, 100, 0.9)';
                        eggResetToast.innerHTML = '✨ Segredos resetados com sucesso!';
                        setTimeout(() => { if (eggResetToast) eggResetToast.remove(); eggResetToast = null; }, 2000);
                    }
                    console.log("✨ Easter Eggs Resetados!");
                }
            }, 1000);
        }
    }
};

window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
window.addEventListener('keyup', (e) => {
    keyState[e.code] = false;

    // Cancelar Reset se soltar DEL
    if (e.code === 'Delete' && eggResetTimer) {
        console.log("❌ Reset cancelado pelo usuário.");
        clearInterval(eggResetTimer);
        eggResetTimer = null;
        if (eggResetToast) {
            eggResetToast.remove();
            eggResetToast = null;
        }
    }
}, { capture: true });

function updateMenuSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedMenuItemIndex) {
            item.classList.add('selected');
            audioManager.playHover();
        } else {
            item.classList.remove('selected');
        }
    });
}


document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('blur', () => handleVisibilityChange(false));
window.addEventListener('focus', () => handleVisibilityChange(true));

function handleVisibilityChange(forcedState = null) {
    const newState = forcedState !== null ? forcedState : !document.hidden;

    // Only act if state actually changed
    if (isPageVisible === newState) return;

    isPageVisible = newState;
    console.log(`Visibility Changed: ${isPageVisible ? 'VISIBLE' : 'HIDDEN/BLURRED'}`);

    if (isPageVisible) {
        // WAKE UP from Tab Switch
        if (backgroundTimer) clearTimeout(backgroundTimer);
        backgroundTimer = null;

        // Se a UI NÃO estiver bloqueando, acordamos tudo
        if (!isInteractingWithUI) {
            toggleDeepSleep(false);
        }
    } else {
        // GOING BACKGROUND
        // Start timer for deep sleep
        if (backgroundTimer) clearTimeout(backgroundTimer);
        backgroundTimer = setTimeout(() => {
            console.log("💤 Entering Tab Background Sleep Mode");
            toggleDeepSleep(true);
        }, SLEEP_DELAY_MS);
    }
}

// --- DEEP SLEEP MANAGER ---
function toggleDeepSleep(shouldSleep) {
    if (shouldSleep) {
        if (!isSleeping) {
            console.log("🛑 STOPPING RENDER LOOP (Deep Sleep)");
            isSleeping = true;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    } else {
        if (isSleeping) {
            console.log("▶️ RESUMING RENDER LOOP");
            isSleeping = false;
            lastTime = performance.now();
            animate();
        }
    }
}

// --- AUDIO MANAGER ---
const audioManager = {
    playlist: [
        'assets/musics/Aria Math.mp3',
        'assets/musics/Droppy likes your Face.mp3',
        'assets/musics/The Guardian of The Threshold.mp3'
    ],
    currentIndex: 0,
    element: null,
    btn: null,
    hoverPool: [],
    hoverPoolIndex: 0,
    hoverPoolSize: 6, // Pool de 6 canais para latência zero
    init: function () {
        this.element = document.getElementById('bg-music');
        this.btn = document.getElementById('audio-btn');
        if (!this.element || !this.btn) {
            console.warn("Audio elements not found during init!");
            return;
        }

        // Pre-load hover sounds pool
        this.hoverPool = [];
        for (let i = 0; i < this.hoverPoolSize; i++) {
            const audio = new Audio('assets/sound_effects/click.mp3');
            audio.volume = 1.0;
            audio.load();
            this.hoverPool.push(audio);
        }

        this.discoverTracks();
        this.initSpecialAssets();

        this.element.loop = false; // Garantir que o navegador não repita a faixa sozinho
        this.element.addEventListener('ended', () => this.nextTrack());
        this.element.addEventListener('error', (e) => {
            console.warn("Audio Error, skipping:", this.playlist[this.currentIndex]);
            this.nextTrack();
        });

        this.element.src = this.playlist[0];
    },

    activeSecretAudio: null,
    discoveryAssets: [],
    discoveryQueue: [],

    playHover: function () {
        const sound = this.hoverPool[this.hoverPoolIndex];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => { });
            this.hoverPoolIndex = (this.hoverPoolIndex + 1) % this.hoverPoolSize;
        }
    },
    playSecretAction: function (category = 'pluto') {
        if (category === 'moon') {
            // Silêncio total para a Lua (por enquanto)
            return;
        }
        if (category === 'fluminense') {
            console.log("🎺 Fluminense! Usando som de descoberta aleatório...");
            // Como o usuário não colocou áudio específico, usamos o pool de descobertas normal
            eggsFound.fluminense = true;
            saveEggs();
            showEasterToast("Fluminense encontrado"); // Notificação Sutil

            // Toca um dos sons do pool 'eita' se disponível
            // this.playSecretAction('pluto'); // REMOVIDO: Não tocar áudio do Plutão aqui.
            return;
        }
        // REMOVIDO BLOQUEIO DE PLUTÃO: O som deve tocar justamente na descoberta!
        // if (category === 'pluto' && !eggsFound.pluto) {
        //     return;
        // }

        if (this.activeSecretAudio && !this.activeSecretAudio.paused && !this.activeSecretAudio.ended) {
            return;
        }

        if (this.discoveryQueue.length === 0) {
            let sourceList = this.discoveryAssets;
            this.discoveryQueue = [...sourceList];
            for (let i = this.discoveryQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.discoveryQueue[i], this.discoveryQueue[j]] = [this.discoveryQueue[j], this.discoveryQueue[i]];
            }
        }

        const nextSound = this.discoveryQueue.pop();
        const soundToPlay = nextSound.audio.cloneNode();
        soundToPlay.volume = 1.0;
        this.activeSecretAudio = soundToPlay;

        soundToPlay.play().catch(e => {
            console.warn("Secret action playback FAILED:", e);
        });
    },
    initSpecialAssets: function () {
        const sources = [
            'assets/sound_effects/eita/caramba.mp3',
            'assets/sound_effects/eita/puts.mp3',
            'assets/sound_effects/eita/vish.mp3',
            'assets/sound_effects/eita/rapaz.mp3',
            'assets/sound_effects/eita/coitado.mp3',
            'assets/sound_effects/eita/nossa.mp3',
            'assets/sound_effects/eita/vixi.mp3'
        ];

        this.discoveryAssets = sources.map(src => {
            const audio = new Audio(src);
            audio.load();
            return { src, audio };
        });
    },
    discoverTracks: function () {
        // this.playlist reassignment removed - defined in object property
        this.element.src = this.playlist[0];
    },
    toggle: function () {
        if (this.element.paused) {
            this.element.play().then(() => {
                this.btn.innerText = '🔇 Pausar';
            }).catch(e => console.warn("Play failed:", e));
        } else {
            this.element.pause();
            this.btn.innerText = '🔈 Música';
        }
    },
    showMusicToast: function () {
        // Remover toast antigo se existir para evitar sobreposição (BUG FIX)
        const existingToast = document.getElementById('music-toast');
        if (existingToast) existingToast.remove();

        // Extrair nome e formatar (Ex: Aria Math - C418)
        let rawName = this.playlist[this.currentIndex].split('/').pop().replace(/%20/g, ' ').replace('.mp3', '');

        // Mapa de nomes bonitos para exibição
        const prettyNames = {
            'Aria Math': 'Aria Math - C418',
            'Droppy likes your Face': 'Droopy likes your Face - C418',
            'Droopy likes your Face': 'Droopy likes your Face - C418', // Caso corrija o arquivo
            'The Guardian of The Threshold': 'The Guardian of The Threshold - I Think I Can Help You'
        };

        const songName = prettyNames[rawName] || (rawName + ' - Unknown Author');

        const toast = document.createElement('div');
        toast.id = 'music-toast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 20px; background: rgba(0, 20, 40, 0.82);
            color: #00ccff; padding: 12px 25px; border-radius: 8px; border: 1px solid #00ccff;
            font-family: 'Exo 2', sans-serif; z-index: 20000; pointer-events: none;
            box-shadow: 0 0 20px rgba(0, 204, 255, 0.2); transition: opacity 0.8s ease-out;
            opacity: 0;
        `;
        toast.innerText = '♪ Tocando: ' + songName;
        document.body.appendChild(toast);

        // Fade-in imediato
        requestAnimationFrame(() => toast.style.opacity = '1');

        // Fade-out após 3 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 800);
            }
        }, 3000);
    },
    nextTrack: function () {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.element.src = this.playlist[this.currentIndex];
        this.element.play().then(() => {
            this.btn.innerText = '🔇 Pausar';
            this.showMusicToast();
        }).catch(e => console.warn("Skip error:", e));
    },
    prevTrack: function () {
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.element.src = this.playlist[this.currentIndex];
        this.element.play().then(() => {
            this.btn.innerText = '🔇 Pausar';
            this.showMusicToast();
        }).catch(e => console.warn("Skip error:", e));
    }
};

// --- BROWSER NOTIFICATION ---
function showChromeWarning() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if (isChrome) {
        // Only show if not already showing
        if (document.querySelector('.chrome-warning-toast')) return;

        const toast = document.createElement('div');
        toast.className = 'chrome-warning-toast';
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(255, 50, 50, 0.9)';
        toast.style.color = 'white';
        toast.style.padding = '15px 25px';
        toast.style.borderRadius = '10px';
        toast.style.border = '2px solid white';
        toast.style.fontFamily = 'Exo 2, sans-serif';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = '11000'; // Above FPS
        toast.style.textAlign = 'center';
        toast.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
        toast.innerHTML = '⚠️ Desempenho Baixo: Recomendamos o uso do <strong>Microsoft Edge</strong> <br> se os travamentos persistirem no Chrome.';
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 1s, transform 1s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 1000);
        }, 10000);
    }
}

function showControlsToast(force = false) {
    if (!force && localStorage.getItem('solar_system_tutorial_shown')) return;

    // Remove existing tutorial if any
    const existing = document.querySelector('.controls-tutorial-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'controls-tutorial-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0, 150, 255, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '15px 25px';
    toast.style.paddingRight = '45px'; // Espaço para o botão fechar
    toast.style.borderRadius = '10px';
    toast.style.border = '2px solid white';
    toast.style.fontFamily = 'Exo 2, sans-serif';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '11000';
    toast.style.textAlign = 'center';
    toast.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    toast.style.lineHeight = '1.5';
    toast.style.backdropFilter = 'blur(5px)';

    const title = force ? '🎮 <strong>Guia de Controles</strong><br>' : '🚀 <strong>Bem-vindo ao Sistema Solar!</strong><br>';

    toast.innerHTML = title +
        'Mova a câmera: <strong>WASD</strong> ou <strong>Setas</strong><br>' +
        'Orbitar: Segure o <strong>Botão Esquerdo</strong> e arraste<br>' +
        'Zoom: Use o <strong>Scroll</strong> do mouse' +
        '<button id="close-toast" style="position:absolute; top:5px; right:5px; background:transparent; border:none; color:white; font-size:1.2rem; cursor:pointer;">&times;</button>';

    document.body.appendChild(toast);

    document.getElementById('close-toast').onclick = () => {
        toast.remove();
    };

    localStorage.setItem('solar_system_tutorial_shown', 'true');

    const timeout = setTimeout(() => {
        if (toast.parentNode) {
            toast.style.transition = 'opacity 1s, transform 1s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }
    }, 15000);
}

// --- TYPEWRITER EFFECT UTILITY (PARALLEL & FADE) ---
async function typeWriter(element, htmlContent, speed = 10, onComplete) {
    if (element._cancelTyping) element._cancelTyping();
    element.innerHTML = '';

    let isCancelled = false;
    element._cancelTyping = () => { isCancelled = true; };

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const children = Array.from(tempDiv.childNodes);

    // Creates a structure in the real element matching the temp layout
    // Returns a list of "Text Typing Tasks" to run in parallel
    const prepareStructure = (sourceNode, targetNode) => {
        const tasks = [];

        if (sourceNode.nodeType === Node.TEXT_NODE) {
            const content = sourceNode.textContent;
            if (content.trim() === '') {
                targetNode.appendChild(document.createTextNode(content));
                return [];
            }

            // --- SINCRONISMO ABSOLUTO VIA CSS ---
            // Dividimos por pontuações e cada "pedaço" terá seu próprio loop de delays
            // resultando em múltiplos pontos de digitação simultâneos.
            const parts = content.match(/.*?[.!,?;:()\[\]\-]+|[^.!,?;:()\[\]\-]+/g) || [content];

            parts.forEach((partText) => {
                const partWrapper = document.createElement('span');
                partWrapper.className = 'sentence-wrapper';
                partWrapper.style.display = 'inline';
                targetNode.appendChild(partWrapper);

                // Injetamos todos os caracteres IMEDIATAMENTE.
                // O navegador cuidará da animação via CSS delay.
                const chars = [...partText];
                chars.forEach((char, i) => {
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.className = 'char-fade';
                    // IMPORTANTE: Cada segmento REINICIA o i, logo todos os primeiros 
                    // caracteres dos segmentos começam com delay 0ms (SIMULTÂNEOS!)
                    span.style.animationDelay = `${i * speed}ms`;
                    partWrapper.appendChild(span);
                });

                // Apenas uma promessa para saber quando este pedaço terminou
                tasks.push(() => new Promise(resolve => {
                    setTimeout(resolve, (chars.length * speed) + 300);
                }));
            });
            return tasks;

        } else if (sourceNode.nodeType === Node.ELEMENT_NODE) {
            const newEl = document.createElement(sourceNode.tagName);
            Array.from(sourceNode.attributes).forEach(attr => newEl.setAttribute(attr.name, attr.value));
            targetNode.appendChild(newEl);

            Array.from(sourceNode.childNodes).forEach(child => {
                tasks.push(...prepareStructure(child, newEl));
            });
        }
        return tasks;
    };

    const allTasks = [];
    children.forEach(child => {
        allTasks.push(...prepareStructure(child, element));
    });

    await Promise.all(allTasks.map(task => task()));

    if (!isCancelled && onComplete) onComplete();
}

function closeActiveModal() {
    if (audioManager) audioManager.playHover();
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    // Check if we should restore the menu (Standard Modals)
    const titleEl = overlay.querySelector('h2');
    const title = titleEl ? titleEl.innerText : '';
    const shouldRestoreMenu = title.includes('SOBRE') || title.includes('CONTROLE') || title.includes('ATALHOS') || title.includes('PLANETAS') || title.includes('CRÉDITOS') || title.includes('EASTER');

    // Cancel typing
    const contentArea = document.getElementById('modal-content-area');
    if (contentArea && contentArea._cancelTyping) contentArea._cancelTyping();

    // Visual feedback
    overlay.classList.remove('active');

    // Physical cleanup
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();

        // FIX: Menu Focus Lost (Race Condition)
        // Only unlock specific states if the MENU is NOT open
        const infoMenu = document.getElementById('info-menu');

        if (shouldRestoreMenu && infoMenu) {
            infoMenu.classList.remove('hidden'); // Restore Menu
            isInteractingWithUI = true; // Keep UI locked for Menu
            // Highlight About/Shortcuts/etc? Optional.
        }

        const isMenuOpen = infoMenu && !infoMenu.classList.contains('hidden');

        if (!isMenuOpen) {
            isInteractingWithUI = false; // RELEASE LOCK
            if (typeof controls !== 'undefined' && controls) controls.enabled = true;
        } else {
            // If menu is open, ensure we are still in "Menu Mode"
            // (isInteractingWithUI stays true)
        }

        isModalOpen = false; // VOLTA FPS NORMAL (Modais pesados fecharam)
        document.body.classList.remove('modal-blur'); // Remove efeito visual
        // Reiniciar controles se não estiver focado em nada
        if (!focusedBody && controls) controls.enabled = true;
    }, 300);
}

function createInfoModal(title, contentHTML, btnText = 'Entendi!') {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Create Modal container
    const modal = document.createElement('div');
    modal.className = 'info-modal';

    // Structure with Empty Content Div and Action Container
    modal.innerHTML = `
        <h2 style="color: #00ccff; margin-bottom: 20px; font-size: 1.8rem; text-align: center; text-shadow: 0 0 10px rgba(0, 204, 255, 0.5);">${title}</h2>
        <div id="modal-content-area" style="line-height: 1.6; font-size: 1rem; min-height: 100px;"></div>
        <div id="modal-action-area" style="text-align: center; margin-top: 30px; opacity: 0; transition: opacity 0.5s;">
            <button id="close-modal-btn" style="background: transparent; border: 1px solid #00ccff; color: #00ccff; padding: 10px 30px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s;">${btnText}</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger Entry Animation (CSS handles opacity transition on overlay)
    requestAnimationFrame(() => overlay.classList.add('active'));

    isInteractingWithUI = true; // Bloqueia clicks no fundo
    isModalOpen = true; // Ativa cap de 15 FPS e pausa tempo
    document.body.classList.add('modal-blur'); // Efeito visual bonito
    document.body.style.cursor = 'default'; // Reset cursor


    // Limpar estados de hover/seleção ao abrir UI
    if (hoveredBody) {
        highlightBody(hoveredBody, false);
        hoveredBody = null;
    }
    // [FIX] NÃO esconder o painel de info ao abrir modal
    // const infoPanel = document.getElementById('info-panel');
    // if (infoPanel) infoPanel.classList.add('hidden');

    // Bloquear interações com o sistema solar enquanto o modal estiver aberto
    if (controls) controls.enabled = false;

    // Attach Close Logic
    const closeBtn = document.getElementById('close-modal-btn');
    closeBtn.onclick = closeActiveModal;

    closeBtn.onmouseover = () => {
        audioManager.playHover();
        closeBtn.style.background = 'rgba(0, 204, 255, 0.1)';
        closeBtn.style.boxShadow = '0 0 10px rgba(0, 204, 255, 0.3)';
    };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'transparent'; closeBtn.style.boxShadow = 'none'; };

    // Start Typewriter
    const contentDiv = document.getElementById('modal-content-area');
    typeWriter(contentDiv, contentHTML, 10, () => {
        const actionArea = document.getElementById('modal-action-area');
        if (actionArea) actionArea.style.opacity = '1';
    });
}

function showAboutProject() {
    const html = `
        <p>Esse é um sistema solar que eu criei porque simplesmente deu vontade de criar, pois... é, eu simplesmente quis kkkkkkkkkkk</p>
        
        <p>Nele você poderá interagir com os nossos planetas, desde Mercúrio até o planeta-anão Plutão, poderá ver sobre a nossa Lua, o nosso Sol e até mesmo vê-lo se expandindo e se transformando na Gigante Vermelha.</p>
        
        <p>Em breve eu irei colocar novas funções, mecânicas, mais planetas e quem sabe expandir para o nível de poder ver as galáxias.</p>
        
        <p style="margin-top: 20px; font-size: 0.8em; color: #888; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">Data da última atualização: 24/12/2025</p>
        <p style="color: #666; font-size: 0.75em; padding-top: 5px;">
            ⚠️ <b>Performance:</b> Se notar lentidão (ex: 30 FPS parado), verifique se o Edge está em 
            "Modo de Eficiência" ou se a Aceleração de Hardware está ativada.
        </p>
    `;
    createInfoModal('📖 SOBRE O PROJETO', html);
}

function showCameraInfo() {
    const html = `
        <p>A navegação no vácuo espacial exige habilidade, mas é simples:</p>
        <ul style="padding-left: 20px;">
            <li><strong>Órbita</strong>: Clique e arraste com o <strong>Botão Esquerdo</strong> para girar em torno do alvo.</li>
            <li><strong>Voo Livre (Fly Mode)</strong>: Segure o <strong>Botão Direito</strong> e use <strong>WASD</strong> para voar livremente.</li>
            <li><strong>Zoom</strong>: Use o <strong>Scroll</strong> do mouse para se aproximar ou afastar.</li>
            <li><strong>Focar</strong>: Clique em qualquer astro para centralizar a câmera nele automaticamente.</li>
        </ul>
    `;
    createInfoModal('📸 CONTROLE DE CÂMERA', html);
}

function showPlanetsInfo() {
    const html = `
        <p>Interagindo com os astros:</p>
        <ul style="padding-left: 20px;">
            <li><strong>Dados Técnicos</strong>: Ao clicar em um planeta, o painel lateral exibe informações como tipo, translação e idade.</li>
            <li><strong>Manipulação do Tempo</strong>: O slider inferior permite acelerar os anos em segundos ou retroceder para ver alinhamentos passados.</li>
            <li><strong>Física e Detalhes</strong>: Observe a inclinação axial (Tilt) de cada planeta e o brilho atmosférico em mundos como a Terra e Vênus.</li>
        </ul>
    `;
    createInfoModal('🪐 PLANETAS E INTERAÇÃO', html);
}

function showKeyboardShortcuts() {
    const html = `
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px;">
            <p style="margin-bottom: 15px; border-bottom: 1px solid rgba(0,204,255,0.3); padding-bottom: 5px; color: #00ccff; font-weight: bold;">🌌 Navegação e Geral</p>
            <ul style="list-style: none; padding-left: 0;">
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">WASD / Setas</code> - Voar pelo espaço (Modo Fly)</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">Enter</code> - Confirmar / Selecionar Menu / Fechar Modal</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">Esc</code> - Abrir Menu / Voltar / Fechar Tudo</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">Space</code> - Parar Tudo / Girar Câmera</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">Z / X</code> - Zoom In / Out Direto</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">I</code> - Abrir/Fechar Menu Rápido</li>
            </ul>

            <p style="margin: 15px 0 10px 0; border-bottom: 1px solid rgba(0,204,255,0.3); padding-bottom: 5px; color: #00ccff; font-weight: bold;">🎵 Áudio e Segredos</p>
            <ul style="list-style: none; padding-left: 0;">
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">M</code> - Ligar / Pausar Música Ambiente</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">,</code> e <code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">.</code> - Voltar / Avançar Música</li>
                <li><code style="background: #333; padding: 2px 6px; border-radius: 4px; color: #ffcc00;">DEL (Segurar 5s)</code> - Reset Nuclear de Segredos (Brutal!)</li>
            </ul>
        </div>
    `;
    createInfoModal('⌨️ ATALHOS DO TECLADO', html);
}

// --- SUBTLE EASTER EGG TOAST ---
function showEasterToast(message = "Easter-egg encontrado") {
    // Remove anterior se existir
    const existing = document.querySelector('.easter-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'easter-toast';

    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>${message}</span>
            <span style="font-size:1.2em;">🎉</span>
        </div>
        <div class="toast-progress-container">
            <div class="toast-progress-bar"></div>
        </div>
    `;

    document.body.appendChild(toast);

    // Trigger Entry
    requestAnimationFrame(() => {
        toast.classList.add('active');
        // Start Progress
        const bar = toast.querySelector('.toast-progress-bar');
        if (bar) bar.classList.add('animate');
    });

    // Auto Remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('active'); // Fade out
            setTimeout(() => toast.remove(), 500); // Wait for transition
        }
    }, 3000);
}

function showEasterInfo(discoveredType = null) {
    // [FIX] Se for uma DESCOBERTA, usamos apenas o Toast Sutil
    if (discoveredType === 'pluto') {
        eggsFound.pluto = true;
        saveEggs();
        showEasterToast("Easter-egg de Plutão encontrado!");
        return;
    } else if (discoveredType === 'moon') {
        eggsFound.moon = true;
        saveEggs(); // Garantir salvo
        showEasterToast("Easter-egg da Lua encontrado!");
        return;
    } else if (discoveredType === 'fluminense') {
        // Fallback caso chamem por aqui
        eggsFound.fluminense = true;
        saveEggs();
        showEasterToast("Fluminense encontrado!");
        return;
    }

    // Se não tiver argumento, é o MENU (Mostra lista completa em Modal)
    let title = '🥚 EASTER EGGS';
    let html = '';

    // Generic View from Menu
    const foundCount = (eggsFound.pluto ? 1 : 0) + (eggsFound.moon ? 1 : 0) + (eggsFound.fluminense ? 1 : 0);

    if (foundCount === 0) {
        html = `
            <div style="text-align: center; font-size: 1.2rem; margin-top: 20px;">
                <p>Você consegue encontrar todos os segredos?</p>
                <p style="font-size: 2rem; letter-spacing: 5px;">👀👀👀👀👀👀👀👀👀👀</p>
            </div>
        `;
    } else {
        html = `
            <div style="text-align: center;">
                <div style="text-align: left; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; margin-top: 15px;">
                    <p>${eggsFound.pluto ? '✅ <strong>Plutão:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
                    <p>${eggsFound.moon ? '✅ <strong>Lua:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
                    <p>${eggsFound.fluminense ? '✅ <strong>Fluminense:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
                </div>
                ${foundCount < 3 ? '<p style="margin-top: 20px; color: #ffcc00;">Ainda falta segredo por aí... 👀</p>' : '<p style="margin-top: 20px; color: #00ff88;">Você é um mestre explorador! 🎉</p>'}
                </div>
            `;
    }

    let btnText = 'Entendi!';
    if (discoveredType === 'moon') btnText = 'Ebaaaaa e.e';
    if (discoveredType === 'pluto') btnText = "It's over :(";

    if (discoveredType === 'fluminense') {
        title = '🇭🇺 VENCE O FLUMINENSE!';
        html = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="assets/fluminense_logo.png" style="width: 80px; height: auto; filter: drop-shadow(0 0 10px #800000);" onerror="this.src='https://upload.wikimedia.org/wikipedia/pt/a/a3/Fluminense_FC_escudo.png'">
                </div>
                <p>Você descobriu o planeta dos <strong>Guerreiros</strong>!</p>
                <p style="color: #00ff88; font-weight: bold; margin: 15px 0;">"Sou Tricolor de Coração, sou do clube tantas vezes campeão!"</p>
                <p>O <strong>Planeta Fluminense</strong> possui uma órbita única e inclinada, cruzando o sistema solar com a garra de um campeão da Libertadores.</p>
            `;
    }

    createInfoModal(title, html, btnText);

    // Salvar estado sempre que houver mudança (inclusive reset)
    localStorage.setItem('solar_system_eggs', JSON.stringify(eggsFound));
}

function showCredits() {
    const html = `
        <p style="font-size: 1.1rem; text-align: center; margin-bottom: 20px;">Este projeto foi idealizado e desenvolvido por:</p>
        <div style="font-size: 2.8rem; font-weight: bold; text-align: center; color: #00ccff; text-shadow: 0 0 20px rgba(0, 204, 255, 0.8);">Jeb15Br</div>
        <p style="margin-top: 30px; color: #888; font-size: 0.9rem; text-align: center;">Tecnologias: Three.js | CSS2D | JavaScript Canvas</p>
    `;
    createInfoModal('💎 CRÉDITOS', html);
}

// REMOVED: showChromeWarning() call from global init to make it dynamic based on performance

// Global State
let scene, camera, renderer, labelRenderer, controls, composer;
let celestialBodies = [];
let asteroidSystem, kuiperSystem, sunLight;
// Time Scale Logic
// 1.0 = 1 day per frame (approx 60 days/sec) - OLD LOGIC
// NEW LOGIC: isRealTime flag controls default.
// timeScale here will represent "Days per Second" or similar multiplier.
// Actually, in animate: daysPerFrame = (1/60) * timeScale.
// So if timeScale = 1, we advance 1 day per second.
// If Real Time, we advance 1 second per second.
// 1 sec = 1/86400 days.
// So for real time, timeScale should be 1/86400.
let timeScale = 1 / 86400; // Default to Real Time
let isRealTime = true;
let isTimePaused = false;
let currentDate = new Date(); // Start "today" logic
let currentYearAstronomical = null; // Used for years beyond JS Date limits (e.g. 5 Billion)
const clock = new THREE.Clock();

let focusedBody = null;
let explosionActive = false;
let explosionPhase = 0; // 0: Stable, 1: Expansion, 3: Fade-out/White Dwarf
let whiteDwarfMesh = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredBody = null;
const keyState = {};

// --- PERSISTÊNCIA E ÁUDIO DE RESET ---



// Pool de Reset para Latência Zero e Pré-aquecimento
const resetSoundPool = [];
const resetPoolSize = 3;
for (let i = 0; i < resetPoolSize; i++) {
    const audio = new Audio('assets/sound_effects/reset.mp3');
    audio.volume = 0.8;
    audio.preload = 'auto';
    audio.load();
    resetSoundPool.push(audio);
}
let resetPoolIndex = 0;

function playResetSound() {
    const sound = resetSoundPool[resetPoolIndex];
    if (sound) {
        // MUITO IMPORTANTE: Sincronismo Absoluto
        // 1. Pulamos os primeiros 50ms que costumam ser silêncio de header no MP3
        sound.currentTime = 0.05;
        sound.play().catch(e => console.warn("Erro ao tocar reset sound:", e));
        resetPoolIndex = (resetPoolIndex + 1) % resetPoolSize;
    }
}

window.solarSystem = {
    get celestialBodies() { return celestialBodies; },
    focusOnPlanet: (name) => {
        const body = celestialBodies.find(b => b.data && b.data.name === name);
        if (body) focusOnPlanet(body);
    },
    getCamera: () => camera
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);
    addStarField();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.set(0, 100, 250);

    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
    });
    renderer.debug.checkShaderErrors = false; // SILENCE SHADER ERRORS (Safe if code is verified)
    renderer.shadowMap.enabled = false;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Padrao de cinema
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.classList.add('scene-layer'); // FIX DE LAYOUT
    document.body.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.classList.add('scene-layer'); // FIX DE LAYOUT
    labelRenderer.domElement.style.pointerEvents = 'none'; // Importante para clicar através
    document.body.appendChild(labelRenderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05; // Mais suave e organico
    controls.maxDistance = 5000;
    controls.minDistance = 0.1;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.2; // Reduzido para controle de precisao premium


    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    // --- ILUMINAÇÃO REFORMULADA (Contraste Dia/Noite) ---
    // Luz Ambiente: Reduzida para garantir escuridão no lado noturno
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
    scene.add(ambientLight);

    // Luz do Sol: Focada para brilho sem saturação extrema
    sunLight = new THREE.PointLight(0xffffff, 1.5, 3000);
    sunLight.decay = 0.0; // ALTERAÇÃO: Luz igual para todos os planetas (Decay 0)
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 256; // Mínimo possível para performance
    sunLight.shadow.mapSize.height = 256;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 1500;
    sunLight.shadow.bias = -0.001; // Ajustado bias para nova resolução
    scene.add(sunLight);

    const renderScene = new RenderPass(scene, camera);
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);

    // --- REATIVANDO BLOOM (BRILHO NEON) ---
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), // Otimização: Renderizar Bloom em meia resolução
        1.0,  // Strength contida para evitar saturação
        0.15, // Radius minimalista para não engolir planetas próximos
        0.8   // Threshold alto: apenas fontes de luz brilham
    );
    composer.addPass(bloomPass);
    // -------------------------------------

    createSystem();
    // REMOVIDO: Carregamento automático do Fluminense no init para evitar seleção indesejada e manter transitoriedade
    createAsteroidBelts();

    // Inicializar o AudioManager (agora que o DOM está pronto)
    audioManager.init();

    // --- FIX: LAYOUT SHIFT (PRO-MAX) ---
    // Fazemos múltiplos checks de redimensionamento para garantir que o Electron/Browser
    // estabilize as dimensões da janela após injetar os elementos no DOM.
    onWindowResize(); // Imediato
    setTimeout(onWindowResize, 0); // Próximo ciclo
    setTimeout(onWindowResize, 100); // Segurança
    setTimeout(onWindowResize, 500); // Final check (pulo visual zero)

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick); // RESTORED: Core interaction logic
    // --- MAIN EVENT LISTENERS ---
    const infoMenu = document.getElementById('info-menu');
    const infoBtn = document.getElementById('info-btn');

    // Central keydown logic is now handled globally via handleGlobalKeyDown



    // 2. Right Click (Context Menu)
    renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        if (infoMenu && !infoMenu.classList.contains('hidden')) {
            console.log("🖱️ Right Click -> Closing Info Menu");
            infoMenu.classList.add('hidden');
            isInteractingWithUI = false;
            if (controls) {
                controls.enabled = true;
                controls.enableKeys = true; // Restaurar teclas
            }
        } else if (document.querySelector('.info-modal-toast')) {
            console.log("🖱️ Right Click -> Closing Modal");
            closeActiveModal();
        } else if (focusedBody) {
            closeInfo();
        }
    });

    // 3. Click Outside to close Info Menu
    window.addEventListener('click', (e) => {

        // Let normal click logic (selection) run FIRST.
        // Then check if we need to close menu.
        if (infoMenu && !infoMenu.classList.contains('hidden')) {
            if (!infoMenu.contains(e.target) && e.target !== infoBtn) {
                console.log("🖱️ Click Outside -> Closing Info Menu");
                infoMenu.classList.add('hidden');
                isInteractingWithUI = false;
                if (controls) {
                    controls.enabled = true;
                    controls.enableKeys = true; // Restaurar teclas
                }
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        keyState[e.code] = false;

        // Cancel Nuclear Reset if DEL is released
        if (e.code === 'Delete') {
            if (eggResetTimer) {
                clearTimeout(eggResetTimer);
                eggResetTimer = null;
                console.log("Starting Reset Cancelled.");
            }
            if (eggResetToast) {
                eggResetToast.remove();
                eggResetToast = null;
            }
        }
    });

    // TIME CONTROL LOGIC - NEW EXPONENTIAL SCALING
    const updateTimeScale = (val) => {
        if (val == 0) {
            isRealTime = true;
            timeScale = 1 / 86400; // 1 sec/sec
            document.getElementById('time-display').innerText = `Velocidade: Tempo Real`;
            document.getElementById('real-time-btn').classList.add('active');
        } else {
            isRealTime = false;
            document.getElementById('real-time-btn').classList.remove('active');

            // Exponential Scale: Base 1.2
            // val is -50 to 50
            // speed = sign * 1.2 ^ (abs(val))
            // But we want a smooth start.
            // Let's scale it such that 1 on slider is ~1 day/sec? 
            // Or maybe 1 on slider is slow.
            // Let's try: Days Per Second (DPS)
            // val 50 -> very fast. 
            // Base 1.15 ^ 50 ~= 1000 days/sec (~3 years/sec)

            const sign = Math.sign(val);
            const magnitude = Math.abs(val);

            // Formula: (magnitude ^ 2.5) / 10  -> nice curve?
            // Let's stick to simple power:
            // daysPerSec = Math.pow(magnitude, 2.5) * 0.01;
            // 50^2.5 * 0.01 = 176 days/sec. A bit slow for gas giants maybe.
            // Let's try 1.2^magnitude.

            // Tweaked formula for user happiness:
            // "Gas giants still slow at 10x".
            // We need BIG speed at max.

            let daysPerSec = Math.pow(1.15, magnitude);
            // at 50: 1083 days/sec.
            // at 10: 4 days/sec.

            // If slider is negative, we reverse time.
            timeScale = daysPerSec * sign;

            // FEATURE: Negative Time Display
            // Using sign to show "-" explicitly if needed
            const signStr = sign < 0 ? "-" : "";
            document.getElementById('time-display').innerText = `Velocidade: ${signStr}${daysPerSec.toFixed(1)} dias/s`;
        }
    };

    document.getElementById('timeSlider').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        updateTimeScale(val);
    });

    // Real Time Speed Button (Only fixes speed)
    document.getElementById('real-time-btn').addEventListener('click', () => {
        isRealTime = true;

        // Reset Slider
        const slider = document.getElementById('timeSlider');
        slider.value = 0;

        // Reset Physics Speed
        timeScale = 1 / 86400;

        document.getElementById('time-display').innerText = `Velocidade: Tempo Real`;
        document.getElementById('real-time-btn').classList.add('active');
    });

    // Reset Date Button (Today - resets date/time to now)
    document.getElementById('reset-date-btn').addEventListener('click', () => {
        currentDate = new Date(); // Reset to local machine time
        currentYearAstronomical = null;

        // Se estiver em modo explosão/anã branca, talvez o usuário queira resetar tudo?
        // Mas por enquanto vamos só resetar a data conforme o pedido.
        console.log("Date reset to Today:", currentDate);
    });

    document.getElementById('close-info').addEventListener('click', closeInfo);
    document.getElementById('audio-btn').addEventListener('click', toggleAudio);

    // Pause Time Button
    const pauseBtn = document.getElementById('pause-time-btn');
    if (pauseBtn) pauseBtn.addEventListener('click', toggleTimePause);

    // Initial White Dwarf Setup (hidden)
    const wdGeo = new THREE.SphereGeometry(2.1, 32, 32);
    const wdMat = new THREE.MeshStandardMaterial({
        color: 0xccddff,
        emissive: 0x00aaff,
        emissiveIntensity: 2,
        roughness: 0.1,
        metalness: 0
    });
    whiteDwarfMesh = new THREE.Mesh(wdGeo, wdMat);
    whiteDwarfMesh.visible = false;
    whiteDwarfMesh.userData = {
        type: 'whiteDwarf',
        name: solarSystemData.whiteDwarf ? solarSystemData.whiteDwarf.name : "Anã Branca",
        radius: 2.1, // FIX: Required for camera calculation
        info: solarSystemData.whiteDwarf ? solarSystemData.whiteDwarf.info : { desc: "Remanescente estelar." }
    };
    whiteDwarfMesh.body = { mesh: whiteDwarfMesh, data: whiteDwarfMesh.userData, type: 'whiteDwarf' };
    celestialBodies.push(whiteDwarfMesh.body); // Adicionar à lista global para interação/sincronismo
    scene.add(whiteDwarfMesh);

    // --- CRIAR RÓTULO PARA ANÃ BRANCA ---
    const wdLabelDiv = document.createElement('div');
    wdLabelDiv.className = 'label-container';
    wdLabelDiv.style.display = 'none'; // Começa escondido
    const wdLabelText = document.createElement('div');
    wdLabelText.className = 'label-text';
    wdLabelText.innerText = whiteDwarfMesh.userData.name;
    wdLabelText.style.color = '#00ccff';
    wdLabelText.style.textShadow = '0 0 8px #00ccff';
    wdLabelDiv.appendChild(wdLabelText);
    const wdLabel = new CSS2DObject(wdLabelDiv);
    wdLabel.position.set(0, whiteDwarfMesh.userData.radius * 2.5, 0);
    whiteDwarfMesh.add(wdLabel);
    whiteDwarfMesh.body.label = wdLabel;

    setupLabelInteraction(wdLabelDiv, whiteDwarfMesh.body);

    console.log("Interface UI initialized.");

    // --- INFO MENU LOGIC ---
    // (infoBtn e infoMenu já declarados no topo do bloco de eventos para evitar redeclaração)
    // REMOVIDO: const infoBtn... (Erro de redeclaração)

    const uiInfoBtn = document.getElementById('info-btn'); // Local var to be safe
    const uiInfoMenu = document.getElementById('info-menu');

    if (uiInfoBtn && uiInfoMenu) {
        console.log("Attaching Info Menu listeners...");
        uiInfoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const infoMenuElement = document.getElementById('info-menu');
            if (infoMenuElement.classList.contains('hidden')) {
                infoMenuElement.classList.remove('hidden');
                isInteractingWithUI = true;
                const items = document.querySelectorAll('.info-menu-item');
                selectedMenuItemIndex = 0;
                updateMenuSelection(items);
                document.body.style.cursor = 'default';

                if (controls) {
                    controls.enabled = false;
                    controls.enableKeys = false; // Bloqueio total de teclado
                }
                console.log("Menu VISIBLE - Controls Locked");
            } else {
                infoMenuElement.classList.add('hidden');
                isInteractingWithUI = false;
                if (controls) {
                    controls.enabled = true;
                    controls.enableKeys = true;
                }
                console.log("Menu HIDDEN - Controls Released");
            }
            audioManager.playHover();
        });

        // REMOVED LOCAL LISTENERS TO AVOID SCOPE ISSUES
        // Instead, valid click logic is handled globally or attached below without nesting



        document.getElementById('menu-about').onclick = (e) => {
            e.stopPropagation();
            showAboutProject();
            infoMenu.classList.add('hidden');
        };

        document.getElementById('menu-camera').onclick = (e) => {
            e.stopPropagation();
            showCameraInfo();
            infoMenu.classList.add('hidden');
        };

        document.getElementById('menu-planets').onclick = (e) => {
            e.stopPropagation();
            showPlanetsInfo();
            infoMenu.classList.add('hidden');
        };

        document.getElementById('menu-keyboard').onclick = (e) => {
            e.stopPropagation();
            showKeyboardShortcuts();
            infoMenu.classList.add('hidden');
        };

        document.getElementById('menu-easter').onclick = (e) => {
            e.stopPropagation();
            showEasterInfo();
            infoMenu.classList.add('hidden');
        };

        document.getElementById('menu-credits').onclick = (e) => {
            e.stopPropagation();
            showCredits();
            infoMenu.classList.add('hidden');
        };

        // --- HOVER SOUNDS FOR MENU ITEMS ---
        document.querySelectorAll('.info-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                audioManager.playHover();
            });
        });
    } else {
        console.error("Critical UI elements (infoBtn/infoMenu) NOT FOUND!");
    }

    animate();
}


function addStarField() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < 12000; i++) { // Aumentado para 12000 para um visual mais rico
        vertices.push(
            THREE.MathUtils.randFloatSpread(8000), // Espalhado um pouco mais
            THREE.MathUtils.randFloatSpread(8000),
            THREE.MathUtils.randFloatSpread(8000)
        );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.6,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function createAsteroidBelts() {
    asteroidSystem = createBeltParticleSystem(1200, 60, 75); // Reduzido de 2000
    scene.add(asteroidSystem);
    kuiperSystem = createBeltParticleSystem(2500, 200, 250); // Reduzido de 4000
    scene.add(kuiperSystem);
}

function createBeltParticleSystem(count, minR, maxR) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];

    for (let i = 0; i < count; i++) {
        const r = THREE.MathUtils.randFloat(minR, maxR);
        const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
        const y = THREE.MathUtils.randFloatSpread(2);
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        vertices.push(x, y, z);
        colors.push(0.7, 0.7, 0.7);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, transparent: true, opacity: 0.6 });
    return new THREE.Points(geometry, material);
}

// --- LOADING MANAGER ---
const loadingManager = new THREE.LoadingManager();

loadingManager.onLoad = function () {
    console.log('Loading complete!');
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);
    }
};

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    // Optional: Update progress bar
};

// Se o usuário voltar para a aba, garantir que escalas estão corretas
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        // Resetar relógio para evitar pulo
        clock.getDelta();

        // CORREÇÃO DE ESCALA: Se não estiver explodindo, forçar tamanho normal
        if (!explosionActive) {
            celestialBodies.forEach(body => {
                if (body.type === 'planet' || body.type === 'dwarf') {
                    body.mesh.scale.set(1, 1, 1);
                }
            });
        }
    }
});

function createSystem() {
    const sunData = solarSystemData.sun;
    const sunGeo = new THREE.SphereGeometry(sunData.radius, 48, 48); // Reduzido de 64
    const sunTex = textureGenerator.createSunTexture();
    const sunMat = new THREE.MeshStandardMaterial({
        map: sunTex,
        emissive: 0xffaa00,
        emissiveMap: sunTex,
        emissiveIntensity: 2.5 // Reduzido para contorno mais definido
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    // --- CRIAR RÓTULO PARA O SOL ---
    const sunLabelDiv = document.createElement('div');
    sunLabelDiv.className = 'label-container';

    // Interaction applied after body definition

    const sunLabelText = document.createElement('div');
    sunLabelText.className = 'label-text';
    sunLabelText.innerText = sunData.name;
    sunLabelText.style.color = '#ffaa00';
    sunLabelText.style.textShadow = '0 0 8px #ffaa00';
    sunLabelDiv.appendChild(sunLabelText);
    const sunLabel = new CSS2DObject(sunLabelDiv);
    sunLabel.position.set(0, sunData.radius * 1.5, 0);
    sunMesh.add(sunLabel);

    // Adicionamos referências úteis para a explosão
    const sunBody = { mesh: sunMesh, data: sunData, type: 'sun', label: sunLabel };
    celestialBodies.push(sunBody);

    setupLabelInteraction(sunLabelDiv, sunBody);

    solarSystemData.planets.forEach(data => createPlanet(data));
    solarSystemData.dwarfs.forEach(data => createPlanet(data));
}

function createFluminensePlanet() {
    const data = solarSystemData.fluminense;
    if (!data) return;

    // --- 1. HIERARQUIA DE ÓRBITA ESTÁVEL (Sem Bambolê) ---
    // Estrutura: Scene -> TiltGroup (Inclinação Fixa) -> RotatorGroup (Animação Y) -> BodyGroup (Translação X)

    // Grupo de Inclinação (Fixo no Espaço)
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.x = Math.PI / 4; // 45 graus
    tiltGroup.rotation.z = Math.PI / 8; // Leve inclinação lateral
    scene.add(tiltGroup);

    // Grupo de Rotação (Gira em torno do eixo Y local do TiltGroup)
    const rotatorGroup = new THREE.Group();
    tiltGroup.add(rotatorGroup);

    // [FEAT] Visualização da Órbita
    // A órbita é desenhada no plano XY local do TiltGroup
    const orbitCurve = new THREE.EllipseCurve(
        0, 0,            // ax, aY
        data.distance, data.distance, // xRadius, yRadius
        0, 2 * Math.PI,  // aStartAngle, aEndAngle
        false,           // aClockwise
        0                // aRotation
    );
    const orbitPoints = orbitCurve.getPoints(100);
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({
        color: 0x006400, // Verde do Flu
        transparent: true,
        opacity: 0.3
    });
    const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
    orbitLine.rotation.x = Math.PI / 2; // Deitar a linha para alinhar com o plano orbital
    tiltGroup.add(orbitLine); // Adiciona ao TiltGroup (não gira junto com o planeta)

    const bodyGroup = new THREE.Group();
    bodyGroup.position.x = data.distance;
    rotatorGroup.add(bodyGroup);

    const geometry = new THREE.SphereGeometry(data.radius, 48, 48);

    // Carregar TEXTURA DO ESCUDO enviado pelo usuário
    const loader = new THREE.TextureLoader(loadingManager);
    const texture = loader.load('assets/fluminense_shield.png?v=4'); // Cache buster atualizado

    // Ajuste de mapeamento
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.1,
        emissive: 0x222222,
        emissiveMap: texture
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);


    // --- 2. RÓTULO ESPECIAL TRICOLOR (Onda de Cores) ---
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-container';
    labelDiv.style.cursor = 'pointer';

    const labelText = document.createElement('div');
    labelText.className = 'label-text fluminense-label'; // Classe estilo Júpiter

    const name = "Fluminense";
    // Gerar um span para cada letra com delay para efeito de onda
    name.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.innerText = char;
        span.className = 'tricolor-letter';
        span.style.animationDelay = `${index * 0.15}s`; // Delay progressivo avançando
        labelText.appendChild(span);
    });

    labelDiv.appendChild(labelText);
    const label = new CSS2DObject(labelDiv);
    // [FIX] Subir o rótulo para não cobrir o planeta (2.5x raio)
    label.position.set(0, data.radius * 2.5, 0);
    mesh.add(label);

    // === CORREÇÃO CRÍTICA PARA INCLINAÇÃO E POSIÇÃO ===
    scene.updateMatrixWorld(true);

    const body = {
        mesh: mesh,
        data: data,
        type: 'planet',
        orbitGroup: rotatorGroup, // O loop de animação vai girar ESTE grupo
        rootGroup: tiltGroup,    // Referência para remoção limpa da cena
        bodyGroup: bodyGroup,
        label: label,
        isEasterEgg: true,
        distance: data.distance,
        speed: data.speed,
        originalDistance: data.distance,
        originalSpeed: data.speed
    };
    celestialBodies.push(body);

    // Forçar renderização inicial
    mesh.visible = true;
    tiltGroup.visible = true;

    setupLabelInteraction(labelDiv, body);

    // --- 3. DURAÇÃO DE 60 SEGUNDOS ---
    setTimeout(() => {
        if (body && mesh) {
            console.log("🕊️ Planeta Fluminense partindo para a próxima vitória...");
            if (focusedBody === body) closeInfo();

            // Remover label do DOM
            if (labelDiv && labelDiv.parentNode) {
                labelDiv.parentNode.removeChild(labelDiv);
            }

            // Remover da cena (Hierarquia correta: Root -> TiltGroup)
            if (tiltGroup) scene.remove(tiltGroup);

            // Limpeza da lista
            celestialBodies = celestialBodies.filter(b => b !== body);
        }
    }, 60000); // 60 segundos

    return body;
}

function createPlanet(data) {
    const orbitGroup = new THREE.Group();
    if (data.startAngle) {
        orbitGroup.rotation.y = data.startAngle;
    }
    scene.add(orbitGroup);

    const bodyGroup = new THREE.Group();
    bodyGroup.position.x = data.distance;
    orbitGroup.add(bodyGroup);

    const geometry = new THREE.SphereGeometry(data.radius, data.radius > 5 ? 48 : 32, data.radius > 5 ? 48 : 32); // Dinâmico baseado no tamanho
    let texture;
    // --- LOADING MANAGER ---
    // Usar o manager global para rastrear progresso
    const loader = new THREE.TextureLoader(loadingManager);
    let material;

    if (data.textureMap) {
        texture = loader.load(data.textureMap);
        if (data.nightMap) {
            const nightTex = loader.load(data.nightMap);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                emissive: 0xffffff,
                emissiveMap: nightTex,
                emissiveIntensity: 2.5 // AUMENTADO para destacar as cidades à noite
            });

            material.onBeforeCompile = function (shader) {
                shader.uniforms.sunPosition = { value: new THREE.Vector3(0, 0, 0) };
                shader.vertexShader = 'varying vec3 vWorldPosition;\nvarying vec3 vNormalWorld;\n' + shader.vertexShader;
                shader.fragmentShader = 'varying vec3 vWorldPosition;\nvarying vec3 vNormalWorld;\n' + shader.fragmentShader;

                shader.vertexShader = shader.vertexShader.replace(
                    '#include <worldpos_vertex>',
                    `#include <worldpos_vertex>
                    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
                    vNormalWorld = normalize(mat3(modelMatrix) * normal);`
                );

                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <emissivemap_fragment>',
                    `#include <emissivemap_fragment>
                    vec3 sunPosSafe = vec3(0.0);
                    vec3 pixelToSunSafe = normalize(sunPosSafe - vWorldPosition);
                    float earthAlign = dot(vNormalWorld, pixelToSunSafe);
                    float earthNightFactor = 1.0 - smoothstep(-0.2, 0.2, earthAlign);
                    vec3 contrastEmissive = pow(totalEmissiveRadiance, vec3(3.0));
                    totalEmissiveRadiance = contrastEmissive * 3.0;
                    totalEmissiveRadiance *= earthNightFactor;`
                );
            };
        } else {
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 1.0,
                metalness: 0.0
            });
        }
    } else {
        const type = data.info.type || '';
        if (data.name === 'Terra') {
            texture = textureGenerator.createTerrestrialTexture(data.color, 'earth');
        } else if (type.includes('Gasoso') || type.includes('Gelo')) {
            texture = textureGenerator.createGasGiantTexture(data.color);
        } else {
            texture = textureGenerator.createTerrestrialTexture(data.color, 'rocky');
        }
        let roughness = 1.0; // Fosco por padrao para evitar estouro de luz
        let metalness = 0.0;
        if (data.name === 'Mercúrio' || data.name === 'Vênus') {
            roughness = 1.0;
            metalness = 0.0;
        }
        material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: roughness,
            metalness: metalness
        });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);

    // IMPLEMENTATION: Axial Tilt (Inclinação da Terra e outros)
    if (data.tilt) {
        const tiltRad = THREE.MathUtils.degToRad(data.tilt);
        mesh.rotation.z = tiltRad; // Apply tilt to z-axis relative to ecliptic normal (y)


    }

    if (data.name === 'Terra' || data.name === 'Vênus') {
        const atmoGeo = new THREE.SphereGeometry(data.radius * 1.05, 32, 32);
        const atmoMat = new THREE.ShaderMaterial({
            uniforms: {
                sunPosition: { value: new THREE.Vector3(0, 0, 0) },
                atmoColor: { value: new THREE.Color(data.name === 'Terra' ? 0x0044ff : 0xffddaa) }
            },
            vertexShader: `
                varying vec3 vNormalWorld;
                varying vec3 vNormalView;
                varying vec3 vWorldPosition;
                void main() {
                    vNormalWorld = normalize(mat3(modelMatrix) * normal);
                    vNormalView = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunPosition;
                uniform vec3 atmoColor;
                varying vec3 vNormalWorld;
                varying vec3 vNormalView;
                varying vec3 vWorldPosition;
                void main() {
                    vec3 sunDir = normalize(sunPosition - vWorldPosition);
                    float sunOrientation = dot(vNormalWorld, sunDir);
                    float dayFactor = smoothstep(0.0, 0.1, sunOrientation);
                    float viewDot = normalize(vNormalView).z;
                    float fresnel = 1.0 - abs(viewDot);
                    fresnel = pow(fresnel, 4.0);
                    float alpha = fresnel * dayFactor * 0.45; // Reduzido de 0.9 para suavizar aura                    gl_FragColor = vec4(atmoColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide
        });
        const atmo = new THREE.Mesh(atmoGeo, atmoMat);
        bodyGroup.add(atmo);
    }

    if (data.hasRings) {
        const startRad = data.radius * 1.2;
        const endRad = data.radius * 2.3;
        const ringGeo = new THREE.RingGeometry(startRad, endRad, 48); // Reduzido de 64
        var pos = ringGeo.attributes.position;
        var v3 = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v3.fromBufferAttribute(pos, i);
            const dist = v3.length();
            const u = (dist - startRad) / (endRad - startRad);
            ringGeo.attributes.uv.setXY(i, u, 0.5);
        }

        let ringMat;
        if (data.ringMap) {
            const ringTex = loader.load(data.ringMap);
            ringTex.rotation = 0;
            ringMat = new THREE.MeshStandardMaterial({
                map: ringTex,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                roughness: 0.8,
                emissive: 0xaa8855,
                emissiveIntensity: 0.3
            });
        } else {
            ringMat = new THREE.MeshStandardMaterial({
                color: 0xaa8855,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                roughness: 0.8
            });
        }
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.order = 'ZXY'; // Permite aplicar inclinação (Z) e depois deitá-lo (X) de forma independente
        ring.rotation.x = Math.PI / 2;
        if (data.tilt) {
            ring.rotation.z = THREE.MathUtils.degToRad(data.tilt);
        }
        ring.name = 'rings';
        bodyGroup.add(ring); // Adicionado ao bodyGroup para não herdar a rotação do mesh (Pedido do Usuário)
    }

    const orbitPathGeo = new THREE.RingGeometry(data.distance - 0.1, data.distance + 0.1, 96); // Reduzido de 128
    const orbitPathMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const orbitPath = new THREE.Mesh(orbitPathGeo, orbitPathMat);
    orbitPath.rotation.x = Math.PI / 2;
    scene.add(orbitPath);

    const labelText = document.createElement('div');
    labelText.className = 'label-text';
    labelText.innerText = data.name;

    // FORÇANDO COR E SOMBRA NOS RÓTULOS (Imagem 2)
    const labelColor = data.color ? '#' + new THREE.Color(data.color).getHexString() : '#ffffff';
    labelText.style.color = labelColor;
    labelText.style.textShadow = `0 0 8px ${labelColor}`;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-container';
    labelDiv.appendChild(labelText);
    const infoDiv = document.createElement('div');
    infoDiv.className = 'hover-info';
    labelDiv.appendChild(infoDiv);
    const line = document.createElement('div');
    line.className = 'label-line';
    labelDiv.appendChild(line);

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, data.radius * 2, 0);
    label.center.set(0.5, 1);
    bodyGroup.add(label);

    if (data.moons) {
        data.moons.forEach(moonData => {
            const moonOrbitWrapper = new THREE.Group();
            if (moonData.tilt) {
                moonOrbitWrapper.rotation.z = THREE.MathUtils.degToRad(moonData.tilt);
            }
            bodyGroup.add(moonOrbitWrapper);
            const moonOrbit = new THREE.Group();
            moonOrbitWrapper.add(moonOrbit);

            const moonGeo = new THREE.SphereGeometry(moonData.radius, 16, 16);
            let moonMat;
            if (moonData.textureMap) {
                const moonTex = loader.load(moonData.textureMap);
                moonMat = new THREE.MeshStandardMaterial({
                    map: moonTex,
                    roughness: 0.9,
                    metalness: 0
                });
            } else {
                moonMat = new THREE.MeshStandardMaterial({ color: moonData.color });
            }

            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.position.x = moonData.distance;
            moonMesh.castShadow = true;
            moonMesh.receiveShadow = true;
            moonOrbit.add(moonMesh);

            celestialBodies.push({
                type: 'moon',
                mesh: moonMesh,
                orbit: moonOrbit,
                distance: moonData.distance,
                speed: moonData.speed,
                originalDistance: moonData.distance,
                originalSpeed: moonData.speed,
                data: moonData
            });
        });
    }

    const body = {
        type: data.isDwarf ? 'dwarf' : 'planet',
        mesh: mesh,
        orbitGroup: orbitGroup,
        bodyGroup: bodyGroup,
        orbitPath: orbitPath,
        distance: data.distance,
        speed: data.speed,
        originalDistance: data.distance,
        originalSpeed: data.speed,
        data: data,
        label: label,
        infoDiv: infoDiv
    };
    celestialBodies.push(body);

    // FIX: Enable click/hover on label
    setupLabelInteraction(labelDiv, body);
}

let isRightMouseDown = false;
let flySpeed = 2.0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

let isFlying = false, flightPhase = 0, flightStartTime = 0, flightDuration = 0;
let flightStartPos = new THREE.Vector3(), flightEndPos = new THREE.Vector3();
let flightStartTarget = new THREE.Vector3(), flightEndTarget = new THREE.Vector3();
let flightNextPos = new THREE.Vector3();

// --- PERFORMANCE MONITORING ---
lastTime = performance.now();
let frames = 0;
let fps = 0;
let fpsLowCounter = 0;
let isFpsVisible = false;

function updateFPS() {
    const now = performance.now();
    frames++;
    if (now > lastTime + 1000) {
        fps = Math.round((frames * 1000) / (now - lastTime));
        frames = 0;
        lastTime = now;

        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        if (isChrome) {
            // FORCED VISIBILITY for debugging "smoothness" with the user
            if (!isFpsVisible) {
                isFpsVisible = true;
                showFpsDisplay();
            }

            if (fps < 45) {
                fpsLowCounter++;
            } else {
                fpsLowCounter = Math.max(0, fpsLowCounter - 1);
            }
        }

        if (isFpsVisible) {
            const display = document.getElementById('fps-counter');
            if (display) {
                display.innerText = `FPS: ${fps}`;
                if (fps < 15) {
                    display.style.color = '#ff3300';
                    display.style.borderColor = '#ff3300';
                    display.style.animation = 'pulse 0.5s infinite alternate';
                } else if (fps < 30) {
                    display.style.color = '#ffaa00';
                    display.style.borderColor = '#ffaa00';
                    display.style.animation = 'none';
                } else {
                    display.style.color = '#00ff00';
                    display.style.borderColor = '#00ff00';
                    display.style.animation = 'none';
                }
            }
        }
    }
}

function showFpsDisplay() {
    let display = document.getElementById('fps-counter');
    if (!display) {
        display = document.createElement('div');
        display.id = 'fps-counter';
        display.style.position = 'fixed';
        display.style.top = '10px';
        display.style.right = '10px';
        display.style.background = 'rgba(0, 0, 0, 0.7)';
        display.style.color = '#00ff00';
        display.style.padding = '5px 10px';
        display.style.fontFamily = 'monospace';
        display.style.fontSize = '14px';
        display.style.borderRadius = '5px';
        display.style.zIndex = '10000';
        display.style.border = '1px solid #00ff00';
        document.body.appendChild(display);
    }
    display.style.display = 'block';
}

function hideFpsDisplay() {
    const display = document.getElementById('fps-counter');
    if (display) display.style.display = 'none';
    isFpsVisible = false;
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}






function animate() {
    // --- BACKGROUND OPTIMIZATION ---
    if (isSleeping) {
        animationFrameId = null;
        return;
    }

    animationFrameId = requestAnimationFrame(animate);

    // --- GLOBAL WATCHDOG FOR NAN CAMERA (Última linha de defesa) ---
    if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
        console.error("🔥 CRITICAL FAILURE: Camera became NaN! Resetting...");
        camera.position.set(0, 200, 300);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        isFlying = false;
        return;
    }

    const now = performance.now();
    // --- OTIMIZAÇÃO DE PERFORMANCE INTELIGENTE ---
    // [OTIMIZAÇÃO] Limitador de FPS para UI removido para garantir 60 FPS constantes em PCs potentes.
    // 2. Se a aba está escondida, capamos em 1 FPS (Economia Extrema)
    else if (!isPageVisible) {
        const elapsed = (now - lastRenderTime);
        if (elapsed < (1000 / BACKGROUND_FPS)) return;
    }


    lastRenderTime = now;
    // ---------------------------------------------

    // ---------------------------------------------

    // --- CRITICAL FIX: DELTA CLAMPING ---
    // Impede explosão física se a aba ficou inativa
    // --- CRITICAL FIX: DELTA CLAMPING ---
    // Impede explosão física se a aba ficou inativa
    let delta = clock.getDelta();
    // --- CRITICAL FIX: DELTA CLAMPING ---
    if (delta > 0.1) {
        delta = 0.1; // Trava máxima de 0.1s por frame (evita salto de 5 min)
    }

    // Date Update
    // ECONOMIA: Só pausa o tempo se o usuário pausou manualmente ou se a aba está escondida
    if (!isTimePaused && isPageVisible) { // [FIX] Não pausar durante MODAIS (Evitar orbit freeze)
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysToAdvance = timeScale * delta;
        currentDate.setTime(currentDate.getTime() + (daysToAdvance * msPerDay));
    }

    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentYearAstronomical !== null ? currentYearAstronomical : currentDate.getFullYear();
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    const dateStr = `${day} / ${month} / ${year} ${hours}:${minutes}:${seconds}`;

    // Otimização: Só atualiza o DOM se a string mudar (evita layout thrashing a cada frame)
    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay && dateDisplay.getAttribute('data-last') !== dateStr) {
        dateDisplay.innerText = dateStr;
        dateDisplay.setAttribute('data-last', dateStr);
    }

    const getPeriodInDays = (str) => {
        if (!str) return 365;
        if (str.includes('anos')) return parseFloat(str) * 365.25;
        const val = parseFloat(str);
        return isNaN(val) ? 365 : val;
    };

    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const dayOfYear = (currentDate - startOfYear) / (1000 * 60 * 60 * 24);

    celestialBodies.forEach(body => {
        if (body.type === 'planet') {
            let angle;
            if (body.data.name === 'Terra') {
                const yearFraction = dayOfYear / 365.25;
                angle = yearFraction * Math.PI * 2;
            } else {
                const totalDays = currentDate.getTime() / (24 * 60 * 60 * 1000);
                const period = getPeriodInDays(body.data.info.translation);
                angle = (totalDays / period) * Math.PI * 2 + (body.data.startAngle || 0);
            }
            // Ensure orbitGroup (Fluminense) or orbit (Standard) is used correctly
            if (body.orbitGroup) body.orbitGroup.rotation.y = angle;
            else if (body.orbit) body.orbit.rotation.y = angle;

            const rotDir = body.data.retrograde ? -1 : 1;
            // Rotation Speed: 0.01 rad/frame at 60fps -> 0.6 rad/sec
            if (body.mesh) body.mesh.rotation.y += (0.6 * delta) * rotDir;
        } else if (body.type === 'moon') {
            // Speed logic for moons needs to be compatible with timeScale (days/sec)
            // body.speed is rads per frame? Or arbitrary?
            // Existing logic: body.speed * (timeScale * 0.05).
            // Old timeScale was 1. New timeScale can be 1000.
            // If new timeScale is "days per sec", then we want 365 days = 2PI orbit?
            // Moons are faster. 27 days for Moon.
            // Let's keep the arbitrary speed modifier for visual effect, but scaled.
            // Old: timeScale=1 => speed * 0.05.
            // New: timeScale=1 (day/sec) => speed * ??
            // Let's use timeScale directly but clamped for sanity if it's too fast?
            // Or just trust the multiplier.
            // Old Logic: body.speed * timeScale * 0.05
            // Let's keep it visually similar. delta * 3.0 gives ~0.05 at 60FPS.
            if (!isTimePaused) {
                body.orbit.rotation.y += body.speed * timeScale * (delta * 3.0);
            }
        }
    });

    if (!isTimePaused && isPageVisible) { // Removed !isInteractingWithUI to allow rotation in background
        if (asteroidSystem) asteroidSystem.rotation.y += (0.03 * delta) * timeScale;
        if (kuiperSystem) kuiperSystem.rotation.y += (0.012 * delta) * timeScale;
    }

    // Lógica de Voo independente do focusedBody para evitar travamento
    if (isFlying) {
        // Se perdermos o foco no meio do voo, abortar e devolver controle
        if (!focusedBody) {
            isFlying = false;
            controls.enabled = true;
        } else {
            const now = performance.now();
            const elapsed = now - flightStartTime;
            let progress = elapsed / flightDuration;

            if (progress >= 1) {
                progress = 1;
                isFlying = false;
                isModalOpen = false; // [FIX] Garante FPS alto pós-voo
                if (controls) {
                    controls.enabled = true;
                    controls.enableKeys = true;
                    controls.enablePan = true;
                }
            }
            // Suavização mais gentil (Sine) para evitar paradas bruscas
            const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
            const eased = easeInOutSine(progress);

            // CÂMERA: Movimento suave (Senoide/Cúbico)
            camera.position.lerpVectors(flightStartPos, flightEndPos, eased);

            // ROTAÇÃO (ALVO): Sincronizada com o movimento para evitar "giros loucos" (2 spins)
            // Se atrasarmos muito (pow 5), a câmera dá uma chicotada no final.
            controls.target.lerpVectors(flightStartTarget, flightEndTarget, eased);

            controls.update();
        }
    } else if (focusedBody && focusedBody.mesh) {
        // Acompanhamento Orbital Suave
        const targetPos = new THREE.Vector3();
        focusedBody.mesh.getWorldPosition(targetPos);
        const diff = new THREE.Vector3().subVectors(targetPos, controls.target);
        camera.position.add(diff);
        controls.target.copy(targetPos);
    }

    const moveSpeed = 2 * (timeScale > 0 ? 1 : 1);

    const moveTotal = new THREE.Vector3();
    const cameraSpeed = 150 * delta;

    // --- BLOQUEIO DE MOVIMENTO MANUAL INFALÍVEL (TOLERÂNCIA ZERO) ---
    if (isInteractingWithUI || isModalOpen) {
        moveTotal.set(0, 0, 0);
    } else {
        if (keyState['KeyW'] || keyState['ArrowUp']) {
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            moveTotal.add(forward.multiplyScalar(cameraSpeed));
        }
        if (keyState['KeyS'] || keyState['ArrowDown']) {
            const backward = new THREE.Vector3();
            camera.getWorldDirection(backward);
            moveTotal.add(backward.multiplyScalar(-cameraSpeed));
        }
        if (keyState['KeyA'] || keyState['ArrowLeft']) {
            const right = new THREE.Vector3();
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            // Produto vetorial: Forward X Up = Right
            right.crossVectors(forward, camera.up).normalize();
            // Para "Esquerda", invertemos ou subtraímos
            moveTotal.add(right.multiplyScalar(-cameraSpeed));
        }
        if (keyState['KeyD'] || keyState['ArrowRight']) {
            const right = new THREE.Vector3();
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            right.crossVectors(forward, camera.up).normalize();
            moveTotal.add(right.multiplyScalar(cameraSpeed));
        }
    }

    const isMoving = moveTotal.lengthSq() > 0;

    if (isMoving && focusedBody) {
        // Se estiver focado, não permite mover com teclas para não quebrar o acompanhamento
        // Mas NÃO damos return, senão mata o render loop
        moveTotal.set(0, 0, 0);
    }

    if (isMoving) {
        camera.position.add(moveTotal);
        if (!focusedBody) {
            controls.target.add(moveTotal);
            controls.update();
        }
    }

    if (controls.enabled) {
        controls.update();
    }

    // --- SINCRONIZADOR UNIVERSAL DE UI ---
    // Se o modal estiver aberto, garantimos que o conteúdo seja SEMPRE o do astro focado.
    if (isModalOpen && focusedBody) {
        const infoNameEl = document.getElementById('info-name');

        // Se o nome atual do focado não bate com o painel, forçamos o refresh
        if (infoNameEl && infoNameEl.innerText !== focusedBody.data.name) {
            updateInfoPanel(focusedBody);
        }
    }

    // Explosão Solar
    if (explosionActive) {
        const sun = celestialBodies.find(b => b.type === 'sun');
        if (sun) {
            if (explosionPhase === 1) {
                // Expansão
                // 0.002 per frame at 60fps -> 0.12 per second
                const expansionSpeed = 0.08 * delta; // Slightly slower for better control
                sun.mesh.scale.addScalar(expansionSpeed);
                // Mudança para cor mais quente/brilhante (Laranja intenso em vez de vermelho escuro)
                sun.mesh.material.emissive.lerp(new THREE.Color(0xff4400), expansionSpeed);
                sun.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(sun.mesh.material.emissiveIntensity, 5, expansionSpeed);

                // Luz menos vermelha para não saturar os gigantes gasosos
                sunLight.color.lerp(new THREE.Color(0xffccaa), 0.3 * delta);
                sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 10, expansionSpeed);

                // Camera Zoom-Out (Afastar suavemente enquanto o sol cresce)
                // MODIFICAÇÃO: Só acontece se o Sol estiver focado
                if (focusedBody && (focusedBody.type === 'sun' || focusedBody.type === 'whiteDwarf')) {
                    const sunPos = sun.mesh.position;
                    const camDist = camera.position.distanceTo(sunPos);
                    if (camDist < 300) { // Limite de afastamento
                        const retreatDir = new THREE.Vector3().subVectors(camera.position, sunPos).normalize();
                        const moveVec = retreatDir.multiplyScalar(8 * delta);
                        moveVec.y += 2.5 * delta; // Subir câmera para ângulo cinematográfico
                        camera.position.add(moveVec);
                        controls.target.lerp(sunPos, 2 * delta); // Manter foco no sol
                    }
                }

                // --- GATILHO DE ESTADO: MUDANÇA PARA GIGANTE VERMELHA ---
                // O Sincronizador Universal cuidará de atualizar o painel se estiver aberto.
                // --- GATILHO DE ESTADO: MUDANÇA PARA GIGANTE VERMELHA ---
                // OPTIMIZATION: Check flag before setting properties
                if (sun.data && !sun.data.isGiant) {
                    sun.data.isGiant = true; // Mark as transformed
                    sun.data.name = "Gigante Vermelha";
                    sun.data.info.desc = "O Sol esgotou seu hidrogênio e expandiu, engolindo os planetas internos. <br><br><strong>Status:</strong> Colapso Iminente.";
                    sun.data.info.type = "Gigante Vermelha";
                    sun.data.info.age = "5.0 Bi Anos";
                    sun.data.info.translation = "?";
                    sun.data.info.rotation = "27 dias";
                    sun.data.info.moons = "0";

                    // Force panel update if it's open on the sun
                    const infoPanel = document.getElementById('info-panel');
                    if (infoPanel && !infoPanel.classList.contains('hidden')) {
                        // Check if focused body is practically the sun
                        if (focusedBody && (focusedBody.type === 'sun' || focusedBody.data.name === 'Sol' || focusedBody.data.name === 'Gigante Vermelha')) {
                            updateInfoPanel(sun);
                        }
                    }
                }

                // Esconder rótulo do Sol na explosão
                if (sun.label) sun.label.element.style.display = 'none';

                // Consumo de planetas (BASEADO NO RAIO REAL DO SOL)
                const sunRadius = sun.mesh.geometry.parameters.radius * sun.mesh.scale.x;
                let earthConsumed = false;

                celestialBodies.forEach(body => {
                    if ((body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') && body.mesh.visible) {
                        // For planets use group position (orbit radius)
                        const dist = body.distance || 0;
                        if (dist < sunRadius) {
                            body.mesh.visible = false;
                            if (body.orbitGroup) body.orbitGroup.visible = false;
                            if (body.orbitPath) body.orbitPath.visible = false;
                            if (body.label) body.label.element.style.display = 'none';

                            if (body.data.name === 'Terra') earthConsumed = true;
                        }
                    } else if (body.data.name === 'Terra' && !body.mesh.visible) {
                        // Check if Earth was ALREADY consumed in a previous frame
                        earthConsumed = true;
                    }
                });

                // Transição para Anã Branca (Sincronizada com a Terra)
                if (earthConsumed) {
                    explosionPhase = 3;
                    sun.mesh.material.transparent = true;
                    sun.mesh.material.needsUpdate = true;
                    highlightBody(sun, false); // Remove hover effects immediately
                    whiteDwarfMesh.visible = true;
                    if (whiteDwarfMesh.material) {
                        whiteDwarfMesh.material.emissiveIntensity = 4.0; // Brilho real de Anã Branca
                        whiteDwarfMesh.material.emissive.setHex(0xffffff);
                    }
                    if (whiteDwarfMesh.body && whiteDwarfMesh.body.label) {
                        whiteDwarfMesh.body.label.element.style.display = 'block';
                    }
                    sunLight.color.setHex(0xffffff);
                    // LUZ DIMINUÍDA: Planetas no escuro, mas Estrela brilha (via emissive)
                    sunLight.intensity = 0.5;

                    // --- GATILHO DE ESTADO: MUDANÇA PARA ANÃ BRANCA ---
                    // CORREÇÃO DE FOCO: Só muda o foco se estiver olhando para o Sol
                    if (focusedBody === sun || (sun && focusedBody === sun.mesh) || (focusedBody && (focusedBody.type === 'sun' || focusedBody.data.name === 'Gigante Vermelha'))) {
                        focusedBody = whiteDwarfMesh.body;
                        // FORÇAR ATUALIZAÇÃO DO PAINEL IMEDIATAMENTE (Robustez: Checar visibilidade do DOM)
                        const infoPanel = document.getElementById('info-panel');
                        if (infoPanel && !infoPanel.classList.contains('hidden')) {
                            updateInfoPanel(focusedBody);
                        }
                    } else {
                        // Se estiver olhando Júpiter, mantenha o foco em Júpiter
                        // Mas certifique-se de que o painel do Sol não está aberto
                        const infoNameEl = document.getElementById('info-name');
                        if (infoNameEl && (infoNameEl.innerText === 'Sol' || infoNameEl.innerText === 'Gigante Vermelha')) {
                            // Se o painel mostra o Sol mas o foco está em outro lugar (raro), atualize para o foco atual
                            if (focusedBody) updateInfoPanel(focusedBody);
                        }
                    }
                }
            } else if (explosionPhase === 3) {
                // Fade out
                // Não crescer mais, apenas desaparecer
                sun.mesh.material.opacity -= 0.5 * delta; // Mais rápido
                if (sun.mesh.material.opacity <= 0) {
                    sun.mesh.visible = false;
                }

                // --- MECÂNICA DE EXPANSÃO ORBITAL (Anã Branca) ---
                // Simula a perda de massa estelar (gravidade enfraquece)
                celestialBodies.forEach(body => {
                    if ((body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') && body.mesh.visible) {
                        const targetDist = body.originalDistance * 2.2; // Expansão baseada em perda de ~55% de massa
                        const targetSpeed = body.originalSpeed * 0.2; // Translação fica muito mais lenta

                        // Interpolação suave (lerp) para as novas órbitas
                        const lerpFactor = 0.08 * delta;
                        body.distance = THREE.MathUtils.lerp(body.distance, targetDist, lerpFactor);
                        body.speed = THREE.MathUtils.lerp(body.speed, targetSpeed, lerpFactor);

                        // Atualiza as posições físicas
                        if (body.bodyGroup) {
                            body.bodyGroup.position.x = body.distance;
                        } else if (body.type === 'moon' && body.mesh) {
                            // Luas tambem se afastam um pouco (embora a gravidade do planeta mande mais, aqui simplificamos)
                            body.mesh.position.x = body.distance;
                        }

                        // Atualiza o desenho do caminho da órbita (Ring)
                        if (body.orbitPath) {
                            // Escalamos o caminho da órbita para acompanhar o planeta
                            const orbitScale = body.distance / body.originalDistance;
                            body.orbitPath.scale.set(orbitScale, orbitScale, 1);
                        }
                    }
                });

                // Expansão dos cinturões (Asteroides e Kuiper)
                const beltLerpFactor = 0.05 * delta;
                const targetBeltScale = 2.2;
                if (asteroidSystem) {
                    asteroidSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
                }
                if (kuiperSystem) {
                    kuiperSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
                }
            }
        }
    }

    updateFPS();
    composer.render();
    labelRenderer.render(scene, camera);
}


function startExplosion() {
    explosionActive = true;
    explosionPhase = 1;
    // Salto temporal para 5 bilhões de anos no futuro
    // Usamos uma string descritiva conforme pedido do mestre
    currentYearAstronomical = "+/- 5 bilhões de anos (aprox.)";
    console.log("🚀 Sequência Final: Ano Astronomico setado para:", currentYearAstronomical);
}

function resetSolarSystem() {
    explosionActive = false;
    explosionPhase = 0;
    currentYearAstronomical = null;
    currentDate = new Date(); // Volta para hoje

    const sun = celestialBodies.find(b => b.type === 'sun');
    if (sun) {
        sun.mesh.scale.set(1, 1, 1);
        sun.mesh.visible = true;
        sun.mesh.material.emissive.setHex(0xffaa00);
        sun.mesh.material.emissiveIntensity = 2;
        sun.mesh.material.transparent = false;
        sun.mesh.material.opacity = 1;
        sun.mesh.material.needsUpdate = true;

        // Reset sun data
        sun.data.isGiant = false; // Reset optimization flag
        sun.data.name = "Sol";
        sun.data.info.desc = "O Sol é a estrela central do nosso sistema solar, responsável por toda a vida na Terra.";
        sun.data.info.type = "Estrela (Anã Amarela)";
        // sun.data.info.status = "Estável"; // If status was a separate field
    }

    whiteDwarfMesh.visible = false;
    if (whiteDwarfMesh.body && whiteDwarfMesh.body.label) {
        whiteDwarfMesh.body.label.element.style.display = 'none';
    }

    if (sun && sun.label) {
        sun.label.element.style.display = 'block';
    }

    sunLight.color.setHex(0xffffff);
    sunLight.intensity = 1.5;

    celestialBodies.forEach(body => {
        if (body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') {
            body.mesh.visible = true;
            if (body.orbitGroup) body.orbitGroup.visible = true;
            if (body.orbitPath) {
                body.orbitPath.visible = true;
                body.orbitPath.scale.set(1, 1, 1); // Reset path scale
            }
            if (body.label) body.label.element.style.display = 'block';

            // Restore original orbital values
            if (body.originalDistance !== undefined) {
                body.distance = body.originalDistance;
                if (body.bodyGroup) body.bodyGroup.position.x = body.distance;
                if (body.type === 'moon' && body.mesh) body.mesh.position.x = body.distance;
            }
            if (body.originalSpeed !== undefined) {
                body.speed = body.originalSpeed;
            }

            // Restore rings
            if (body.bodyGroup) {
                body.bodyGroup.children.forEach(child => {
                    if (child.name === 'rings') child.visible = true;
                });
            }
        }
    });

    if (asteroidSystem) {
        asteroidSystem.visible = true;
        asteroidSystem.scale.set(1, 1, 1);
    }
    if (kuiperSystem) {
        kuiperSystem.visible = true;
        kuiperSystem.scale.set(1, 1, 1);
    }

    closeInfo(); // Close info panel

    // Garantir que controles e flags de voo sejam resetados
    isFlying = false;
    controls.enabled = true;

    // Adjust Camera if too close (User Request: "Sol na cara")
    const sunBody = celestialBodies.find(b => b.type === 'sun');
    const sunPos = sunBody ? sunBody.mesh.position : new THREE.Vector3(0, 0, 0);
    const dist = camera.position.distanceTo(sunPos);
    if (dist < 80) {
        // Move camera back to a comfortable distance
        const direction = new THREE.Vector3().subVectors(camera.position, sunPos).normalize();
        // If camera is exactly at 0,0,0 (unlikely but possible), use a default direction
        if (direction.lengthSq() === 0) direction.set(0, 0, 1);

        const newPos = sunPos.clone().add(direction.multiplyScalar(150));
        camera.position.copy(newPos);
        controls.target.copy(sunPos);
        controls.update();
    } else {
        // Mesmo que a distância esteja boa, garantir que o target esteja no sol no momento do reset
        controls.target.copy(sunPos);
        controls.update();
    }
}

function updateHoverInfo(body) {
    if (body.infoDiv) body.infoDiv.innerHTML = '';
}

function onMouseMove(event) {
    if (isInteractingWithUI) return; //    function onMouseMove(event) {
    // Se estivermos sobre um rótulo, o DOM cuida do highlight.
    // O Raycaster não deve interferir (limpar highlight) nem mudar cursor.
    if (isHoveringLabel) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const sunBodyForFilter = celestialBodies.find(b => b.type === 'sun');
    const sunMeshForFilter = sunBodyForFilter ? sunBodyForFilter.mesh : null;

    const meshes = celestialBodies.map(b => b.mesh).filter(m => {
        if (!m || !m.visible) return false;
        // Na Fase 3 (Anã Branca no centro), o Sol gigante está em fade-out e bloqueia o clique.
        // Removemos ele da lista de colisão para permitir interagir com a WD.
        if (explosionActive && explosionPhase === 3 && m === sunMeshForFilter) return false;
        return true;
    });

    if (whiteDwarfMesh && whiteDwarfMesh.visible && !meshes.includes(whiteDwarfMesh)) {
        meshes.push(whiteDwarfMesh);
    }

    const intersects = raycaster.intersectObjects(meshes);

    // Bloqueio de UI: Se estiver sobre o painel, não processar hover
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel && !infoPanel.classList.contains('hidden')) {
        const rect = infoPanel.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            document.body.style.cursor = 'default';
            if (hoveredBody) {
                highlightBody(hoveredBody, false);
                hoveredBody = null;
            }
            return;
        }
    }

    if (intersects.length > 0) {
        const hitObj = intersects[0].object;

        let body;
        if (hitObj === whiteDwarfMesh) {
            body = whiteDwarfMesh.body;
        } else {
            body = celestialBodies.find(b => b.mesh === hitObj);
        }

        if (body && hoveredBody !== body) {
            // [FIX] Seleção INSTANTÂNEA sem delay proposital
            if (hoveredBody) highlightBody(hoveredBody, false);
            hoveredBody = body;
            highlightBody(body, true);
        }
    } else {
        if (hoveredBody) {
            highlightBody(hoveredBody, false);
            hoveredBody = null;
        }
        document.body.style.cursor = 'default';
    }
}

function setupLabelInteraction(labelDiv, body) {
    labelDiv.style.cursor = 'pointer';
    labelDiv.onclick = (e) => {
        e.stopPropagation();
        focusOnPlanet(body);
    };
    labelDiv.onmouseenter = () => {
        isHoveringLabel = true;
        highlightBody(body, true);
    };
    labelDiv.onmouseleave = () => {
        isHoveringLabel = false;
        highlightBody(body, false);
    };
}

function highlightBody(body, active) {
    document.body.style.cursor = active ? 'pointer' : 'default';

    if (active) {
        audioManager.playHover();
    }

    // [FIX] Permitir cursor pointer para Easter Eggs para indicar interatividade
    if (body.isEasterEgg) {
        document.body.style.cursor = active ? 'pointer' : 'default';
        return;
    }

    if (body.label) {
        const element = body.label.element;
        const labelTextDiv = element.querySelector('.label-text');

        if (active) {
            element.classList.add('hovered');
            if (labelTextDiv) {
                labelTextDiv.style.transform = 'scale(1.2)';
                labelTextDiv.style.filter = 'brightness(1.5)';
            }
        } else {
            element.classList.remove('hovered');
            if (labelTextDiv) {
                labelTextDiv.style.transform = 'scale(1)';
                labelTextDiv.style.filter = 'none';
                labelTextDiv.style.color = body.data.color ? '#' + new THREE.Color(body.data.color).getHexString() : 'white';
            }
            if (body.infoDiv) body.infoDiv.innerHTML = '';
        }
    }

    // Mesh highlighting (Emissive)
    if (body.mesh && body.mesh.material && body.mesh.material.emissive) {
        if (body.data.name === 'Terra') {
            body.mesh.material.emissiveIntensity = 1.0;
            body.mesh.material.emissive.setHex(0xffffff);
        } else if (body.type === 'sun' || body.type === 'whiteDwarf') {
            // BLOQUEIO DE SEGURANÇA: Estrelas nunca perdem o brilho base, sob nenhuma circunstância de hover

            // Se estiver explodindo, NÃO mexer no brilho, pois a animação controla isso.
            if (explosionActive && body.type === 'sun') return;

            if (body.type === 'whiteDwarf') {
                body.mesh.material.emissive.setHex(0xffffff);
                body.mesh.material.emissiveIntensity = 4.0; // Brilho Real de Anã Branca
            } else {
                body.mesh.material.emissiveIntensity = 2.5; // Brilho Solar
                body.mesh.material.emissive.setHex(explosionActive ? 0xff4400 : 0xffaa00);
            }
            return; // Garante que o bloco de reset abaixo NUNCA seja alcançado pelas estrelas
        }
        else {
            if (active) {
                body.mesh.material.emissiveIntensity = 0.5;
                body.mesh.material.emissive.setHex(0x555555);
            } else {
                body.mesh.material.emissiveIntensity = 0;
                body.mesh.material.emissive.setHex(0x000000);
            }
        }
    }
}

function onMouseClick(event) {
    if (isInteractingWithUI) return; // Bloqueio total de cliques
    if (hoveredBody) {
        // Validation before accessing properties
        if (!hoveredBody.data || !hoveredBody.mesh) return;

        // Bloquear informativos de planetas destruídos ou invisíveis
        if (!hoveredBody.mesh.visible) {
            return;
        }

        // Bloqueio de Luas genéricas
        if (hoveredBody.type === 'moon' && hoveredBody.data.name !== 'Lua') {
            return;
        }

        focusOnPlanet(hoveredBody);
    }
}

function focusOnPlanet(body) {
    if (!body || !body.mesh) return;

    // SANITIZAÇÃO DE ENTRADA DA CÂMERA
    if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
        console.warn("⚠️ Camera is NaN entering focusOnPlanet. Resetting to safe home.");
        camera.position.set(0, 100, 200);
        camera.lookAt(0, 0, 0);
    }

    // Forçar atualização de matrizes DO OBJETO e seus PAIS para garantir getWorldPosition correto
    // Apenas scene.updateMatrixWorld pode não ser suficiente se o objeto for novo na hierarquia
    if (body.mesh.parent) body.mesh.parent.updateMatrixWorld(true);
    body.mesh.updateMatrixWorld(true);

    // DEBUG: Verificar integridade dos dados na entrada
    console.log(`🔍 DEBUG FOCUSED BODY: ${body.data.name}`, {
        radius: body.data.radius,
        bodyDistance: body.distance,
        cameraPos: camera.position.clone(),
        orbitGroup: !!body.orbitGroup
    });

    // Fallback: Chamar scene update também
    scene.updateMatrixWorld(true);
    if (focusedBody && focusedBody.data.name === 'Lua' && isCheeseMode && focusedBody !== body) {
        toggleMoonCheese(false);
    }

    // --- PERMITIR REABRIR PAINEL MESMO SE JÁ FOCADO (CONSERTO DE REGRESSÃO) ---
    if (focusedBody === body && isModalOpen) return;

    focusedBody = body;
    const data = body.data;
    const infoPanel = document.getElementById('info-panel');

    updateInfoPanel(body);

    infoPanel.classList.remove('hidden');
    isModalOpen = true; // SINALIZAR QUE O MODAL ABRIU
    if (controls) {
        controls.enableKeys = false; // TRAVAR TECLADO DA CÂMERA
    }

    const targetPos = new THREE.Vector3();
    body.mesh.getWorldPosition(targetPos);

    // [FIX] Variáveis restauradas para evitar ReferenceError
    const distance = data.radius * 7.0;
    const yOffset = data.radius * 0.5;

    // --- PROTEÇÃO ESPECÍFICA PARA FLUMINENSE (MATRIZES INCLINADAS) ---
    // Se a posição vier zerada mesmo após updateMatrixWorld, calcular manualmente
    if (targetPos.lengthSq() < 0.1 && body.data.name === 'Planeta Fluminense' && body.orbitGroup) {
        console.warn("⚠️ Fluminense Position Rescue Activated!");
        // O planeta está no bodyGroup, que está no orbitGroup
        // Posição local no bodyGroup: (0,0,0) (o mesh está no centro do grupo)
        // bodyGroup está em x = distance no orbitGroup
        // orbitGroup tem rotação X e Z

        // Simular a transformação
        const tempVec = new THREE.Vector3(body.distance, 0, 0); // Posição relativa ao centro da órbita
        const euler = new THREE.Euler(Math.PI / 4, 0, Math.PI / 8); // Rotação do orbitGroup
        tempVec.applyEuler(euler);
        targetPos.copy(tempVec);
    }
    // Se o objeto ainda não tiver posição (0,0,0), usar um fallback seguro
    if (targetPos.lengthSq() < 0.001 && body.type !== 'sun' && body.type !== 'whiteDwarf') {
        console.warn("⚠️ Alvo com posição zero detectado. Usando fallback de posição.");
        // Tentar obter posição do pai (orbitGroup) ou estimar baseada na distância
        if (body.distance) {
            targetPos.set(body.distance, 0, 0); // Posição estimada no eixo X
        } else {
            targetPos.set(100, 0, 0); // Fallback arbitrário seguro
        }
    }

    const currentVec = new THREE.Vector3().subVectors(camera.position, targetPos);
    // Se a câmera estiver exatamente no alvo (raro), evitar NaN
    if (currentVec.lengthSq() < 0.001) currentVec.set(0, 0, 1);

    const zoomPos = targetPos.clone().add(currentVec.normalize().multiplyScalar(distance));
    zoomPos.y = targetPos.y + yOffset;

    // Calcular direção para o Sol (0,0,0) - targetPos
    // Se targetPos for (0,0,0), sub() dá (0,0,0) e normalize() dá (0,0,0) ou NaN
    let toSun = new THREE.Vector3(0, 0, 0).sub(targetPos);
    if (toSun.lengthSq() < 0.001) {
        // Se estamos no centro (Sol), apontar para qualquer lugar (Z+)
        toSun.set(0, 0, 1);
    } else {
        toSun.normalize();
    }

    const dayPos = targetPos.clone().add(toSun.multiplyScalar(distance));
    dayPos.y += yOffset;

    isFlying = true;
    flightStartTime = performance.now();
    flightDuration = 1000; // 1 segundo cravado
    controls.enabled = false;

    flightStartPos.copy(camera.position);
    // VOO DIRETO PARA O LADO ILUMINADO (Day Side) para evitar "double approach"
    flightEndPos.copy(body.type === 'sun' || body.type === 'whiteDwarf' ? zoomPos : dayPos);
    flightStartTarget.copy(controls.target);
    flightEndTarget.copy(targetPos);

    // --- FINAL SAFETY CHECK ---
    if (isNaN(flightEndPos.x) || isNaN(flightEndPos.y) || isNaN(flightEndPos.z)) {
        console.error("🚨 CRITICAL: Flight Target is NaN. Aborting flight to prevent black screen.");
        focusedBody = null; // [FIX] Stop following the broken body

        // Se falhou e era Fluminense, tentar recuperar para um safe spot ou apenas cancelar
        if (body.data.name === 'Planeta Fluminense') {
            console.warn("Retrying flight safely...");
            // Opcional: tentar novamente com valores hardcoded se necessário, mas o abort é mais seguro.
        }

        camera.position.set(0, 100, 200);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        isFlying = false;
        return;
    }

    controls.enablePan = false;
}

// Auxiliar para atualizar apenas o conteúdo do painel (sem fechar/reabrir)
function updateInfoPanel(body) {
    const data = body.data;
    const infoName = document.getElementById('info-name');
    const infoAge = document.getElementById('info-age');
    const infoType = document.getElementById('info-type');
    const infoTranslation = document.getElementById('info-translation');
    const infoRotation = document.getElementById('info-rotation');
    const infoMoons = document.getElementById('info-moons');
    const infoDesc = document.getElementById('info-desc');

    // Exibir painel
    infoName.innerText = data.name;

    // Animar estatísticas individuais com Typewriter
    typeWriter(infoAge, data.info.age || '?', 10);
    typeWriter(infoType, data.info.type || '?', 10);
    typeWriter(infoTranslation, data.info.translation || '?', 10);
    typeWriter(infoRotation, data.info.rotation || '?', 10);
    typeWriter(infoMoons, data.info.moons || '0', 10);

    // 1. Limpar e Preparar Layout: Texto em cima, Botão embaixo
    infoDesc.innerHTML = '';

    const textContainer = document.createElement('div');
    textContainer.id = 'panel-content-area'; // Unique ID to avoid conflict with modals
    textContainer.style.marginBottom = '15px'; // Espaço para o botão
    infoDesc.appendChild(textContainer);

    // 2. Injetar Botão (Abaixo do texto)
    if (data.name === 'Sol' || (data.name === 'Gigante Vermelha' && explosionPhase === 1) || (data.name === 'Anã Branca' && explosionPhase === 3)) {
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'sun-trigger-btn';

        if (explosionPhase === 0) {
            triggerBtn.innerText = '⚠️ INICIAR SEQUÊNCIA FINAL';
            triggerBtn.onclick = () => {
                startExplosion();
                triggerBtn.remove();
            };
        } else if (explosionPhase === 1) { // Gigante Vermelha
            triggerBtn.innerText = '⏳ AGUARDANDO COLAPSO...';
            triggerBtn.style.opacity = '0.7';
            triggerBtn.disabled = true;
        } else if (explosionPhase === 3) { // Anã Branca
            triggerBtn.innerText = '↺ RENASCER SISTEMA';
            triggerBtn.onclick = () => {
                resetSolarSystem();
                triggerBtn.remove();
            };
        }
        infoDesc.appendChild(triggerBtn);
    }

    // --- LÓGICA DE EASTER EGGS (Delegação Imediata - CONSERTO DE REGRESSÃO) ---
    // Atachamos fora do callback para funcionar DURANTE a digitação
    let cheeseClicks = 0;
    infoDesc.onclick = (e) => {
        const egg = e.target.closest('.secret-interaction');
        if (!egg) return;
        e.stopPropagation();
        const category = egg.getAttribute('data-category') || 'moon';

        if (category === 'moon') {
            cheeseClicks++;
            if (cheeseClicks >= 10) {
                toggleMoonCheese(!isCheeseMode);
                cheeseClicks = 0;
            }
        } else {
            audioManager.playSecretAction(category);
            // Delay modal slightly to ensure audio start isn't blocked by DOM thrashing
            if (category === 'pluto' && !eggsFound.pluto) {
                setTimeout(() => showEasterInfo('pluto'), 100);
            }
        }
    };

    // Usar animação de Typewriter para a descrição
    const descContent = data.info.desc || '...';
    typeWriter(textContainer, descContent, 10);
}

let moonOriginalTexture = null;
let moonOriginalGeometry = null;
let moonMeshRef = null;
let originalInfo = {};
let isCheeseMode = false;

function toggleMoonCheese(enable) {
    const descEl = document.getElementById('info-desc');
    const ageEl = document.getElementById('info-age');
    const typeEl = document.getElementById('info-type');
    const transEl = document.getElementById('info-translation');
    const rotEl = document.getElementById('info-rotation');

    if (enable) {
        let body = focusedBody;
        if (!body || body.data.name !== 'Lua') {
            body = celestialBodies.find(b => b.data && b.data.name === 'Lua');
        }
        if (!body) return;

        if (!isCheeseMode) {
            moonMeshRef = body.mesh;

            moonOriginalTexture = body.mesh.material.map;
            moonOriginalGeometry = body.mesh.geometry;
            originalInfo = {
                desc: descEl.innerHTML,
                age: ageEl.innerText,
                type: typeEl.innerText,
                trans: transEl.innerText,
                rot: rotEl.innerText
            };

            const shape = new THREE.Shape();
            const angle = Math.PI / 4;
            const radius = 0.8;
            shape.moveTo(0, 0);
            shape.arc(0, 0, radius, 0, angle, false);
            shape.lineTo(0, 0);

            const extrudeSettings = {
                steps: 1,
                depth: 0.4,
                bevelEnabled: true,
                bevelThickness: 0.05,
                bevelSize: 0.05,
                bevelSegments: 4
            };

            const wedgeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            wedgeGeo.center();

            moonMeshRef.geometry = wedgeGeo;
            moonMeshRef.rotation.set(Math.PI / 3, Math.PI, Math.PI / 6);

            const loader = new THREE.TextureLoader();
            const cheeseTex = loader.load('assets/moon_cheese_texture.png');

            cheeseTex.wrapS = THREE.RepeatWrapping;
            cheeseTex.wrapT = THREE.RepeatWrapping;
            cheeseTex.repeat.set(2.0, 2.0);

            moonMeshRef.material.map = cheeseTex;
            moonMeshRef.material.color.setHex(0xffcc00);
            moonMeshRef.material.needsUpdate = true;

            descEl.innerHTML = "Eu sabia! A Lua é feita de <span class='easter-egg' style='color: #ffaa00; font-weight: bold;'>QUEIJO SUIÇO!</span> 🧀🐁";
            ageEl.innerText = "3 Meses (Maturado)";
            typeEl.innerText = "Fatia Cósmica";
            transEl.innerText = "0 dias (Degustação)";
            rotEl.innerText = "0 dias (Parado)";

            isCheeseMode = true;
            console.log("🧀 MOON CHEESE WEDGE ACTIVATED!");
            if (!eggsFound.moon) {
                eggsFound.moon = true;
                saveEggs();
                showEasterInfo('moon');
            }
        }
    } else {
        if (isCheeseMode) {
            if (moonMeshRef && moonOriginalTexture && moonOriginalGeometry) {
                moonMeshRef.geometry = moonOriginalGeometry;
                moonMeshRef.rotation.set(0, 0, 0);

                moonMeshRef.material.map = moonOriginalTexture;
                moonMeshRef.material.color.setHex(0xffffff);
                moonMeshRef.material.needsUpdate = true;
            }
            if (originalInfo.desc) {
                if (!focusedBody || focusedBody.data.name === 'Lua') {
                    descEl.innerHTML = originalInfo.desc;
                    ageEl.innerText = originalInfo.age;
                    typeEl.innerText = originalInfo.type;
                    transEl.innerText = originalInfo.trans;
                    rotEl.innerText = originalInfo.rot;
                }
            }

            isCheeseMode = false;
            moonOriginalTexture = null;
            moonOriginalGeometry = null;
            moonMeshRef = null;
            originalInfo = {};
            console.log("🧀 Cheese Mode Deactivated");
        }
    }
}

function closeInfo() {
    if (isCheeseMode) {
        toggleMoonCheese(false);
    }
    focusedBody = null;
    isFlying = false;
    isModalOpen = false; // [FIX] FPS volta ao normal imediatamente
    if (controls) {
        controls.enabled = true;
        controls.enableKeys = true;
        controls.enablePan = true;
    }

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.add('hidden');
    controls.minDistance = 0.1;
}

function onWindowResize() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    if (composer) composer.setSize(width, height);
    if (labelRenderer) labelRenderer.setSize(width, height);

    console.log(`📏 Layout Realigned: ${width}x${height}`);
}

function toggleAudio() {
    audioManager.toggle();
}


init();

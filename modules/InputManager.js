import * as THREE from 'three';
// [FIX] State injected via init to avoid module duplication issues
// import { state, saveEggs } from './GameState.js';
import { saveEggs } from './GameState.js?v=2'; // Keep saveEggs helper
import { audioManager } from './AudioManager.js?v=2';

let appState = null;

// Internal Interaction State (Senses)
export const inputState = {
    keyState: {},
    mouse: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    isHoveringLabel: false,
    typedBuffer: "",
    isTypingLocked: false,
    typingLockTimer: null,
    eggResetTimer: null,
    eggResetToast: null,
    selectedMenuItemIndex: -1
};

let uiCallbacks = {};

export function initInput(state, callbacks) {
    appState = state;
    uiCallbacks = callbacks;
    setupInputListeners();
}

function setupInputListeners() {
    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('contextmenu', onRightClick, { capture: true });
}

function handleBackAction() {
    // 1. Modal Overlay
    if (appState.isModalOpen) {
        if (uiCallbacks.closeActiveModal) uiCallbacks.closeActiveModal();
        return true;
    }

    // 2. Main Menu
    const infoMenu = document.getElementById('info-menu');
    if (infoMenu && !infoMenu.classList.contains('hidden')) {
        infoMenu.classList.add('hidden');
        appState.isInteractingWithUI = false;
        // Restore controls if this was the last blocker
        if (appState.controls) {
            appState.controls.enabled = true;
            appState.controls.enableKeys = true;
        }
        return true;
    }

    // 3. Planet Info Panel
    // Check global focused body or visibility of panel
    const infoPanel = document.getElementById('info-panel');
    const isPanelVisible = infoPanel && !infoPanel.classList.contains('hidden');

    if (appState.focusedBody || isPanelVisible) {
        if (uiCallbacks.closeInfo) uiCallbacks.closeInfo();
        return true;
    }

    return false;
}

// --- KEYBOARD LOGIC ---
function handleGlobalKeyDown(e) {
    // --- LÓGICA DE DIGITAÇÃO (FLUMINENSE) ---
    if (e.key.length === 1) {
        inputState.typedBuffer += e.key.toLowerCase();
        if (inputState.typedBuffer.length > 15) inputState.typedBuffer = inputState.typedBuffer.substring(inputState.typedBuffer.length - 15);

        // [FIX] Resetar buffer após 2s de inatividade
        if (window._bufferResetTimer) clearTimeout(window._bufferResetTimer);
        window._bufferResetTimer = setTimeout(() => {
            inputState.typedBuffer = "";
            inputState.isTypingLocked = false;
        }, 3000);

        // Se começar com "flu", bloqueamos teclas de atalho
        if (inputState.typedBuffer.includes("flu")) {
            if (!inputState.isTypingLocked) console.log("⚽ FLUMINENSE DETECTADO: Bloqueando I/M...");
            inputState.isTypingLocked = true;
        } else {
            inputState.isTypingLocked = false;
        }

        // GATILHO FINAL (Rivais)
        if (inputState.typedBuffer.endsWith("flamengo") || inputState.typedBuffer.endsWith("vasco") || inputState.typedBuffer.endsWith("botafogo")) {
            console.log("🤣 Rival detected: " + inputState.typedBuffer);
            if (window.RPOD && window.RPOD.showRPOD) {
                const msg = "ERRO CRÍTICO: Time Pequeno Detectado. Por favor, insira um time grande.";
                window.RPOD.showRPOD(msg, "Sistema", 0, 0, new Error("ExcecaoTimeRival: TimeDeBaixaQualidadeDetectado"));
            }
            inputState.typedBuffer = "";
        }

        if (inputState.typedBuffer.includes("fluminense")) {
            const alreadyExists = appState.celestialBodies.some(b => b.isEasterEgg && b.data.name === "Planeta Fluminense");
            if (alreadyExists) {
                console.log("🏆 Fluminense já está em campo!");
                inputState.typedBuffer = "";
                inputState.isTypingLocked = false;
                return;
            }

            // [FIX] Removed auto-unpause logic
            if (appState.isModalOpen && uiCallbacks.closeActiveModal) uiCallbacks.closeActiveModal();
            appState.isInteractingWithUI = false;

            console.log("🏆 VENCE O FLUMINENSE! Easter Egg Ativado.");
            if (uiCallbacks.createFluminensePlanet) uiCallbacks.createFluminensePlanet();

            if (!appState.eggsFound.fluminense) {
                audioManager.playSecretAction('fluminense', uiCallbacks.showEasterToast);
            } else if (audioManager.playHover) {
                audioManager.playHover();
            }

            inputState.typedBuffer = "";
            inputState.isTypingLocked = false;
            if (inputState.typingLockTimer) clearTimeout(inputState.typingLockTimer);
        }
    }

    if (inputState.isTypingLocked) return;

    inputState.keyState[e.code] = true;

    // Atalho para Música (M)
    if (e.code === 'KeyM' || e.key.toLowerCase() === 'm') {
        e.preventDefault(); e.stopImmediatePropagation();
        if (audioManager) audioManager.toggle();
        return;
    }

    // Navegação de Música
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

    // Spacebar: Toggle Time Pause
    if (e.code === 'Space') {
        e.preventDefault();
        if (uiCallbacks.toggleTimePause) uiCallbacks.toggleTimePause();
        return;
    }

    // ESC Handler (Global Priority)
    if (e.code === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation();

        if (handleBackAction()) return;

        // 4. Fallback: Open Main Menu
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) infoBtn.click();
        return;
    }

    // BLOQUEIO UI
    if (appState.isInteractingWithUI || appState.isModalOpen) {
        if (e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'Space') {
            const infoMenu = document.getElementById('info-menu');
            if (infoMenu && !infoMenu.classList.contains('hidden')) {
                const items = Array.from(document.querySelectorAll('.info-menu-item'));
                if (e.code === 'ArrowDown') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    inputState.selectedMenuItemIndex = (inputState.selectedMenuItemIndex + 1) % items.length;
                    updateMenuSelection(items);
                    return;
                } else if (e.code === 'ArrowUp') {
                    e.preventDefault(); e.stopImmediatePropagation();
                    inputState.selectedMenuItemIndex = (inputState.selectedMenuItemIndex - 1 + items.length) % items.length;
                    updateMenuSelection(items);
                    return;
                } else if (e.code === 'Enter' && inputState.selectedMenuItemIndex !== -1) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    items[inputState.selectedMenuItemIndex].click();
                    return;
                }
            }

            if ((e.code === 'Enter' || e.code === 'Space') && appState.isModalOpen) {
                const closeBtn = document.getElementById('close-modal-btn');
                if (closeBtn) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    closeBtn.click();
                    return;
                }
            }

            if (e.code.startsWith('Arrow') || e.code === 'Space') {
                e.stopImmediatePropagation(); e.preventDefault();
            }
        }
    }

    if (e.code === 'KeyI' && !appState.isModalOpen) {
        e.preventDefault();
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) infoBtn.click();
    }


    // Reset Easter Eggs (Delete)
    if (e.code === 'Delete') {
        const hasAnyEgg = Object.values(appState.eggsFound).some(v => v === true);
        if (hasAnyEgg && !inputState.eggResetTimer) {
            inputState.eggResetToast = document.createElement('div');
            inputState.eggResetToast.style.cssText = `
                position: fixed; top: 20px; right: 20px; background: rgba(255, 50, 50, 0.9);
                color: white; padding: 15px 25px; border-radius: 10px; border: 2px solid white;
                font-family: 'Exo 2', sans-serif; font-weight: bold; z-index: 12000;
                box-shadow: 0 0 20px rgba(0,0,0,0.5); text-align: center;
            `;
            inputState.eggResetToast.innerHTML = '🔥 Mantenha DEL pressionado para resetar segredos... (5s)';
            document.body.appendChild(inputState.eggResetToast);
            let secondsLeft = 5;
            inputState.eggResetTimer = setInterval(() => {
                secondsLeft--;
                if (inputState.eggResetToast) inputState.eggResetToast.innerHTML = `🔥 Mantenha DEL pressionado para resetar segredos... (${secondsLeft}s)`;
                if (secondsLeft <= 0) {
                    clearInterval(inputState.eggResetTimer);
                    inputState.eggResetTimer = null;
                    appState.eggsFound = { pluto: false, moon: false, fluminense: false };
                    saveEggs(appState.eggsFound);
                    if (audioManager.playResetSound) audioManager.playResetSound();
                    inputState.eggResetToast.style.background = 'rgba(0, 255, 100, 0.9)';
                    inputState.eggResetToast.innerHTML = '✨ Segredos resetados com sucesso!';
                    setTimeout(() => { if (inputState.eggResetToast) inputState.eggResetToast.remove(); inputState.eggResetToast = null; }, 2000);
                }
            }, 1000);
        }
    }
}

function handleGlobalKeyUp(e) {
    inputState.keyState[e.code] = false;
    if (e.code === 'Delete' && inputState.eggResetTimer) {
        clearInterval(inputState.eggResetTimer);
        inputState.eggResetTimer = null;
        if (inputState.eggResetToast) {
            inputState.eggResetToast.remove();
            inputState.eggResetToast = null;
        }
    }
}

// --- MOUSE LOGIC ---
function onMouseMove(event) {
    if (appState.isInteractingWithUI) return;
    if (inputState.isHoveringLabel) return;

    inputState.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    inputState.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    inputState.raycaster.setFromCamera(inputState.mouse, appState.camera);

    const sunBodyForFilter = appState.celestialBodies.find(b => b.type === 'sun');
    const sunMeshForFilter = sunBodyForFilter ? sunBodyForFilter.mesh : null;

    const meshes = appState.celestialBodies.map(b => b.mesh).filter(m => {
        if (!m || !m.visible) return false;
        if (appState.explosionActive && appState.explosionPhase === 3 && m === sunMeshForFilter) return false;
        return true;
    });

    if (appState.whiteDwarfMesh && appState.whiteDwarfMesh.visible && !meshes.includes(appState.whiteDwarfMesh)) {
        meshes.push(appState.whiteDwarfMesh);
    }

    const intersects = inputState.raycaster.intersectObjects(meshes);

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel && !infoPanel.classList.contains('hidden')) {
        const rect = infoPanel.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            document.body.style.cursor = 'default';
            if (appState.hoveredBody) {
                highlightBody(appState.hoveredBody, false);
                appState.hoveredBody = null;
            }
            return;
        }
    }

    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        let body;
        if (hitObj === appState.whiteDwarfMesh) {
            body = appState.whiteDwarfMesh.body;
        } else {
            body = appState.celestialBodies.find(b => b.mesh === hitObj);
        }

        if (body && appState.hoveredBody !== body) {
            if (appState.hoveredBody) highlightBody(appState.hoveredBody, false);
            appState.hoveredBody = body;
            highlightBody(body, true);
        }
    } else {
        if (appState.hoveredBody) {
            highlightBody(appState.hoveredBody, false);
            appState.hoveredBody = null;
        }
        document.body.style.cursor = 'default';
    }
}

function onMouseClick(event) {
    if (appState.isInteractingWithUI) return;
    if (appState.hoveredBody) {
        if (!appState.hoveredBody.data || !appState.hoveredBody.mesh) return;
        if (!appState.hoveredBody.mesh.visible) return;
        if (appState.hoveredBody.type === 'moon' && appState.hoveredBody.data.name !== 'Lua') return;
        focusOnPlanet(appState.hoveredBody);
    }
}

function onRightClick(event) {
    // Prevent default context menu
    event.preventDefault();
    event.stopPropagation();

    // Trigger "Back" logic
    handleBackAction();
}

// --- SPECIALIZED INTERACTION ---
export function focusOnPlanet(body) {
    if (!body || !body.mesh) return;

    if (isNaN(appState.camera.position.x) || isNaN(appState.camera.position.y) || isNaN(appState.camera.position.z)) {
        appState.camera.position.set(0, 100, 200);
        appState.camera.lookAt(0, 0, 0);
    }

    if (body.mesh.parent) body.mesh.parent.updateMatrixWorld(true);
    body.mesh.updateMatrixWorld(true);
    appState.scene.updateMatrixWorld(true);

    if (appState.focusedBody && appState.focusedBody.data.name === 'Lua' && appState.isCheeseMode && appState.focusedBody !== body) {
        if (uiCallbacks.toggleMoonCheese) uiCallbacks.toggleMoonCheese(false);
    }

    if (appState.focusedBody === body && appState.isModalOpen) return;

    appState.focusedBody = body;
    if (uiCallbacks.updateInfoPanel) uiCallbacks.updateInfoPanel(body);

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.remove('hidden');
    // appState.isModalOpen = true; // [FIX] Side panel is not a modal overlay
    if (appState.controls) appState.controls.enableKeys = false;

    const targetPos = new THREE.Vector3();
    body.mesh.getWorldPosition(targetPos);

    const distance = body.data.radius * 7.0;
    const yOffset = body.data.radius * 0.5;

    if (targetPos.lengthSq() < 0.1 && body.data.name === 'Planeta Fluminense' && body.orbitGroup) {
        const tempVec = new THREE.Vector3(body.distance, 0, 0);
        const euler = new THREE.Euler(Math.PI / 4, 0, Math.PI / 8);
        tempVec.applyEuler(euler);
        targetPos.copy(tempVec);
    }

    if (targetPos.lengthSq() < 0.001 && body.type !== 'sun' && body.type !== 'whiteDwarf') {
        if (body.distance) targetPos.set(body.distance, 0, 0);
        else targetPos.set(100, 0, 0);
    }

    const currentVec = new THREE.Vector3().subVectors(appState.camera.position, targetPos);
    if (currentVec.lengthSq() < 0.001) currentVec.set(0, 0, 1);

    const zoomPos = targetPos.clone().add(currentVec.normalize().multiplyScalar(distance));
    zoomPos.y = targetPos.y + yOffset;

    let toSun = new THREE.Vector3(0, 0, 0).sub(targetPos);
    if (toSun.lengthSq() < 0.001) toSun.set(0, 0, 1); else toSun.normalize();

    const dayPos = targetPos.clone().add(toSun.multiplyScalar(distance));
    dayPos.y += yOffset;

    appState.isFlying = true;
    appState.flightStartTime = performance.now();
    appState.flightDuration = 1000;
    appState.controls.enabled = false;

    appState.flightStartPos = appState.camera.position.clone();
    appState.flightEndPos = (body.type === 'sun' || body.type === 'whiteDwarf' ? zoomPos : dayPos);
    appState.flightStartTarget = appState.controls.target.clone();
    appState.flightEndTarget = targetPos.clone();

    if (isNaN(appState.flightEndPos.x) || isNaN(appState.flightEndPos.y) || isNaN(appState.flightEndPos.z)) {
        appState.focusedBody = null;
        appState.camera.position.set(0, 100, 200);
        appState.camera.lookAt(0, 0, 0);
        appState.controls.target.set(0, 0, 0);
        appState.isFlying = false;
        return;
    }

    appState.controls.enablePan = false;
}

export function highlightBody(body, active) {
    document.body.style.cursor = active ? 'pointer' : 'default';
    if (active && audioManager) audioManager.playHover();

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
        }
    }

    if (body.mesh && body.mesh.material && body.mesh.material.emissive) {
        if (body.data.name === 'Terra') {
            body.mesh.material.emissiveIntensity = 1.0;
            body.mesh.material.emissive.setHex(0xffffff);
        } else if (body.type === 'sun' || body.type === 'whiteDwarf') {
            if (appState.explosionActive && body.type === 'sun') return;
            if (body.type === 'whiteDwarf') {
                body.mesh.material.emissive.setHex(0xffffff);
                body.mesh.material.emissiveIntensity = 4.0;
            } else {
                body.mesh.material.emissiveIntensity = 2.5;
                body.mesh.material.emissive.setHex(appState.explosionActive ? 0xff4400 : 0xffaa00);
            }
        } else {
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

export function setupLabelInteraction(labelDiv, body) {
    labelDiv.style.cursor = 'pointer';
    labelDiv.onclick = (e) => {
        e.stopPropagation();
        focusOnPlanet(body);
    };
    labelDiv.onmouseenter = () => {
        inputState.isHoveringLabel = true;
        highlightBody(body, true);
    };
    labelDiv.onmouseleave = () => {
        inputState.isHoveringLabel = false;
        highlightBody(body, false);
    };
}

function updateMenuSelection(items) {
    items.forEach((item, index) => {
        if (index === inputState.selectedMenuItemIndex) {
            item.classList.add('selected');
            if (audioManager) audioManager.playHover();
        } else {
            item.classList.remove('selected');
        }
    });
}

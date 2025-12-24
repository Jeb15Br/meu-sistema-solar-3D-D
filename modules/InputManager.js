import * as THREE from 'three';
import { state, saveEggs } from './GameState.js';
import { audioManager } from './AudioManager.js';

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

export function initInput(callbacks) {
    uiCallbacks = callbacks;

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    window.addEventListener('keyup', handleGlobalKeyUp, { capture: true });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
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
            const alreadyExists = state.celestialBodies.some(b => b.isEasterEgg && b.data.name === "Fluminense");
            if (alreadyExists) {
                console.log("🏆 Fluminense já está em campo!");
                inputState.typedBuffer = "";
                inputState.isTypingLocked = false;
                return;
            }

            if (state.isTimePaused && uiCallbacks.toggleTimePause) uiCallbacks.toggleTimePause();
            if (state.isModalOpen && uiCallbacks.closeActiveModal) uiCallbacks.closeActiveModal();
            state.isInteractingWithUI = false;

            console.log("🏆 VENCE O FLUMINENSE! Easter Egg Ativado.");
            if (uiCallbacks.createFluminensePlanet) uiCallbacks.createFluminensePlanet();

            if (!state.eggsFound.fluminense) {
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

    // BLOQUEIO UI
    if (state.isInteractingWithUI || state.isModalOpen) {
        if (e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
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

            if ((e.code === 'Enter' || e.code === 'Space') && state.isModalOpen) {
                const closeBtn = document.getElementById('close-modal-btn');
                if (closeBtn) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    closeBtn.click();
                    return;
                }
            }

            if (e.code === 'Escape') {
                e.preventDefault(); e.stopImmediatePropagation();
                if (state.isModalOpen) {
                    if (uiCallbacks.closeActiveModal) uiCallbacks.closeActiveModal();
                } else if (infoMenu && !infoMenu.classList.contains('hidden')) {
                    infoMenu.classList.add('hidden');
                    state.isInteractingWithUI = false;
                    if (state.controls) {
                        state.controls.enabled = true;
                        state.controls.enableKeys = true;
                    }
                } else if (state.focusedBody) {
                    if (uiCallbacks.closeInfo) uiCallbacks.closeInfo();
                }
                return;
            }

            if (e.code.startsWith('Arrow') || e.code === 'Space') {
                e.stopImmediatePropagation(); e.preventDefault();
            }
        }
    }

    if (e.code === 'KeyI' && !state.isModalOpen) {
        e.preventDefault();
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) infoBtn.click();
    }

    // Zoom (Z/X)
    if (!state.isInteractingWithUI && !state.isModalOpen) {
        if (e.code === 'KeyZ') {
            const dist = state.camera.position.distanceTo(state.controls.target);
            if (dist > state.controls.minDistance) {
                const moveDir = new THREE.Vector3().subVectors(state.controls.target, state.camera.position).normalize();
                state.camera.position.add(moveDir.multiplyScalar(dist * 0.1));
                state.controls.update();
            }
        } else if (e.code === 'KeyX') {
            const dist = state.camera.position.distanceTo(state.controls.target);
            if (dist < state.controls.maxDistance) {
                const moveDir = new THREE.Vector3().subVectors(state.camera.position, state.controls.target).normalize();
                state.camera.position.add(moveDir.multiplyScalar(dist * 0.1));
                state.controls.update();
            }
        }
    }

    // Reset Easter Eggs (Delete)
    if (e.code === 'Delete') {
        const hasAnyEgg = Object.values(state.eggsFound).some(v => v === true);
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
                    state.eggsFound = { pluto: false, moon: false, fluminense: false };
                    saveEggs();
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
    if (state.isInteractingWithUI) return;
    if (inputState.isHoveringLabel) return;

    inputState.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    inputState.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    inputState.raycaster.setFromCamera(inputState.mouse, state.camera);

    const sunBodyForFilter = state.celestialBodies.find(b => b.type === 'sun');
    const sunMeshForFilter = sunBodyForFilter ? sunBodyForFilter.mesh : null;

    const meshes = state.celestialBodies.map(b => b.mesh).filter(m => {
        if (!m || !m.visible) return false;
        if (state.explosionActive && state.explosionPhase === 3 && m === sunMeshForFilter) return false;
        return true;
    });

    if (state.whiteDwarfMesh && state.whiteDwarfMesh.visible && !meshes.includes(state.whiteDwarfMesh)) {
        meshes.push(state.whiteDwarfMesh);
    }

    const intersects = inputState.raycaster.intersectObjects(meshes);

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel && !infoPanel.classList.contains('hidden')) {
        const rect = infoPanel.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            document.body.style.cursor = 'default';
            if (state.hoveredBody) {
                highlightBody(state.hoveredBody, false);
                state.hoveredBody = null;
            }
            return;
        }
    }

    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        let body;
        if (hitObj === state.whiteDwarfMesh) {
            body = state.whiteDwarfMesh.body;
        } else {
            body = state.celestialBodies.find(b => b.mesh === hitObj);
        }

        if (body && state.hoveredBody !== body) {
            if (state.hoveredBody) highlightBody(state.hoveredBody, false);
            state.hoveredBody = body;
            highlightBody(body, true);
        }
    } else {
        if (state.hoveredBody) {
            highlightBody(state.hoveredBody, false);
            state.hoveredBody = null;
        }
        document.body.style.cursor = 'default';
    }
}

function onMouseClick(event) {
    if (state.isInteractingWithUI) return;
    if (state.hoveredBody) {
        if (!state.hoveredBody.data || !state.hoveredBody.mesh) return;
        if (!state.hoveredBody.mesh.visible) return;
        if (state.hoveredBody.type === 'moon' && state.hoveredBody.data.name !== 'Lua') return;
        focusOnPlanet(state.hoveredBody);
    }
}

// --- SPECIALIZED INTERACTION ---
export function focusOnPlanet(body) {
    if (!body || !body.mesh) return;

    if (isNaN(state.camera.position.x) || isNaN(state.camera.position.y) || isNaN(state.camera.position.z)) {
        state.camera.position.set(0, 100, 200);
        state.camera.lookAt(0, 0, 0);
    }

    if (body.mesh.parent) body.mesh.parent.updateMatrixWorld(true);
    body.mesh.updateMatrixWorld(true);
    state.scene.updateMatrixWorld(true);

    if (state.focusedBody && state.focusedBody.data.name === 'Lua' && state.isCheeseMode && state.focusedBody !== body) {
        if (uiCallbacks.toggleMoonCheese) uiCallbacks.toggleMoonCheese(false);
    }

    if (state.focusedBody === body && state.isModalOpen) return;

    state.focusedBody = body;
    if (uiCallbacks.updateInfoPanel) uiCallbacks.updateInfoPanel(body);

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.remove('hidden');
    state.isModalOpen = true;
    if (state.controls) state.controls.enableKeys = false;

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

    const currentVec = new THREE.Vector3().subVectors(state.camera.position, targetPos);
    if (currentVec.lengthSq() < 0.001) currentVec.set(0, 0, 1);

    const zoomPos = targetPos.clone().add(currentVec.normalize().multiplyScalar(distance));
    zoomPos.y = targetPos.y + yOffset;

    let toSun = new THREE.Vector3(0, 0, 0).sub(targetPos);
    if (toSun.lengthSq() < 0.001) toSun.set(0, 0, 1); else toSun.normalize();

    const dayPos = targetPos.clone().add(toSun.multiplyScalar(distance));
    dayPos.y += yOffset;

    state.isFlying = true;
    state.flightStartTime = performance.now();
    state.flightDuration = 1000;
    state.controls.enabled = false;

    state.flightStartPos = state.camera.position.clone();
    state.flightEndPos = (body.type === 'sun' || body.type === 'whiteDwarf' ? zoomPos : dayPos);
    state.flightStartTarget = state.controls.target.clone();
    state.flightEndTarget = targetPos.clone();

    if (isNaN(state.flightEndPos.x) || isNaN(state.flightEndPos.y) || isNaN(state.flightEndPos.z)) {
        state.focusedBody = null;
        state.camera.position.set(0, 100, 200);
        state.camera.lookAt(0, 0, 0);
        state.controls.target.set(0, 0, 0);
        state.isFlying = false;
        return;
    }

    state.controls.enablePan = false;
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
            if (state.explosionActive && body.type === 'sun') return;
            if (body.type === 'whiteDwarf') {
                body.mesh.material.emissive.setHex(0xffffff);
                body.mesh.material.emissiveIntensity = 4.0;
            } else {
                body.mesh.material.emissiveIntensity = 2.5;
                body.mesh.material.emissive.setHex(state.explosionActive ? 0xff4400 : 0xffaa00);
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

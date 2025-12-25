import * as THREE from 'three';
// [FIX] State injected via init to avoid module duplication issues
// import { state } from './GameState.js'; 
import { inputState, highlightBody, focusOnPlanet } from './InputManager.js?v=2';
import { updateInfoPanel, closeInfo, closeActiveModal, showEntropyMessage } from './UIManager.js?v=2';
import { audioManager } from './AudioManager.js?v=2';

let appState = null;

// --- FPS MONITORING STATE ---
let lastFpsUpdateTime = performance.now();
let frames = 0;
let fps = 0;
let fpsLowCounter = 0;
let isFpsVisible = false;

// --- UTILS ---
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

const getPeriodInDays = (str) => {
    if (!str) return 365;
    if (str.includes('anos')) return parseFloat(str) * 365.25;
    const val = parseFloat(str);
    return isNaN(val) ? 365 : val;
};

export const simulationManager = {
    init: function (state) {
        appState = state;
    },

    updateSimulation: function (delta, now) {
        if (!appState) return;

        // 1. Date Update
        if (!appState.isTimePaused) {
            // Note: isPageVisible check removed or needs explicit handling if passed in state
            if (appState.timeScale !== 0) {
                const msPerDay = 24 * 60 * 60 * 1000;
                // daysToAdvance logic
                let daysToAdvance = 0;
                if (appState.isRealTime) {
                    daysToAdvance = delta / 86400;
                } else {
                    daysToAdvance = delta * appState.timeScale;
                }

                const nextDate = new Date(appState.currentDate);
                nextDate.setDate(appState.currentDate.getDate() + daysToAdvance);
                nextDate.setTime(nextDate.getTime() + (daysToAdvance % 1) * 86400 * 1000);
                appState.currentDate = nextDate;
            }
        }

        this.updateDateDisplay();

        // 2. Planets & Moons Orbits
        // Use actualDelta for rotation
        let actualDelta = delta;
        if (!appState.isRealTime) {
            actualDelta = delta * appState.timeScale;
        }

        appState.celestialBodies.forEach(body => {
            if (body.type === 'planet') {
                // Orbit Rotation (Revolution)
                // We calculate angle based on total days passed since start or standard epoch
                // Simplified: increment rotation based on speed
                // Or better: keep the existing logic if possible. 
                // Previous logic used currentDate to calculate exact angle, which is more accurate for date skipping.

                const startOfYear = new Date(appState.currentDate.getFullYear(), 0, 1);
                const dayOfYear = (appState.currentDate - startOfYear) / (1000 * 60 * 60 * 24);

                let angle;
                if (body.data.name === 'Terra') {
                    const yearFraction = dayOfYear / 365.25;
                    angle = yearFraction * Math.PI * 2;
                } else {
                    // Generic Kepler approximation
                    // We need startAngle and period.
                    const period = getPeriodInDays(body.data.info.translation);
                    // Total days from arbitrary epoch? let's use current date timestamp day
                    const totalDays = appState.currentDate.getTime() / (24 * 60 * 60 * 1000);
                    angle = (totalDays / period) * Math.PI * 2 + (body.data.startAngle || 0);
                }

                if (body.orbitGroup) body.orbitGroup.rotation.y = angle;
                else if (body.orbit) body.orbit.rotation.y = angle;

                // Self Rotation
                if (body.mesh) {
                    const rotDir = body.data.retrograde ? -1 : 1;
                    // Rotation speed is usually faster. Simplified here:
                    // 0.6 * delta is arbitrary.
                    const period = getPeriodInDays(body.data.info.rotation) || 1;
                    // If period is days, and we want real days:
                    // angle += (actualDeltaInDays) * 2PI
                    // For visual effect we often speed up self-rotation
                    body.mesh.rotation.y += (0.5 * delta) * rotDir;
                }

            } else if (body.type === 'moon') {
                if (!appState.isTimePaused) {
                    // Moons orbit around planet
                    body.orbit.rotation.y += body.speed * appState.timeScale * (delta * 3.0);
                }
            }
        });

        // 3. Belts
        if (!appState.isTimePaused) {
            if (appState.asteroidSystem) appState.asteroidSystem.rotation.y += (0.03 * delta) * appState.timeScale;
            if (appState.kuiperSystem) appState.kuiperSystem.rotation.y += (0.012 * delta) * appState.timeScale;
        }

        // 4. Flight Interpolation
        this.handleFlight(now);

        // 5. Camera Movement (WASD)
        this.handleCameraMovement(delta);

        // 6. Focus Logic
        this.handleFocusTarget();

        // 7. Explosion Sequence
        if (appState.explosionActive) {
            this.handleExplosion(delta);
        }

        // 8. FPS Update
        this.updateFPS();
    },

    updateDateDisplay: function () {
        const day = String(appState.currentDate.getDate()).padStart(2, '0');
        const month = String(appState.currentDate.getMonth() + 1).padStart(2, '0');
        const year = appState.currentYearAstronomical !== null ? appState.currentYearAstronomical : appState.currentDate.getFullYear();
        const hours = String(appState.currentDate.getHours()).padStart(2, '0');
        const minutes = String(appState.currentDate.getMinutes()).padStart(2, '0');
        const seconds = String(appState.currentDate.getSeconds()).padStart(2, '0');
        const dateStr = `${day} / ${month} / ${year} ${hours}:${minutes}:${seconds}`;

        const dateDisplay = document.getElementById('date-display');
        if (dateDisplay && dateDisplay.getAttribute('data-last') !== dateStr) {
            dateDisplay.innerText = dateStr;
            dateDisplay.setAttribute('data-last', dateStr);
        }
    },

    handleFlight: function (now) {
        if (appState.isFlying) {
            if (!appState.focusedBody) {
                appState.isFlying = false;
                appState.controls.enabled = true;
            } else {
                const elapsed = now - appState.flightStartTime;
                let progress = elapsed / appState.flightDuration;

                if (progress >= 1) {
                    progress = 1;
                    appState.isFlying = false;
                    appState.isModalOpen = false;
                    if (appState.controls) {
                        appState.controls.enabled = true;
                        appState.controls.enableKeys = true;
                        appState.controls.enablePan = true;
                    }
                }
                const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
                const eased = easeInOutSine(progress);

                appState.camera.position.lerpVectors(appState.flightStartPos, appState.flightEndPos, eased);
                appState.controls.target.lerpVectors(appState.flightStartTarget, appState.flightEndTarget, eased);
                appState.controls.update();
            }
        }
    },

    handleFocusTarget: function () {
        if (!appState.isFlying && appState.focusedBody && appState.focusedBody.mesh) {
            const targetPos = new THREE.Vector3();
            appState.focusedBody.mesh.getWorldPosition(targetPos);
            const diff = new THREE.Vector3().subVectors(targetPos, appState.controls.target);
            appState.camera.position.add(diff);
            appState.controls.target.copy(targetPos);
        }
    },

    handleCameraMovement: function (delta) {
        const moveTotal = new THREE.Vector3();
        const cameraSpeed = 150 * delta;

        if (!appState.isInteractingWithUI && !appState.isModalOpen) {
            if (inputState.keyState['KeyW'] || inputState.keyState['ArrowUp']) {
                const forward = new THREE.Vector3();
                appState.camera.getWorldDirection(forward);
                moveTotal.add(forward.multiplyScalar(cameraSpeed));
            }
            if (inputState.keyState['KeyS'] || inputState.keyState['ArrowDown']) {
                const backward = new THREE.Vector3();
                appState.camera.getWorldDirection(backward);
                moveTotal.add(backward.multiplyScalar(-cameraSpeed));
            }
            if (inputState.keyState['KeyA'] || inputState.keyState['ArrowLeft']) {
                const right = new THREE.Vector3();
                const forward = new THREE.Vector3();
                appState.camera.getWorldDirection(forward);
                right.crossVectors(forward, appState.camera.up).normalize();
                moveTotal.add(right.multiplyScalar(-cameraSpeed));
            }
            if (inputState.keyState['KeyD'] || inputState.keyState['ArrowRight']) {
                const right = new THREE.Vector3();
                const forward = new THREE.Vector3();
                appState.camera.getWorldDirection(forward);
                right.crossVectors(forward, appState.camera.up).normalize();
                moveTotal.add(right.multiplyScalar(cameraSpeed));
            }

            // New Controls: Elevation (Z/X) & Zoom (C/V)
            if (inputState.keyState['KeyZ']) {
                moveTotal.y += cameraSpeed;
            }
            if (inputState.keyState['KeyX']) {
                moveTotal.y -= cameraSpeed;
            }
            if (inputState.keyState['KeyC']) {
                const forward = new THREE.Vector3();
                appState.camera.getWorldDirection(forward);
                moveTotal.add(forward.multiplyScalar(cameraSpeed));
            }
            if (inputState.keyState['KeyV']) {
                const backward = new THREE.Vector3();
                appState.camera.getWorldDirection(backward);
                moveTotal.add(backward.multiplyScalar(-cameraSpeed));
            }
        }

        const isMoving = moveTotal.lengthSq() > 0;
        if (isMoving && appState.focusedBody) {
            moveTotal.set(0, 0, 0); // Don't allow manual movement when focused on a planet
        }

        if (isMoving) {
            appState.camera.position.add(moveTotal);
            if (!appState.focusedBody) {
                appState.controls.target.add(moveTotal);

                // Pivot Fix
                const dist = appState.camera.position.distanceTo(appState.controls.target);
                if (dist > 100) {
                    const direction = new THREE.Vector3().subVectors(appState.controls.target, appState.camera.position).normalize();
                    appState.controls.target.copy(appState.camera.position).add(direction.multiplyScalar(100));
                }
                appState.controls.update();
            }
        }
    },

    handleExplosion: function (delta) {
        const sun = appState.celestialBodies.find(b => b.type === 'sun');
        if (!sun) return;

        if (appState.explosionPhase === 1) {
            const expansionSpeed = 0.08 * delta;
            sun.mesh.scale.addScalar(expansionSpeed);
            sun.mesh.material.emissive.lerp(new THREE.Color(0xff4400), expansionSpeed);
            sun.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(sun.mesh.material.emissiveIntensity, 5, expansionSpeed);
            appState.sunLight.color.lerp(new THREE.Color(0xffccaa), 0.3 * delta);
            appState.sunLight.intensity = THREE.MathUtils.lerp(appState.sunLight.intensity, 10, expansionSpeed);

            // Retreat camera if too close
            if (appState.focusedBody && (appState.focusedBody.type === 'sun' || appState.focusedBody.type === 'whiteDwarf')) {
                const sunPos = sun.mesh.position;
                const camDist = appState.camera.position.distanceTo(sunPos);
                if (camDist < 300) {
                    const retreatDir = new THREE.Vector3().subVectors(appState.camera.position, sunPos).normalize();
                    const moveVec = retreatDir.multiplyScalar(8 * delta);
                    moveVec.y += 2.5 * delta;
                    appState.camera.position.add(moveVec);
                    appState.controls.target.lerp(sunPos, 2 * delta);
                }
            }

            // Update Sun status to Red Giant
            if (sun.data && !sun.data.isGiant) {
                sun.data.isGiant = true;
                sun.data.name = "Gigante Vermelha";
                sun.data.info.desc = "O Sol esgotou seu hidrogênio e expandiu, engolindo os planetas internos. <br><br><strong>Status:</strong> Colapso Iminente.";
                sun.data.info.type = "Gigante Vermelha";
                sun.data.info.age = "5.0 Bi Anos";
                sun.data.info.translation = "?";
                // [FIX] Info panel update moved to startExplosion to prevent spam
            }

            if (sun.label) sun.label.element.style.display = 'none';

            // Consume internal planets
            const sunRadius = sun.mesh.geometry.parameters.radius * sun.mesh.scale.x;
            let earthConsumed = false;

            appState.celestialBodies.forEach(body => {
                if ((body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') && body.mesh.visible) {
                    const dist = body.distance || 0;
                    if (dist < sunRadius) {
                        body.mesh.visible = false;
                        if (body.orbitGroup) body.orbitGroup.visible = false;
                        if (body.orbitPath) body.orbitPath.visible = false;
                        if (body.label) body.label.element.style.display = 'none';
                        if (body.data.name === 'Terra') earthConsumed = true;
                    }
                } else if (body.data.name === 'Terra' && !body.mesh.visible) {
                    earthConsumed = true;
                }
            });

            if (earthConsumed) {
                this.transitionToWhiteDwarf(sun);
            }
        } else if (appState.explosionPhase === 3) {
            this.handleFadeOut(delta, sun);
        }
    },

    transitionToWhiteDwarf: function (sun) {
        appState.explosionPhase = 3;
        sun.mesh.material.transparent = true;
        sun.mesh.material.needsUpdate = true;
        highlightBody(sun, false);
        appState.whiteDwarfMesh.visible = true;
        if (appState.whiteDwarfMesh.material) {
            appState.whiteDwarfMesh.material.emissiveIntensity = 4.0;
            appState.whiteDwarfMesh.material.emissive.setHex(0xffffff);
        }
        if (appState.whiteDwarfMesh.body && appState.whiteDwarfMesh.body.label) {
            appState.whiteDwarfMesh.body.label.element.style.display = 'block';
        }
        appState.sunLight.color.setHex(0xffffff);
        appState.sunLight.intensity = 0.5;

        // Auto-focus on White Dwarf
        if (appState.focusedBody === sun) {
            appState.focusedBody = appState.whiteDwarfMesh.body;
            updateInfoPanel(appState.focusedBody);
        }
    },

    handleFadeOut: function (delta, sun) {
        sun.mesh.material.opacity -= 0.5 * delta;
        if (sun.mesh.material.opacity <= 0) {
            sun.mesh.visible = false;
        }

        // Push outer planets away
        appState.celestialBodies.forEach(body => {
            if ((body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') && body.mesh.visible) {
                const targetDist = body.originalDistance * 2.2;
                const targetSpeed = body.originalSpeed * 0.2;
                const lerpFactor = 0.08 * delta;
                body.distance = THREE.MathUtils.lerp(body.distance, targetDist, lerpFactor);
                body.speed = THREE.MathUtils.lerp(body.speed, targetSpeed, lerpFactor);

                if (body.bodyGroup) body.bodyGroup.position.x = body.distance;
                else if (body.type === 'moon' && body.mesh) body.mesh.position.x = body.distance;

                if (body.orbitPath) {
                    const orbitScale = body.distance / body.originalDistance;
                    body.orbitPath.scale.set(orbitScale, orbitScale, 1);
                }
            }
        });

        const beltLerpFactor = 0.05 * delta;
        const targetBeltScale = 2.2;
        if (appState.asteroidSystem) appState.asteroidSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
        if (appState.kuiperSystem) appState.kuiperSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
    },

    startExplosion: function () {
        if (appState.explosionPhase !== 0) return;
        appState.explosionActive = true;
        appState.explosionPhase = 1;
        appState.explosionTime = 0;

        // [FIX] Force menu update immediately
        const sun = appState.celestialBodies.find(b => b.type === 'sun');
        if (appState.focusedBody === sun) {
            updateInfoPanel(sun);
        }

        appState.currentYearAstronomical = "+/- 5 bilhões de anos (aprox.)";
        console.log("🚀 SimulationManager: Starting Final Sequence");
    },

    resetSolarSystem: function () {
        appState.explosionActive = false;
        appState.explosionPhase = 0;
        appState.currentYearAstronomical = null;
        appState.currentDate = new Date();

        const sun = appState.celestialBodies.find(b => b.type === 'sun');
        if (sun) {
            sun.mesh.scale.set(1, 1, 1);
            sun.mesh.visible = true;
            sun.mesh.material.emissive.setHex(0xffaa00);
            sun.mesh.material.emissiveIntensity = 2;
            sun.mesh.material.transparent = false;
            sun.mesh.material.opacity = 1;
            sun.mesh.material.needsUpdate = true;
            sun.data.isGiant = false;
            sun.data.name = "Sol";
            sun.data.info.desc = "O Sol é a estrela central do nosso sistema solar, responsável por toda a vida na Terra.";
            sun.data.info.type = "Estrela (Anã Amarela)";
            if (sun.label) sun.label.element.style.display = 'block';
        }

        appState.whiteDwarfMesh.visible = false;
        if (appState.whiteDwarfMesh.body && appState.whiteDwarfMesh.body.label) {
            appState.whiteDwarfMesh.body.label.element.style.display = 'none';
        }

        appState.sunLight.color.setHex(0xffffff);
        appState.sunLight.intensity = 1.5;

        appState.celestialBodies.forEach(body => {
            if (body.type === 'planet' || body.type === 'dwarf' || body.type === 'moon') {
                body.mesh.visible = true;
                if (body.orbitGroup) body.orbitGroup.visible = true;
                if (body.orbitPath) {
                    body.orbitPath.visible = true;
                    body.orbitPath.scale.set(1, 1, 1);
                }
                if (body.label) body.label.element.style.display = 'block';

                if (body.originalDistance !== undefined) {
                    body.distance = body.originalDistance;
                    if (body.bodyGroup) body.bodyGroup.position.x = body.distance;
                    if (body.type === 'moon' && body.mesh) body.mesh.position.x = body.distance;
                }
                if (body.originalSpeed !== undefined) body.speed = body.originalSpeed;

                if (body.bodyGroup) {
                    body.bodyGroup.children.forEach(child => {
                        if (child.name === 'rings') child.visible = true;
                    });
                }
            }
        });

        if (appState.asteroidSystem) {
            appState.asteroidSystem.visible = true;
            appState.asteroidSystem.scale.set(1, 1, 1);
        }
        if (appState.kuiperSystem) {
            appState.kuiperSystem.visible = true;
            appState.kuiperSystem.scale.set(1, 1, 1);
        }

        closeInfo();
        appState.isFlying = false;
        appState.controls.enabled = true;

        // Reset camera focus
        const sunBody = appState.celestialBodies.find(b => b.type === 'sun');
        const sunPos = sunBody ? sunBody.mesh.position : new THREE.Vector3(0, 0, 0);
        const dist = appState.camera.position.distanceTo(sunPos);
        if (dist < 80) {
            const direction = new THREE.Vector3().subVectors(appState.camera.position, sunPos).normalize();
            if (direction.lengthSq() === 0) direction.set(0, 0, 1);
            appState.camera.position.copy(sunPos.clone().add(direction.multiplyScalar(150)));
        }
        appState.controls.target.copy(sunPos);
        appState.controls.update();
        console.log("♻️ SimulationManager: System Reset");
    },

    toggleTimePause: function () {
        appState.isTimePaused = !appState.isTimePaused;
        const pauseBtn = document.getElementById('pause-time-btn');
        if (!pauseBtn) return;

        if (appState.isTimePaused) {
            pauseBtn.innerText = 'Retomar Tempo';
            pauseBtn.classList.add('paused');
        } else {
            pauseBtn.innerText = 'Pausar Tempo';
            pauseBtn.classList.remove('paused');
        }
    },

    handleWindowResize: function () {
        const width = document.documentElement.clientWidth;
        const height = document.documentElement.clientHeight;

        appState.camera.aspect = width / height;
        appState.camera.updateProjectionMatrix();

        appState.renderer.setSize(width, height);
        if (appState.composer) appState.composer.setSize(width, height);
        if (appState.labelRenderer) appState.labelRenderer.setSize(width, height);

        console.log(`📏 SimulationManager: Layout Realigned (${width}x${height})`);
    },

    updateFPS: function () {
        const now = performance.now();
        frames++;
        if (now > lastFpsUpdateTime + 1000) {
            fps = Math.round((frames * 1000) / (now - lastFpsUpdateTime));
            frames = 0;
            lastFpsUpdateTime = now;

            // Allow FPS everywhere
            if (!isFpsVisible) {
                isFpsVisible = true;
                this.showFpsDisplay();
            }

            if (fps < 45) fpsLowCounter++;
            else fpsLowCounter = Math.max(0, fpsLowCounter - 1);

            if (isFpsVisible) {
                const display = document.getElementById('fps-counter');
                if (display) {
                    display.innerText = `FPS: ${fps}`;
                    const color = fps < 15 ? '#ff3300' : (fps < 30 ? '#ffaa00' : '#00ff00');
                    display.style.color = color;
                    display.style.borderColor = color;
                    display.style.animation = fps < 15 ? 'pulse 0.5s infinite alternate' : 'none';
                }
            }
        }
    },

    showFpsDisplay: function () {
        let display = document.getElementById('fps-counter');
        if (!display) {
            display = document.createElement('div');
            display.id = 'fps-counter';
            display.style.cssText = `
                position: fixed; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.7);
                color: #00ff00; padding: 5px 15px; font-family: 'Exo 2', sans-serif; font-size: 14px; font-weight: normal;
                border-radius: 20px; z-index: 10000; border: 1px solid #00ff00; display: block;
                box-shadow: 0 0 10px rgba(0, 255, 0, 0.2); backdrop-filter: blur(5px);
            `;
            document.body.appendChild(display);
        }
        display.style.display = 'block';
    },

    hideFpsDisplay: function () {
        const display = document.getElementById('fps-counter');
        if (display) display.style.display = 'none';
        isFpsVisible = false;
    }
};

export function initSimulation(state) {
    simulationManager.init(state);
}

export function updateSimulation(delta, now) {
    simulationManager.updateSimulation(delta, now);
}

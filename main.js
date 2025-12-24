import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { solarSystemData } from './planet-data.js?v=33';
import { textureGenerator } from './texture-generator.js';
import { state, loadEggs, saveEggs } from './modules/GameState.js';
import { initInput, focusOnPlanet, setupLabelInteraction, highlightBody } from './modules/InputManager.js';
import { audioManager } from './modules/AudioManager.js';
import {
    initUI, setupMenu, showChromeWarning, showControlsToast,
    createInfoModal, closeActiveModal, updateInfoPanel, closeInfo,
    showEasterToast, showEasterInfo, toggleMoonCheese
} from './modules/UIManager.js';

// [REFACTORED] input variables moved to InputManager.js
let isSleeping = false;
let backgroundTimer = null;
let animationFrameId = null;
let lastRenderTime = 0;
let lastTime = performance.now();
const SLEEP_DELAY_MS = 10000;
const BACKGROUND_FPS = 15;
const UI_FPS = 60;

state.eggsFound = loadEggs();

function toggleTimePause() {
    state.isTimePaused = !state.isTimePaused;
    const pauseBtn = document.getElementById('pause-time-btn');
    if (!pauseBtn) return;

    if (state.isTimePaused) {
        pauseBtn.innerText = 'Retomar Tempo';
        pauseBtn.classList.add('paused');
    } else {
        pauseBtn.innerText = 'Pausar Tempo';
        pauseBtn.classList.remove('paused');
    }
}

// [REFACTORED] handleGlobalKeyDown and handleGlobalKeyUp moved to InputManager.js
import { inputState } from './modules/InputManager.js';

// [REFACTORED] updateMenuSelection moved to InputManager.js


document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('blur', () => handleVisibilityChange(false));
window.addEventListener('focus', () => handleVisibilityChange(true));

function handleVisibilityChange(forcedState = null) {
    const newState = forcedState !== null ? forcedState : !document.hidden;

    // Only act if state actually changed
    if (state.isPageVisible === newState) return;

    state.isPageVisible = newState;
    console.log(`Visibility Changed: ${state.isPageVisible ? 'VISIBLE' : 'HIDDEN/BLURRED'}`);

    if (state.isPageVisible) {
        // WAKE UP from Tab Switch
        if (backgroundTimer) clearTimeout(backgroundTimer);
        backgroundTimer = null;

        // Se a UI NÃO estiver bloqueando, acordamos tudo
        if (!state.isInteractingWithUI) {
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

// [REFACTORED] audioManager moved to AudioManager.js

// [REFACTORED] UI Functions moved to UIManager.js

// REMOVED: showChromeWarning() call from global init to make it dynamic based on performance

// [REFACTORED] Core State variables moved to GameState.js
// state.scene, state.camera, state.renderer, state.labelRenderer, state.controls, state.composer -> state.*
// state.celestialBodies, state.asteroidSystem, state.kuiperSystem, state.sunLight -> state.*
// Time/Physics/Explosion/Interaction variables -> state.*
// [REFACTORED] raycaster, mouse, keyState moved to InputManager.js
state.clock = new THREE.Clock();

// [REFACTORED] playResetSound and resetSoundPool moved to AudioManager.js

window.solarSystem = {
    get celestialBodies() { return state.celestialBodies; },
    focusOnPlanet: (name) => {
        const body = state.celestialBodies.find(b => b.data && b.data.name === name);
        if (body) focusOnPlanet(body);
    },
    getCamera: () => state.camera
};



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
    state.scene.add(stars);
}

function createAsteroidBelts() {
    state.asteroidSystem = createBeltParticleSystem(1200, 60, 75); // Reduzido de 2000
    state.scene.add(state.asteroidSystem);
    state.kuiperSystem = createBeltParticleSystem(2500, 200, 250); // Reduzido de 4000
    state.scene.add(state.kuiperSystem);
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
        state.clock.getDelta();

        // CORREÇÃO DE ESCALA: Se não estiver explodindo, forçar tamanho normal
        if (!state.explosionActive) {
            state.celestialBodies.forEach(body => {
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
    state.scene.add(sunMesh);

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
    state.celestialBodies.push(sunBody);

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
    state.scene.add(tiltGroup);

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
    state.scene.updateMatrixWorld(true);

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
    state.celestialBodies.push(body);

    // Forçar renderização inicial
    mesh.visible = true;
    tiltGroup.visible = true;

    setupLabelInteraction(labelDiv, body);

    // --- 3. DURAÇÃO DE 60 SEGUNDOS ---
    setTimeout(() => {
        if (body && mesh) {
            console.log("🕊️ Planeta Fluminense partindo para a próxima vitória...");
            if (state.focusedBody === body) closeInfo();

            // Remover label do DOM
            if (labelDiv && labelDiv.parentNode) {
                labelDiv.parentNode.removeChild(labelDiv);
            }

            // Remover da cena (Hierarquia correta: Root -> TiltGroup)
            if (tiltGroup) state.scene.remove(tiltGroup);

            // Limpeza da lista
            state.celestialBodies = state.celestialBodies.filter(b => b !== body);
        }
    }, 60000); // 60 segundos

    return body;
}

function createPlanet(data) {
    const orbitGroup = new THREE.Group();
    if (data.startAngle) {
        orbitGroup.rotation.y = data.startAngle;
    }
    state.scene.add(orbitGroup);

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
    state.scene.add(orbitPath);

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

            state.celestialBodies.push({
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
    state.celestialBodies.push(body);

    // FIX: Enable click/hover on label
    setupLabelInteraction(labelDiv, body);
}

// [REFACTORED] flySpeed, flight variables moved to state or InputManager
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

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
    if (isNaN(state.camera.position.x) || isNaN(state.camera.position.y) || isNaN(state.camera.position.z)) {
        console.error("🔥 CRITICAL FAILURE: Camera became NaN! Resetting...");
        state.camera.position.set(0, 200, 300);
        state.camera.lookAt(0, 0, 0);
        state.controls.target.set(0, 0, 0);
        state.isFlying = false;
        return;
    }

    const now = performance.now();
    // --- OTIMIZAÇÃO DE PERFORMANCE INTELIGENTE ---
    // [OTIMIZAÇÃO] Limitador de FPS para UI removido para garantir 60 FPS constantes em PCs potentes.
    // 2. Se a aba está escondida, capamos em 1 FPS (Economia Extrema)
    if (!state.isPageVisible) {
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
    let delta = state.clock.getDelta();
    // --- CRITICAL FIX: DELTA CLAMPING ---
    if (delta > 0.1) {
        delta = 0.1; // Trava máxima de 0.1s por frame (evita salto de 5 min)
    }

    // Date Update
    // ECONOMIA: Só pausa o tempo se o usuário pausou manualmente ou se a aba está escondida
    if (!state.isTimePaused && state.isPageVisible) { // [FIX] Não pausar durante MODAIS (Evitar orbit freeze)
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysToAdvance = state.timeScale * delta;
        state.currentDate.setTime(state.currentDate.getTime() + (daysToAdvance * msPerDay));
    }

    const day = String(state.currentDate.getDate()).padStart(2, '0');
    const month = String(state.currentDate.getMonth() + 1).padStart(2, '0');
    const year = state.currentYearAstronomical !== null ? state.currentYearAstronomical : state.currentDate.getFullYear();
    const hours = String(state.currentDate.getHours()).padStart(2, '0');
    const minutes = String(state.currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(state.currentDate.getSeconds()).padStart(2, '0');
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

    const startOfYear = new Date(state.currentDate.getFullYear(), 0, 1);
    const dayOfYear = (state.currentDate - startOfYear) / (1000 * 60 * 60 * 24);

    state.celestialBodies.forEach(body => {
        if (body.type === 'planet') {
            let angle;
            if (body.data.name === 'Terra') {
                const yearFraction = dayOfYear / 365.25;
                angle = yearFraction * Math.PI * 2;
            } else {
                const totalDays = state.currentDate.getTime() / (24 * 60 * 60 * 1000);
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
            // Speed logic for moons needs to be compatible with state.timeScale (days/sec)
            // body.speed is rads per frame? Or arbitrary?
            // Existing logic: body.speed * (state.timeScale * 0.05).
            // Old state.timeScale was 1. New state.timeScale can be 1000.
            // If new state.timeScale is "days per sec", then we want 365 days = 2PI orbit?
            // Moons are faster. 27 days for Moon.
            // Let's keep the arbitrary speed modifier for visual effect, but scaled.
            // Old: state.timeScale=1 => speed * 0.05.
            // New: state.timeScale=1 (day/sec) => speed * ??
            // Let's use state.timeScale directly but clamped for sanity if it's too fast?
            // Or just trust the multiplier.
            // Old Logic: body.speed * state.timeScale * 0.05
            // Let's keep it visually similar. delta * 3.0 gives ~0.05 at 60FPS.
            if (!state.isTimePaused) {
                body.orbit.rotation.y += body.speed * state.timeScale * (delta * 3.0);
            }
        }
    });

    if (!state.isTimePaused && state.isPageVisible) { // Removed !state.isInteractingWithUI to allow rotation in background
        if (state.asteroidSystem) state.asteroidSystem.rotation.y += (0.03 * delta) * state.timeScale;
        if (state.kuiperSystem) state.kuiperSystem.rotation.y += (0.012 * delta) * state.timeScale;
    }

    // Lógica de Voo independente do state.focusedBody para evitar travamento
    if (state.isFlying) {
        // Se perdermos o foco no meio do voo, abortar e devolver controle
        if (!state.focusedBody) {
            state.isFlying = false;
            state.controls.enabled = true;
        } else {
            const now = performance.now();
            const elapsed = now - state.flightStartTime;
            let progress = elapsed / state.flightDuration;

            if (progress >= 1) {
                progress = 1;
                state.isFlying = false;
                state.isModalOpen = false; // [FIX] Garante FPS alto pós-voo
                if (state.controls) {
                    state.controls.enabled = true;
                    state.controls.enableKeys = true;
                    state.controls.enablePan = true;
                }
            }
            // Suavização mais gentil (Sine) para evitar paradas bruscas
            const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
            const eased = easeInOutSine(progress);

            // CÂMERA: Movimento suave (Senoide/Cúbico)
            state.camera.position.lerpVectors(state.flightStartPos, state.flightEndPos, eased);

            // ROTAÇÃO (ALVO): Sincronizada com o movimento para evitar "giros loucos" (2 spins)
            // Se atrasarmos muito (pow 5), a câmera dá uma chicotada no final.
            state.controls.target.lerpVectors(state.flightStartTarget, state.flightEndTarget, eased);

            state.controls.update();
        }
    } else if (state.focusedBody && state.focusedBody.mesh) {
        // Acompanhamento Orbital Suave
        const targetPos = new THREE.Vector3();
        state.focusedBody.mesh.getWorldPosition(targetPos);
        const diff = new THREE.Vector3().subVectors(targetPos, state.controls.target);
        state.camera.position.add(diff);
        state.controls.target.copy(targetPos);
    }

    const moveSpeed = 2 * (state.timeScale > 0 ? 1 : 1);

    const moveTotal = new THREE.Vector3();
    const cameraSpeed = 150 * delta;

    // --- BLOQUEIO DE MOVIMENTO MANUAL INFALÍVEL (TOLERÂNCIA ZERO) ---
    if (state.isInteractingWithUI || state.isModalOpen) {
        moveTotal.set(0, 0, 0);
    } else {
        if (inputState.keyState['KeyW'] || inputState.keyState['ArrowUp']) {
            const forward = new THREE.Vector3();
            state.camera.getWorldDirection(forward);
            moveTotal.add(forward.multiplyScalar(cameraSpeed));
        }
        if (inputState.keyState['KeyS'] || inputState.keyState['ArrowDown']) {
            const backward = new THREE.Vector3();
            state.camera.getWorldDirection(backward);
            moveTotal.add(backward.multiplyScalar(-cameraSpeed));
        }
        if (inputState.keyState['KeyA'] || inputState.keyState['ArrowLeft']) {
            const right = new THREE.Vector3();
            const forward = new THREE.Vector3();
            state.camera.getWorldDirection(forward);
            // Produto vetorial: Forward X Up = Right
            right.crossVectors(forward, state.camera.up).normalize();
            // Para "Esquerda", invertemos ou subtraímos
            moveTotal.add(right.multiplyScalar(-cameraSpeed));
        }
        if (inputState.keyState['KeyD'] || inputState.keyState['ArrowRight']) {
            const right = new THREE.Vector3();
            const forward = new THREE.Vector3();
            state.camera.getWorldDirection(forward);
            right.crossVectors(forward, state.camera.up).normalize();
            moveTotal.add(right.multiplyScalar(cameraSpeed));
        }
    }

    const isMoving = moveTotal.lengthSq() > 0;

    if (isMoving && state.focusedBody) {
        // Se estiver focado, não permite mover com teclas para não quebrar o acompanhamento
        // Mas NÃO damos return, senão mata o render loop
        moveTotal.set(0, 0, 0);
    }

    if (isMoving) {
        state.camera.position.add(moveTotal);
        if (!state.focusedBody) {
            state.controls.target.add(moveTotal);
            state.controls.update();
        }
    }

    if (state.controls.enabled) {
        state.controls.update();
    }

    // --- SINCRONIZADOR UNIVERSAL DE UI ---
    // Se o modal estiver aberto, garantimos que o conteúdo seja SEMPRE o do astro focado.
    if (state.isModalOpen && state.focusedBody) {
        const infoNameEl = document.getElementById('info-name');

        // Se o nome atual do focado não bate com o painel, forçamos o refresh
        if (infoNameEl && infoNameEl.innerText !== state.focusedBody.data.name) {
            updateInfoPanel(state.focusedBody);
        }
    }

    // Explosão Solar
    if (state.explosionActive) {
        const sun = state.celestialBodies.find(b => b.type === 'sun');
        if (sun) {
            if (state.explosionPhase === 1) {
                // Expansão
                // 0.002 per frame at 60fps -> 0.12 per second
                const expansionSpeed = 0.08 * delta; // Slightly slower for better control
                sun.mesh.scale.addScalar(expansionSpeed);
                // Mudança para cor mais quente/brilhante (Laranja intenso em vez de vermelho escuro)
                sun.mesh.material.emissive.lerp(new THREE.Color(0xff4400), expansionSpeed);
                sun.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(sun.mesh.material.emissiveIntensity, 5, expansionSpeed);

                // Luz menos vermelha para não saturar os gigantes gasosos
                state.sunLight.color.lerp(new THREE.Color(0xffccaa), 0.3 * delta);
                state.sunLight.intensity = THREE.MathUtils.lerp(state.sunLight.intensity, 10, expansionSpeed);

                // Camera Zoom-Out (Afastar suavemente enquanto o sol cresce)
                // MODIFICAÇÃO: Só acontece se o Sol estiver focado
                if (state.focusedBody && (state.focusedBody.type === 'sun' || state.focusedBody.type === 'whiteDwarf')) {
                    const sunPos = sun.mesh.position;
                    const camDist = state.camera.position.distanceTo(sunPos);
                    if (camDist < 300) { // Limite de afastamento
                        const retreatDir = new THREE.Vector3().subVectors(state.camera.position, sunPos).normalize();
                        const moveVec = retreatDir.multiplyScalar(8 * delta);
                        moveVec.y += 2.5 * delta; // Subir câmera para ângulo cinematográfico
                        state.camera.position.add(moveVec);
                        state.controls.target.lerp(sunPos, 2 * delta); // Manter foco no sol
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
                        if (state.focusedBody && (state.focusedBody.type === 'sun' || state.focusedBody.data.name === 'Sol' || state.focusedBody.data.name === 'Gigante Vermelha')) {
                            updateInfoPanel(sun);
                        }
                    }
                }

                // Esconder rótulo do Sol na explosão
                if (sun.label) sun.label.element.style.display = 'none';

                // Consumo de planetas (BASEADO NO RAIO REAL DO SOL)
                const sunRadius = sun.mesh.geometry.parameters.radius * sun.mesh.scale.x;
                let earthConsumed = false;

                state.celestialBodies.forEach(body => {
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
                    state.explosionPhase = 3;
                    sun.mesh.material.transparent = true;
                    sun.mesh.material.needsUpdate = true;
                    highlightBody(sun, false); // Remove hover effects immediately
                    state.whiteDwarfMesh.visible = true;
                    if (state.whiteDwarfMesh.material) {
                        state.whiteDwarfMesh.material.emissiveIntensity = 4.0; // Brilho real de Anã Branca
                        state.whiteDwarfMesh.material.emissive.setHex(0xffffff);
                    }
                    if (state.whiteDwarfMesh.body && state.whiteDwarfMesh.body.label) {
                        state.whiteDwarfMesh.body.label.element.style.display = 'block';
                    }
                    state.sunLight.color.setHex(0xffffff);
                    // LUZ DIMINUÍDA: Planetas no escuro, mas Estrela brilha (via emissive)
                    state.sunLight.intensity = 0.5;

                    // --- GATILHO DE ESTADO: MUDANÇA PARA ANÃ BRANCA ---
                    // CORREÇÃO DE FOCO: Só muda o foco se estiver olhando para o Sol
                    if (state.focusedBody === sun || (sun && state.focusedBody === sun.mesh) || (state.focusedBody && (state.focusedBody.type === 'sun' || state.focusedBody.data.name === 'Gigante Vermelha'))) {
                        state.focusedBody = state.whiteDwarfMesh.body;
                        // FORÇAR ATUALIZAÇÃO DO PAINEL IMEDIATAMENTE (Robustez: Checar visibilidade do DOM)
                        const infoPanel = document.getElementById('info-panel');
                        if (infoPanel && !infoPanel.classList.contains('hidden')) {
                            updateInfoPanel(state.focusedBody);
                        }
                    } else {
                        // Se estiver olhando Júpiter, mantenha o foco em Júpiter
                        // Mas certifique-se de que o painel do Sol não está aberto
                        const infoNameEl = document.getElementById('info-name');
                        if (infoNameEl && (infoNameEl.innerText === 'Sol' || infoNameEl.innerText === 'Gigante Vermelha')) {
                            // Se o painel mostra o Sol mas o foco está em outro lugar (raro), atualize para o foco atual
                            if (state.focusedBody) updateInfoPanel(state.focusedBody);
                        }
                    }
                }
            } else if (state.explosionPhase === 3) {
                // Fade out
                // Não crescer mais, apenas desaparecer
                sun.mesh.material.opacity -= 0.5 * delta; // Mais rápido
                if (sun.mesh.material.opacity <= 0) {
                    sun.mesh.visible = false;
                }

                // --- MECÂNICA DE EXPANSÃO ORBITAL (Anã Branca) ---
                // Simula a perda de massa estelar (gravidade enfraquece)
                state.celestialBodies.forEach(body => {
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
                if (state.asteroidSystem) {
                    state.asteroidSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
                }
                if (state.kuiperSystem) {
                    state.kuiperSystem.scale.lerp(new THREE.Vector3(targetBeltScale, targetBeltScale, targetBeltScale), beltLerpFactor);
                }
            }
        }
    }

    updateFPS();
    state.composer.render();
    state.labelRenderer.render(state.scene, state.camera);
}


function startExplosion() {
    state.explosionActive = true;
    state.explosionPhase = 1;
    // Salto temporal para 5 bilhões de anos no futuro
    // Usamos uma string descritiva conforme pedido do mestre
    state.currentYearAstronomical = "+/- 5 bilhões de anos (aprox.)";
    console.log("🚀 Sequência Final: Ano Astronomico setado para:", state.currentYearAstronomical);
}

function resetSolarSystem() {
    state.explosionActive = false;
    state.explosionPhase = 0;
    state.currentYearAstronomical = null;
    state.currentDate = new Date(); // Volta para hoje

    const sun = state.celestialBodies.find(b => b.type === 'sun');
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

    state.whiteDwarfMesh.visible = false;
    if (state.whiteDwarfMesh.body && state.whiteDwarfMesh.body.label) {
        state.whiteDwarfMesh.body.label.element.style.display = 'none';
    }

    if (sun && sun.label) {
        sun.label.element.style.display = 'block';
    }

    state.sunLight.color.setHex(0xffffff);
    state.sunLight.intensity = 1.5;

    state.celestialBodies.forEach(body => {
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

    if (state.asteroidSystem) {
        state.asteroidSystem.visible = true;
        state.asteroidSystem.scale.set(1, 1, 1);
    }
    if (state.kuiperSystem) {
        state.kuiperSystem.visible = true;
        state.kuiperSystem.scale.set(1, 1, 1);
    }

    closeInfo(); // Close info panel

    // Garantir que controles e flags de voo sejam resetados
    state.isFlying = false;
    state.controls.enabled = true;

    // Adjust Camera if too close (User Request: "Sol na cara")
    const sunBody = state.celestialBodies.find(b => b.type === 'sun');
    const sunPos = sunBody ? sunBody.mesh.position : new THREE.Vector3(0, 0, 0);
    const dist = state.camera.position.distanceTo(sunPos);
    if (dist < 80) {
        // Move state.camera back to a comfortable distance
        const direction = new THREE.Vector3().subVectors(state.camera.position, sunPos).normalize();
        // If state.camera is exactly at 0,0,0 (unlikely but possible), use a default direction
        if (direction.lengthSq() === 0) direction.set(0, 0, 1);

        const newPos = sunPos.clone().add(direction.multiplyScalar(150));
        state.camera.position.copy(newPos);
        state.controls.target.copy(sunPos);
        state.controls.update();
    } else {
        // Mesmo que a distância esteja boa, garantir que o target esteja no sol no momento do reset
        state.controls.target.copy(sunPos);
        state.controls.update();
    }
}

// [REFACTORED] Info Panel and Moon Cheese moved to UIManager.js

function onWindowResize() {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;

    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();

    state.renderer.setSize(width, height);
    if (state.composer) state.composer.setSize(width, height);
    if (state.labelRenderer) state.labelRenderer.setSize(width, height);

    console.log(`📏 Layout Realigned: ${width}x${height}`);
}

function toggleAudio() {
    audioManager.toggle();
}


function initApp() {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50000);
    state.camera.position.set(0, 300, 600);

    state.renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance"
    });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(state.renderer.domElement);

    state.labelRenderer = new CSS2DRenderer();
    state.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    state.labelRenderer.domElement.style.position = 'absolute';
    state.labelRenderer.domElement.style.top = '0px';
    state.labelRenderer.domElement.style.pointerEvents = 'none';
    state.labelRenderer.domElement.style.zIndex = '1';
    document.body.appendChild(state.labelRenderer.domElement);

    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.screenSpacePanning = true;
    state.controls.minDistance = 0.1;
    state.controls.maxDistance = 20000;

    state.composer = new EffectComposer(state.renderer);
    state.composer.addPass(new RenderPass(state.scene, state.camera));
    state.composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.85));

    state.sunLight = new THREE.PointLight(0xffffff, 1.5, 10000);
    state.sunLight.castShadow = true;
    state.sunLight.shadow.mapSize.width = 1024;
    state.sunLight.shadow.mapSize.height = 1024;
    state.scene.add(state.sunLight);
    state.scene.add(new THREE.AmbientLight(0x222222));

    addStarField();
    createAsteroidBelts();
    createSystem();

    // --- INICIALIZAÇÃO DE MÓDULOS ---

    // 1. InputManager: Gerencia teclado/mouse e callbacks espaciais
    initInput(state, {
        focusOnPlanet,
        highlightBody,
        setupLabelInteraction,
        closeInfo,
        toggleAudio,
        updateInfoPanel
    });

    // 2. UIManager: Gerencia DOM, Modals e Toasts
    initUI({
        startExplosion,
        resetSolarSystem,
        highlightBody,
        toggleMoonCheese
    });

    // Configura o menu de informações e listeners de clique
    setupMenu();

    // 3. AudioManager: Gerencia sons e música
    audioManager.init();

    window.addEventListener('resize', onWindowResize);

    // Verificação inicial de performance para Chrome
    showChromeWarning();

    animate();
}

initApp();

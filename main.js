import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { solarSystemData } from './planet-data.js?v=13';
import { textureGenerator } from './texture-generator.js';

// --- AUDIO MANAGER ---
const audioManager = {
    playlist: ['assets/musics/Aria Math.mp3'],
    currentIndex: 0,
    element: document.getElementById('bg-music'),
    btn: document.getElementById('audio-btn'),
    hoverSound: new Audio('assets/sound_effects/click.mp3'),
    init: function () {
        this.hoverSound.volume = 0.2;
        this.hoverSound.load();
        this.discoverTracks();
        this.initSpecialAssets();

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
        const s = this.hoverSound.cloneNode();
        s.volume = 0.2;
        s.play().catch(() => { });
    },
    playSecretAction: function (category = 'pluto') {
        if (category === 'moon') {
            // Silêncio total para a Lua (por enquanto)
            return;
        }

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
        this.playlist = ['assets/musics/Aria Math.mp3'];
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
    nextTrack: function () {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.element.src = this.playlist[this.currentIndex];
        this.element.play().then(() => {
            this.btn.innerText = '🔇 Pausar';
            const songName = this.playlist[this.currentIndex].split('/').pop().replace(/%20/g, ' ');
            const toast = document.createElement('div');
            toast.style.position = 'fixed';
            toast.style.bottom = '80px';
            toast.style.left = '20px';
            toast.style.background = 'rgba(0, 20, 40, 0.8)';
            toast.style.color = '#00ccff';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '5px';
            toast.style.border = '1px solid #00ccff';
            toast.style.fontFamily = 'Exo 2, sans-serif';
            toast.style.zIndex = '1000';
            toast.style.transition = 'opacity 1s';
            toast.innerText = '♪ Tocando: ' + songName;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 1000);
            }, 4000);
        });
    }
};
audioManager.init();

// Global State
let scene, camera, renderer, labelRenderer, controls, composer;
let celestialBodies = [];
let asteroidSystem, kuiperSystem;
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
let currentDate = new Date(); // Start "today" logic

let focusedBody = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredBody = null;
let hoverTimer = null;
const keyState = {};

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

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 100, 250);

    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(labelRenderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.maxDistance = 2000;
    controls.minDistance = 0.5;
    controls.enableZoom = true;
    controls.zoomSpeed = 2.0;

    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    const sunLight = new THREE.PointLight(0xffffff, 400, 1500);
    sunLight.decay = 1.5;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 1500;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.5;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.4;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    createSystem();
    createAsteroidBelts();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('keydown', (e) => {
        keyState[e.code] = true;
        if (e.code === 'Escape' && focusedBody) {
            closeInfo();
        }
    });
    window.addEventListener('keyup', (e) => { keyState[e.code] = false; });

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

            document.getElementById('time-display').innerText = `Velocidade: ${daysPerSec.toFixed(1)} dias/s`;
        }
    };

    document.getElementById('timeSlider').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        updateTimeScale(val);
    });

    // Real Time / Reset Button
    document.getElementById('real-time-btn').addEventListener('click', () => {
        isRealTime = true;
        currentDate = new Date(); // Reset to NOW

        // Reset Slider
        const slider = document.getElementById('timeSlider');
        slider.value = 0;

        // Reset Physics Speed
        timeScale = 1 / 86400;

        document.getElementById('time-display').innerText = `Velocidade: Tempo Real`;
        document.getElementById('real-time-btn').classList.add('active');
    });

    document.getElementById('close-info').addEventListener('click', closeInfo);
    document.getElementById('audio-btn').addEventListener('click', toggleAudio);

    // Initial state check (if browser cached slider value)
    const slider = document.getElementById('timeSlider');
    if (slider.value != 0) {
        updateTimeScale(slider.value);
    }

    animate();
}

function addStarField() {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 0; i < 15000; i++) {
        vertices.push(
            THREE.MathUtils.randFloatSpread(5000),
            THREE.MathUtils.randFloatSpread(5000),
            THREE.MathUtils.randFloatSpread(5000)
        );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
}

function createAsteroidBelts() {
    asteroidSystem = createBeltParticleSystem(2000, 60, 75);
    scene.add(asteroidSystem);
    kuiperSystem = createBeltParticleSystem(4000, 200, 250);
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

function createSystem() {
    const sunData = solarSystemData.sun;
    const sunGeo = new THREE.SphereGeometry(sunData.radius, 64, 64);
    const sunTex = textureGenerator.createSunTexture();
    const sunMat = new THREE.MeshStandardMaterial({
        map: sunTex,
        emissive: 0xffaa00,
        emissiveMap: sunTex,
        emissiveIntensity: 2
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    celestialBodies.push({ mesh: sunMesh, data: sunData, type: 'sun' });

    solarSystemData.planets.forEach(data => createPlanet(data));
    solarSystemData.dwarfs.forEach(data => createPlanet(data));
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

    const geometry = new THREE.SphereGeometry(data.radius, 64, 64);
    let texture;
    const loader = new THREE.TextureLoader();
    let material;

    if (data.textureMap) {
        texture = loader.load(data.textureMap);
        if (data.nightMap) {
            const nightTex = loader.load(data.nightMap);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: nightTex,
                emissive: 0xffffff,
                emissiveIntensity: 1
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
        let roughness = 0.9;
        let metalness = 0.05;
        material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: roughness,
            metalness: metalness
        });
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
                    float alpha = fresnel * dayFactor * 0.9; 
                    gl_FragColor = vec4(atmoColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.FrontSide
        });
        const atmo = new THREE.Mesh(atmoGeo, atmoMat);
        bodyGroup.add(atmo);
    }

    if (data.tilt) {
        bodyGroup.rotation.z = THREE.MathUtils.degToRad(data.tilt);
    }

    if (data.hasRings) {
        const startRad = data.radius * 1.2;
        const endRad = data.radius * 2.3;
        const ringGeo = new THREE.RingGeometry(startRad, endRad, 64);
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
        ring.rotation.x = Math.PI / 2;
        bodyGroup.add(ring);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bodyGroup.add(mesh);

    const orbitPathGeo = new THREE.RingGeometry(data.distance - 0.1, data.distance + 0.1, 128);
    const orbitPathMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const orbitPath = new THREE.Mesh(orbitPathGeo, orbitPathMat);
    orbitPath.rotation.x = Math.PI / 2;
    scene.add(orbitPath);

    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-container';
    const text = document.createElement('div');
    text.className = 'label-text';
    text.textContent = data.name;
    labelDiv.appendChild(text);
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
                speed: moonData.speed,
                data: moonData
            });
        });
    }

    celestialBodies.push({
        type: 'planet',
        mesh: mesh,
        orbitGroup: orbitGroup,
        bodyGroup: bodyGroup,
        speed: data.speed,
        data: data,
        label: label,
        infoDiv: infoDiv
    });
}

let isRightMouseDown = false;
let flySpeed = 2.0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

let isFlying = false;
let flightPhase = 1;
let flightStartTime = 0;
let flightDuration = 1500;
const flightStartPos = new THREE.Vector3();
const flightEndPos = new THREE.Vector3();
const flightStartTarget = new THREE.Vector3();
const flightEndTarget = new THREE.Vector3();
const flightNextPos = new THREE.Vector3();

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}

document.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        isRightMouseDown = true;
        controls.enabled = false;
        if (focusedBody) closeInfo();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isRightMouseDown = false;
        controls.enabled = true;
    }
});

document.addEventListener('mousemove', (e) => {
    if (isRightMouseDown) {
        const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * 0.002;
        euler.x -= movementY * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
});

document.addEventListener('contextmenu', event => event.preventDefault());

function animate() {
    requestAnimationFrame(animate);

    // Date Update
    // timeScale is now typically Days per Second.
    // At 60FPS: daysPerFrame = timeScale / 60.
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysPerFrame = timeScale / 60;
    currentDate.setTime(currentDate.getTime() + (daysPerFrame * msPerDay));

    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');

    document.getElementById('date-display').innerText = `${day} / ${month} / ${year} ${hours}:${minutes}:${seconds}`;

    const getPeriodInDays = (str) => {
        if (!str) return 365;
        if (str.includes('anos')) return parseFloat(str) * 365.25;
        return parseFloat(str);
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
            body.orbitGroup.rotation.y = angle;
            const rotDir = body.data.retrograde ? -1 : 1;
            body.mesh.rotation.y += 0.01 * rotDir;
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
            body.orbit.rotation.y += body.speed * timeScale * 0.05;
        }
    });

    if (asteroidSystem) asteroidSystem.rotation.y += 0.0005 * timeScale;
    if (kuiperSystem) kuiperSystem.rotation.y += 0.0002 * timeScale;

    if (focusedBody) {
        if (isFlying) {
            const now = performance.now();
            const elapsed = now - flightStartTime;
            let progress = elapsed / flightDuration;

            if (progress >= 1) {
                progress = 1;
                if (flightPhase === 1) {
                    flightPhase = 2;
                    flightStartTime = performance.now();
                    flightDuration = 500;
                    flightStartPos.copy(camera.position);
                    flightEndPos.copy(flightNextPos);
                    flightStartTarget.copy(controls.target);
                    return;
                } else {
                    isFlying = false;
                    controls.enabled = true;
                }
            }
            const eased = flightPhase === 1 ? easeInOutCubic(progress) : easeOutCubic(progress);
            camera.position.lerpVectors(flightStartPos, flightEndPos, eased);
            controls.target.lerpVectors(flightStartTarget, flightEndTarget, eased);
            controls.update();
        } else {
            const targetPos = new THREE.Vector3();
            focusedBody.mesh.getWorldPosition(targetPos);
            const delta = new THREE.Vector3().subVectors(targetPos, controls.target);
            camera.position.add(delta);
            controls.target.copy(targetPos);
        }
    }

    const moveSpeed = 2 * (timeScale > 0 ? 1 : 1);
    const cameraSpeed = 5;
    const isMoving = keyState['KeyW'] || keyState['ArrowUp'] || keyState['KeyS'] || keyState['ArrowDown'] || keyState['KeyA'] || keyState['ArrowLeft'] || keyState['KeyD'] || keyState['ArrowRight'];

    if (isMoving && focusedBody) {
        return;
    }

    if (keyState['KeyW'] || keyState['ArrowUp']) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.multiplyScalar(cameraSpeed);
        camera.position.add(forward);
    }
    if (keyState['KeyS'] || keyState['ArrowDown']) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.multiplyScalar(-cameraSpeed);
        camera.position.add(forward);
    }
    if (keyState['KeyA'] || keyState['ArrowLeft']) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize().multiplyScalar(-cameraSpeed);
        camera.position.add(right);
    }
    if (keyState['KeyD'] || keyState['ArrowRight']) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize().multiplyScalar(cameraSpeed);
        camera.position.add(right);
    }

    if (isMoving && !focusedBody) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        controls.target.copy(camera.position).add(forward.multiplyScalar(10));
        controls.update();
    }

    if (controls.enabled) {
        controls.update();
    }

    composer.render();
    labelRenderer.render(scene, camera);
}

function updateHoverInfo(body) {
    if (body.infoDiv) body.infoDiv.innerHTML = '';
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const meshes = celestialBodies.map(b => b.mesh).filter(m => m);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const body = celestialBodies.find(b => b.mesh === hitObj);
        if (hoveredBody !== body) {
            hoveredBody = body;
            if (hoverTimer) clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (hoveredBody === body) {
                    highlightBody(body, true);
                }
            }, 500);
        }
    } else {
        if (hoveredBody) {
            highlightBody(hoveredBody, false);
            hoveredBody = null;
        }
        if (hoverTimer) clearTimeout(hoverTimer);
        document.body.style.cursor = 'default';
    }
}

function highlightBody(body, active) {
    document.body.style.cursor = active ? 'pointer' : 'default';
    if (body.label) {
        const labelTextDiv = body.label.element.querySelector('.label-text');
        const infoDiv = body.infoDiv;

        if (active) {
            body.label.element.classList.add('hovered');
            audioManager.playHover();
            labelTextDiv.style.color = '#ffff00';
            labelTextDiv.style.textShadow = '0 0 10px #ffff00';
            labelTextDiv.style.transform = 'scale(1.2)';

            if (body.data.name !== 'Terra') {
                if (body.mesh.material.emissive) {
                    body.mesh.material.emissiveIntensity = 0.5;
                    body.mesh.material.emissive.setHex(0x555555);
                }
            }
        } else {
            body.label.element.classList.remove('hovered');
            labelTextDiv.style.color = body.data.color ? '#' + new THREE.Color(body.data.color).getHexString() : 'white';
            labelTextDiv.style.textShadow = 'none';
            labelTextDiv.style.transform = 'scale(1)';
            infoDiv.innerHTML = '';
            if (body.data.name !== 'Terra') {
                if (body.mesh.material.emissive) {
                    body.mesh.material.emissiveIntensity = 0;
                    body.mesh.material.emissive.setHex(0x000000);
                }
            } else {
                body.mesh.material.emissiveIntensity = 1;
                body.mesh.material.emissive.setHex(0xffffff);
            }
        }
    }
}

function onMouseClick(event) {
    if (hoveredBody) {
        focusOnPlanet(hoveredBody);
    }
}

function focusOnPlanet(body) {
    if (focusedBody && focusedBody.data.name === 'Lua' && isCheeseMode && focusedBody !== body) {
        toggleMoonCheese(false);
    }

    if (focusedBody === body) return;

    focusedBody = body;
    const data = body.data;
    const infoPanel = document.getElementById('info-panel');

    document.getElementById('info-name').innerText = data.name;
    document.getElementById('info-age').innerText = data.info.age || 'Desconhecido';
    document.getElementById('info-type').innerText = data.info.type || 'Planeta';

    const descEl = document.getElementById('info-desc');
    descEl.innerHTML = data.info.desc || '...';

    const egg = descEl.querySelector('.secret-interaction');
    if (egg) {
        let clicks = 0;
        egg.addEventListener('click', (e) => {
            e.stopPropagation();
            audioManager.playSecretAction(data.name === 'Lua' ? 'moon' : 'pluto');
            if (data.name === 'Lua' && egg.innerText.includes('Queijo')) {
                clicks++;
                console.log(`Moon Cheese Clicks: ${clicks}/15`);
                if (clicks === 15) {
                    toggleMoonCheese(true);
                }
            }
        });
    }

    document.getElementById('info-translation').innerText = data.info.translation || '-';
    document.getElementById('info-rotation').innerText = data.info.rotation || '-';
    document.getElementById('info-moons').innerText = data.info.moons || '0';

    infoPanel.classList.remove('hidden');

    const targetPos = new THREE.Vector3();
    body.mesh.getWorldPosition(targetPos);
    const distance = data.radius * 7.0;
    const yOffset = data.radius * 0.5;

    const currentVec = new THREE.Vector3().subVectors(camera.position, targetPos);
    const zoomPos = targetPos.clone().add(currentVec.normalize().multiplyScalar(distance));
    zoomPos.y = targetPos.y + yOffset;

    const toSun = new THREE.Vector3(0, 0, 0).sub(targetPos).normalize();
    const dayPos = targetPos.clone().add(toSun.multiplyScalar(distance));
    dayPos.y += yOffset;

    isFlying = true;
    flightPhase = 1;
    flightStartTime = performance.now();
    flightDuration = 1500;
    controls.enabled = false;

    flightStartPos.copy(camera.position);
    flightEndPos.copy(zoomPos);
    flightStartTarget.copy(controls.target);
    flightEndTarget.copy(targetPos);

    if (body.type === 'sun') {
        flightNextPos.copy(zoomPos);
    } else {
        flightNextPos.copy(dayPos);
    }
    controls.minDistance = data.radius * 1.1;
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
            cheeseTex.repeat.set(0.5, 0.5);

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
    document.getElementById('info-panel').classList.add('hidden');
    controls.minDistance = 0.5;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function toggleAudio() {
    audioManager.toggle();
}

init();

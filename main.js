import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { solarSystemData } from './planet-data.js?v=32';
import { textureGenerator } from './texture-generator.js';

// --- AUDIO MANAGER ---
const audioManager = {
    playlist: ['assets/musics/Aria Math.mp3'],
    currentIndex: 0,
    element: document.getElementById('bg-music'),
    btn: document.getElementById('audio-btn'),
    hoverSound: null, // Initialize as null, will be created on first play
    init: function () {
        // this.hoverSound.volume = 1.0; // Removed, volume set in playHover
        // this.hoverSound.load(); // Removed, loaded on first play
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
        if (!this.hoverSound) {
            this.hoverSound = new Audio('assets/sound_effects/click.mp3');
            this.hoverSound.volume = 1.0; // Volume máximo
        }
        this.hoverSound.currentTime = 0;
        this.hoverSound.play().catch(() => { });
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

function showControlsToast() {
    if (localStorage.getItem('solar_system_tutorial_shown')) return;

    const toast = document.createElement('div');
    toast.className = 'controls-tutorial-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0, 150, 255, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '10px';
    toast.style.border = '2px solid white';
    toast.style.fontFamily = 'Exo 2, sans-serif';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '11000';
    toast.style.textAlign = 'center';
    toast.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    toast.style.lineHeight = '1.5';
    toast.innerHTML = '🚀 <strong>Bem-vindo ao Sistema Solar!</strong><br>' +
        'Mova a câmera: <strong>WASD</strong> ou <strong>Setas</strong><br>' +
        'Orbitar: Segure o <strong>Botão Esquerdo</strong> e arraste<br>' +
        'Zoom: Use o <strong>Scroll</strong> do mouse';
    document.body.appendChild(toast);

    localStorage.setItem('solar_system_tutorial_shown', 'true');

    setTimeout(() => {
        toast.style.transition = 'opacity 1s, transform 1s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 1000);
    }, 15000);
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
let hoverTimer = null;
let hasShownWarning = false;
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

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.set(0, 100, 250);

    renderer = new THREE.WebGLRenderer({ antialias: false }); // Desativado antialias nativo e logarithmicDepthBuffer para ganho de performance
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
    controls.maxDistance = 5000;
    controls.minDistance = 0.1;
    controls.enableZoom = true;
    controls.zoomSpeed = 5.0;

    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };

    sunLight = new THREE.PointLight(0xffffff, 400, 1500);
    sunLight.decay = 1.5;
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; // Reduzido de 4096
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 1500;
    sunLight.shadow.bias = -0.0005; // Ajustado bias para nova resolução
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
    pauseBtn.addEventListener('click', () => {
        isTimePaused = !isTimePaused;
        if (isTimePaused) {
            pauseBtn.innerText = 'Retomar Tempo';
            pauseBtn.classList.add('paused');
        } else {
            pauseBtn.innerText = 'Pausar Tempo';
            pauseBtn.classList.remove('paused');
        }
    });

    // Initial White Dwarf Setup (hidden)
    const wdGeo = new THREE.SphereGeometry(2.1, 32, 32);
    const wdMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    whiteDwarfMesh = new THREE.Mesh(wdGeo, wdMat);
    whiteDwarfMesh.visible = false;
    whiteDwarfMesh.userData = {
        type: 'whiteDwarf',
        name: solarSystemData.whiteDwarf ? solarSystemData.whiteDwarf.name : "Anã Branca",
        radius: 2.1, // FIX: Required for camera calculation
        info: solarSystemData.whiteDwarf ? solarSystemData.whiteDwarf.info : { desc: "Remanescente estelar." }
    };
    whiteDwarfMesh.body = { mesh: whiteDwarfMesh, data: whiteDwarfMesh.userData, type: 'whiteDwarf' };
    scene.add(whiteDwarfMesh);
    animate();
    showControlsToast();
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
    const sunGeo = new THREE.SphereGeometry(sunData.radius, 48, 48); // Reduzido de 64
    const sunTex = textureGenerator.createSunTexture();
    const sunMat = new THREE.MeshStandardMaterial({
        map: sunTex,
        emissive: 0xffaa00,
        emissiveMap: sunTex,
        emissiveIntensity: 2
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    // Adicionamos referências úteis para a explosão
    const sunBody = { mesh: sunMesh, data: sunData, type: 'sun' };
    celestialBodies.push(sunBody);

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

    const geometry = new THREE.SphereGeometry(data.radius, data.radius > 5 ? 48 : 32, data.radius > 5 ? 48 : 32); // Dinâmico baseado no tamanho
    let texture;
    const loader = new THREE.TextureLoader();
    let material;

    if (data.textureMap) {
        texture = loader.load(data.textureMap);
        if (data.nightMap) {
            const nightTex = loader.load(data.nightMap);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                emissive: 0xffffff,
                emissiveMap: nightTex,
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

    celestialBodies.push({
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
    });
}

let isRightMouseDown = false;
let flySpeed = 2.0;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

let isFlying = false, flightPhase = 0, flightStartTime = 0, flightDuration = 0;
let flightStartPos = new THREE.Vector3(), flightEndPos = new THREE.Vector3();
let flightStartTarget = new THREE.Vector3(), flightEndTarget = new THREE.Vector3();
let flightNextPos = new THREE.Vector3();

// --- PERFORMANCE MONITORING ---
let lastTime = performance.now();
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
            if (fps < 45) {
                fpsLowCounter++;
            } else {
                fpsLowCounter = Math.max(0, fpsLowCounter - 1);
            }

            if (fpsLowCounter >= 3 && !isFpsVisible) {
                isFpsVisible = true;
                showFpsDisplay();
                if (!hasShownWarning) {
                    showChromeWarning();
                    hasShownWarning = true;
                }
            } else if (fpsLowCounter === 0 && isFpsVisible && fps >= 55) {
                // Hide if performance recovers significantly
                hideFpsDisplay();
            }
        }

        if (isFpsVisible) {
            const display = document.getElementById('fps-counter');
            if (display) {
                display.innerText = `FPS: ${fps}`;
                if (fps < 30) {
                    display.style.color = '#ff3300';
                    display.style.borderColor = '#ff3300';
                    display.style.animation = 'pulse 0.5s infinite alternate';
                } else if (fps < 45) {
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


// Reimplementando apenas o fechamento de info com botão direito, sem conflito de navegação
document.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Right Click
        if (focusedBody) {
            // Se estiver focado, fechar info
            closeInfo();
        }
        // Se não estiver focado, OrbitControls lida com o Pan nativamente
    }
});

document.addEventListener('contextmenu', event => event.preventDefault());

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Date Update
    // timeScale is now typically Days per Second.
    // Use delta (seconds) for framerate independence.
    if (!isTimePaused) {
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
            // Rotation Speed: 0.01 rad/frame at 60fps -> 0.6 rad/sec
            body.mesh.rotation.y += (0.6 * delta) * rotDir;
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

    if (!isTimePaused) {
        if (asteroidSystem) asteroidSystem.rotation.y += (0.03 * delta) * timeScale;
        if (kuiperSystem) kuiperSystem.rotation.y += (0.012 * delta) * timeScale;
    }

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
            if (focusedBody && focusedBody.mesh) {
                const targetPos = new THREE.Vector3();
                focusedBody.mesh.getWorldPosition(targetPos);
                const delta = new THREE.Vector3().subVectors(targetPos, controls.target);
                camera.position.add(delta);
                controls.target.copy(targetPos);
            }
        }
    }

    const moveSpeed = 2 * (timeScale > 0 ? 1 : 1);
    const moveTotal = new THREE.Vector3();
    // 5 units per frame at 60fps -> 300 units per second
    const cameraSpeed = 300 * delta;

    if (keyState['KeyW'] || keyState['ArrowUp']) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        moveTotal.add(forward.multiplyScalar(cameraSpeed));
    }
    if (keyState['KeyS'] || keyState['ArrowDown']) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        moveTotal.add(forward.multiplyScalar(-cameraSpeed));
    }
    if (keyState['KeyA'] || keyState['ArrowLeft']) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();
        moveTotal.add(right.multiplyScalar(-cameraSpeed));
    }
    if (keyState['KeyD'] || keyState['ArrowRight']) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();
        moveTotal.add(right.multiplyScalar(cameraSpeed));
    }

    const isMoving = moveTotal.lengthSq() > 0;

    if (isMoving && focusedBody) {
        // Se estiver focado, não permite mover com teclas para não quebrar o acompanhamento
        return;
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
                sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 1200, expansionSpeed);

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

                // Update Info Panel Name dynamically if open
                const infoName = document.getElementById('info-name');
                if (infoName && infoName.innerText === 'Sol') {
                    infoName.innerText = 'Gigante Vermelha';
                    const infoDesc = document.getElementById('info-desc');
                    if (infoDesc) {
                        infoDesc.innerHTML = "O Sol esgotou seu hidrogênio e expandiu, engolindo os planetas internos. <br><br><strong>Status:</strong> Colapso Iminente.";
                    }
                }

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
                    sunLight.color.setHex(0xffffff);
                    sunLight.intensity = 100;
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
    // O objeto Date do JS não suporta 5 bilhões, então usamos nossa variável customizada
    currentYearAstronomical = 5000000000;
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
    }

    whiteDwarfMesh.visible = false;
    sunLight.color.setHex(0xffffff);
    sunLight.intensity = 500;

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
            hoveredBody = body;
            if (hoverTimer) clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (hoveredBody === body) {
                    highlightBody(body, true);
                }
            }, 300); // Shorter hover delay for better responsiveness
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

    if (active) {
        audioManager.playHover();
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
            // Special handling for Sun/WD emissive - usually we don't want to dim them on hover
            // unless explosion is not active. If it's the Sun, keep it bright.
            if (body.type === 'sun' && !explosionActive) {
                body.mesh.material.emissiveIntensity = active ? 2.5 : 2.0;
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

function onMouseClick(event) {
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
    if (!body || !body.data) return; // Safety check for destroyed/invalid bodies
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

    // Modificar nome do Sol durante explosão
    if (data.name === 'Sol' && explosionActive && explosionPhase >= 1 && explosionPhase < 3) {
        document.getElementById('info-name').innerText = 'Gigante Vermelha';
    }

    // Injetar botão de explosão se for o Sol ou Anã Branca
    if (data.name === 'Sol' || data.name.includes('Anã Branca')) {
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'trigger-explosion';
        triggerBtn.className = 'secret-trigger-btn';
        triggerBtn.innerText = explosionActive ? 'RESETAR SISTEMA' : 'DISPARAR EXPLOSÃO';
        triggerBtn.onclick = (e) => {
            e.stopPropagation();
            if (explosionActive) {
                resetSolarSystem();
                triggerBtn.innerText = 'DISPARAR EXPLOSÃO';
            } else {
                startExplosion();
                triggerBtn.innerText = 'RESETAR SISTEMA';
            }
        };
        descEl.appendChild(triggerBtn);
    }

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

    if (body.type === 'sun' || body.type === 'whiteDwarf') {
        flightNextPos.copy(zoomPos);
        // Ensure we don't end up inside the mesh or at 0,0,0
        if (flightNextPos.length() < data.radius * 2) {
            flightNextPos.normalize().multiplyScalar(data.radius * 3);
        }
    } else {
        flightNextPos.copy(dayPos);
    }
    controls.minDistance = data.radius * 1.001; // Permite chegar MUITO perto (0.1% de altitude)
    controls.enablePan = false; // Desabilita Pan para evitar conflito com target fixo no planeta
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
    controls.minDistance = 0.1;
    controls.enablePan = true; // Reabilita Pan livre
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

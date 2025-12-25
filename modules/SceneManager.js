import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const sceneManager = {
    init: function (state) {
        state.clock = new THREE.Clock();

        state.scene = new THREE.Scene();
        state.scene.background = new THREE.Color(0x000005);

        // --- CAMERA ---
        state.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50000);
        state.camera.position.set(0, 300, 600);

        // --- RENDERER ---
        state.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true,
            failIfMajorPerformanceCaveat: false
        });
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        state.renderer.shadowMap.enabled = true;
        state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        state.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(state.renderer.domElement);

        // --- LABEL RENDERER ---
        state.labelRenderer = new CSS2DRenderer();
        state.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        state.labelRenderer.domElement.style.position = 'absolute';
        state.labelRenderer.domElement.style.top = '0px';
        state.labelRenderer.domElement.style.pointerEvents = 'none';
        state.labelRenderer.domElement.style.zIndex = '1';
        document.body.appendChild(state.labelRenderer.domElement);

        // --- CONTROLS ---
        state.controls = new OrbitControls(state.camera, state.renderer.domElement);
        state.controls.enableDamping = true;
        state.controls.dampingFactor = 0.1;
        state.controls.screenSpacePanning = false;
        state.controls.enablePan = false;
        state.controls.minDistance = 20;
        state.controls.maxDistance = 20000;
        state.controls.enableZoom = true;
        state.controls.rotateSpeed = 0.3;
        state.controls.zoomSpeed = 0.4;

        // --- POST-PROCESSING (BLOOM) ---
        state.composer = new EffectComposer(state.renderer);
        const renderPass = new RenderPass(state.scene, state.camera);
        state.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6,
            0.4,
            0.85
        );
        state.composer.addPass(bloomPass);

        // --- LIGHTING ---
        state.sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 0.0);
        state.sunLight.castShadow = true;
        state.sunLight.shadow.mapSize.width = 2048;
        state.sunLight.shadow.mapSize.height = 2048;
        state.sunLight.shadow.bias = -0.0001;
        state.scene.add(state.sunLight);

        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        state.scene.add(ambientLight);

        console.log("🌌 SceneManager: Scene Initialized");
    }
};

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { solarSystemData } from './planet-data.js';
import { textureGenerator } from './texture-generator.js';

let scene, camera, renderer, labelRenderer, controls, composer;
let celestialBodies = [];
let asteroidSystem, kuiperSystem;
let timeScale = 1;
let targetYear = 2025;
let explosionActive = false;
let explosionPhase = 0; // 0: Stable, 1: Expansion (Red Giant), 2: Flash, 3: Nebula/White Dwarf
let sunMesh, sunLight, whiteDwarfMesh;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredBody = null;
let focusedBody = null;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 300, 600);

    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
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
    controls.zoomSpeed = 5.0; // Fast zoom like main app

    sunLight = new THREE.PointLight(0xffffff, 500, 2000);
    scene.add(sunLight);

    // Post-processing: Bloom
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.5;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.4;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    addStarField();
    createAsteroidBelts();
    createSystem();

    // Create White Dwarf (hidden initially)
    const wdGeo = new THREE.SphereGeometry(2.1, 32, 32); // Size of Earth
    const wdMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    whiteDwarfMesh = new THREE.Mesh(wdGeo, wdMat);
    whiteDwarfMesh.visible = false;
    scene.add(whiteDwarfMesh);

    document.getElementById('trigger-explosion').addEventListener('click', startExplosion);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // Intersect planet meshes
    const meshes = celestialBodies.map(b => b.mesh).filter(m => m && m.visible);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        const body = celestialBodies.find(b => b.mesh === object);
        if (body && body !== hoveredBody) {
            hoveredBody = body;
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (hoveredBody) {
            hoveredBody = null;
            document.body.style.cursor = 'default';
        }
    }
}

function onMouseClick(event) {
    if (hoveredBody) {
        focusOnPlanet(hoveredBody);
    }
}

function focusOnPlanet(body) {
    focusedBody = body;

    const targetPos = new THREE.Vector3();
    body.mesh.getWorldPosition(targetPos);

    // Move camera to a nice viewing position relative to the planet
    // Simple "Chase Cam" offset: Position slightly up and behind/front
    const offset = new THREE.Vector3(0, body.data.radius * 3, body.data.radius * 5);

    // Smooth transition would be better, but simple Lerp in animate requires state.
    // For prototype, let's teleport or use a simple tween logic if we had tween library.
    // Let's manually set position for instant snap, user can then orbit.
    camera.position.copy(targetPos).add(offset);
    controls.target.copy(targetPos);
    controls.minDistance = body.data.radius * 1.2; // Allow closer zoom
    controls.update();
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
    sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    celestialBodies.push({ mesh: sunMesh, data: sunData, type: 'sun' });

    solarSystemData.planets.forEach(data => {
        const orbitGroup = new THREE.Group();
        scene.add(orbitGroup);
        const bodyGroup = new THREE.Group();
        bodyGroup.position.x = data.distance;
        orbitGroup.add(bodyGroup);

        const geometry = new THREE.SphereGeometry(data.radius, 64, 64);
        let material;
        const loader = new THREE.TextureLoader();

        if (data.textureMap) {
            const texture = loader.load(data.textureMap);
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 1.0,
                metalness: 0.0
            });
        } else {
            const type = data.info.type || '';
            let texture;
            if (data.name === 'Terra') {
                texture = textureGenerator.createTerrestrialTexture(data.color, 'earth');
            } else if (type.includes('Gasoso') || type.includes('Gelo')) {
                texture = textureGenerator.createGasGiantTexture(data.color);
            } else {
                texture = textureGenerator.createTerrestrialTexture(data.color, 'rocky');
            }
            material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.9,
                metalness: 0.05
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        bodyGroup.add(mesh);

        // Orbit Path
        const orbitPathGeo = new THREE.RingGeometry(data.distance - 0.1, data.distance + 0.1, 128);
        const orbitPathMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide });
        const orbitPath = new THREE.Mesh(orbitPathGeo, orbitPathMat);
        orbitPath.rotation.x = Math.PI / 2;
        scene.add(orbitPath);

        // Labels
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label-container';
        const text = document.createElement('div');
        text.className = 'label-text';
        text.textContent = data.name;
        labelDiv.appendChild(text);

        const label = new CSS2DObject(labelDiv);
        label.position.set(0, data.radius * 2, 0);
        label.center.set(0.5, 1);
        bodyGroup.add(label);

        // Add Atmosphere for Earth
        if (data.name === 'Terra' || data.name === 'Vênus') {
            const atmoGeo = new THREE.SphereGeometry(data.radius * 1.05, 32, 32);
            const atmoColor = data.name === 'Terra' ? 0x0044ff : 0xffddaa;
            const atmoMat = new THREE.MeshBasicMaterial({
                color: atmoColor,
                transparent: true,
                opacity: 0.3,
                side: THREE.FrontSide
            });
            const atmo = new THREE.Mesh(atmoGeo, atmoMat);
            bodyGroup.add(atmo);
        }

        // Add Rings for Saturn
        if (data.hasRings) {
            const startRad = data.radius * 1.2;
            const endRad = data.radius * 2.3;
            const ringGeo = new THREE.RingGeometry(startRad, endRad, 64);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0xaa8855,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            // UV mapping for rings
            var pos = ringGeo.attributes.position;
            var v3 = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                v3.fromBufferAttribute(pos, i);
                const dist = v3.length();
                const u = (dist - startRad) / (endRad - startRad);
                ringGeo.attributes.uv.setXY(i, u, 0.5);
            }
            if (data.ringMap) {
                const ringTex = loader.load(data.ringMap);
                ringMat.map = ringTex;
            }

            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            bodyGroup.add(ring);
        }


        celestialBodies.push({
            type: 'planet',
            mesh: mesh,
            orbitGroup: orbitGroup, // Rotates (contains bodyGroup)
            bodyGroup: bodyGroup, // Position offset (contains mesh, label, moons, atmosphere, rings)
            orbitPath: orbitPath, // Static visual ring
            distance: data.distance,
            name: data.name
        });
    });
}

function startExplosion() {
    resetSystem(); // Ensure clean state
    explosionActive = true;
    explosionPhase = 1;
    targetYear = 5000002025;
    document.getElementById('status-text').innerText = "Estado: GIGANTE VERMELHA";
    document.getElementById('status-text').style.color = "#ff3300";
}

function resetSystem() {
    explosionActive = false;
    explosionPhase = 0;

    // Reset Sun
    sunMesh.scale.set(1, 1, 1);
    sunMesh.visible = true;
    sunMesh.material.color.setHex(0xffffff); // Standard color? emissive map handles look
    sunMesh.material.emissive.setHex(0xffaa00);
    sunMesh.material.emissiveIntensity = 2;
    sunMesh.material.transparent = false;
    sunMesh.material.opacity = 1.0;
    sunMesh.material.needsUpdate = true;

    // Light reset
    sunLight.color.setHex(0xffffff);
    sunLight.intensity = 500;
    sunLight.visible = true;

    // Hide White Dwarf
    whiteDwarfMesh.visible = false;

    // Reset Planets
    celestialBodies.forEach(body => {
        if (body.type === 'planet') {
            body.mesh.visible = true;
            body.orbitGroup.visible = true;
            body.orbitPath.visible = true;
            body.vaporized = false;
        }
    });

    document.getElementById('status-text').innerText = "Estado: Estável";
    document.getElementById('status-text').style.color = "#00ccff";
}

function animate() {
    requestAnimationFrame(animate);

    if (explosionActive) {
        if (explosionPhase === 1) {
            // Expansion (Red Giant) - Slow growth, dark but glowing red
            sunMesh.scale.addScalar(0.002); // Slower growth

            // Keep it glowing! We need a red that's dark in hue but high in value for bloom
            sunMesh.material.emissive.lerp(new THREE.Color(0xff2200), 0.002);
            sunMesh.material.emissiveIntensity = THREE.MathUtils.lerp(sunMesh.material.emissiveIntensity, 4, 0.002);

            sunLight.color.lerp(new THREE.Color(0xff3300), 0.005);
            sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 1200, 0.002); // Increase light coverage as it grows

            // Check for planet consumption
            celestialBodies.forEach(body => {
                if (body.type === 'planet' && body.mesh.visible) {
                    const sunRadius = sunMesh.geometry.parameters.radius * sunMesh.scale.x;
                    if (body.distance < sunRadius) {
                        // Ocultar TUDO
                        body.mesh.visible = false;
                        body.orbitGroup.visible = false;
                        body.orbitPath.visible = false;

                        if (body.name === 'Terra' && !body.vaporized) {
                            body.vaporized = true;
                            document.getElementById('status-text').innerText = "Estado: TERRA VAPORIZADA";
                        }
                    }
                }
            });

            if (sunMesh.scale.x > 5) { // Max scale near Mars
                explosionPhase = 3; // Skip Flash, go straight to Fade Out

                // Prepare transition
                sunMesh.material.transparent = true;
                sunMesh.material.opacity = 1.0;
                sunMesh.material.needsUpdate = true;

                whiteDwarfMesh.visible = true; // Show the remnant

                // Anã branca tem luz branca!
                sunLight.color.setHex(0xffffff);
                sunLight.intensity = 100;

                document.getElementById('status-text').innerText = "Estado: FADE-OUT / ANÃ BRANCA";
            }
        } else if (explosionPhase === 2) {
            // Removed Flash Phase
            explosionPhase = 3;
        } else if (explosionPhase === 3) {
            // Cooling / Fade Out
            // SunMesh (Nebula) expands slightly and fades completely
            sunMesh.scale.addScalar(0.05); // Expand nebula slowly
            sunMesh.material.opacity -= 0.002; // Slow fade out

            if (sunMesh.material.opacity <= 0) {
                sunMesh.visible = false;
                document.getElementById('status-text').innerText = "Estado: ESTÁVEL (ANÃ BRANCA)";
            }

            // White dwarf stable
        }
    }

    // Normal rotation
    celestialBodies.forEach(body => {
        if (body.type === 'planet' && body.mesh.visible) {
            body.orbitGroup.rotation.y += 0.01;
            // Keep labels facing camera? CSS2D handles that essentially always 2D
        }
    });

    if (asteroidSystem) asteroidSystem.rotation.y += 0.0005;
    if (kuiperSystem) kuiperSystem.rotation.y += 0.0002;

    if (focusedBody && focusedBody.mesh && focusedBody.mesh.visible) {
        const targetPos = new THREE.Vector3();
        focusedBody.mesh.getWorldPosition(targetPos);
        controls.target.lerp(targetPos, 0.1);
    }

    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
}

init();

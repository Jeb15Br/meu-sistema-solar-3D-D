import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { solarSystemData } from '../data/planet-data.js?v=33';
import { textureGenerator } from './TextureGenerator.js';
// [FIX] State injected via initSpaceFactory to avoid module duplication issues
// import { state } from './GameState.js'; 
import { setupLabelInteraction } from './InputManager.js?v=2';
import { closeInfo } from './UIManager.js?v=2';

// --- LOADING MANAGER ---
export const loadingManager = new THREE.LoadingManager();

let appState = null;

export function initSpaceFactory(state, onLoadCallback) {
    appState = state;
    loadingManager.onLoad = function () {
        console.log('Loading complete!');
        if (onLoadCallback) onLoadCallback();
    };

    loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        // Optional: Update progress bar
    };
}

export function createStars() {
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
    appState.scene.add(stars);
}

export function createAsteroidBelts() {
    appState.asteroidSystem = createBeltParticleSystem(1200, 60, 75); // Reduzido de 2000
    appState.scene.add(appState.asteroidSystem);
    appState.kuiperSystem = createBeltParticleSystem(2500, 200, 250); // Reduzido de 4000
    appState.scene.add(appState.kuiperSystem);
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

export function createSystem() {
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
    appState.scene.add(sunMesh);

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
    appState.celestialBodies.push(sunBody);

    setupLabelInteraction(sunLabelDiv, sunBody);

    solarSystemData.planets.forEach(data => createPlanet(data));
    solarSystemData.dwarfs.forEach(data => createPlanet(data));

    // --- CRIAR ANÃ BRANCA (Invisível Inicialmente) ---
    const wdData = solarSystemData.whiteDwarf;
    const wdGeo = new THREE.SphereGeometry(sunData.radius * 0.3, 32, 32); // Menor que o sol
    const wdMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0,
        transparent: true
    });
    const wdMesh = new THREE.Mesh(wdGeo, wdMat);
    wdMesh.visible = false;
    wdMesh.castShadow = false; // Shadow disabled per user request
    wdMesh.receiveShadow = false;
    appState.scene.add(wdMesh);
    appState.whiteDwarfMesh = wdMesh;

    // Rótulo da Anã Branca
    const wdLabelDiv = document.createElement('div');
    wdLabelDiv.className = 'label-container';
    wdLabelDiv.style.display = 'none'; // Começa escondido
    const wdLabelText = document.createElement('div');
    wdLabelText.className = 'label-text';
    wdLabelText.innerText = wdData.name;
    wdLabelText.style.color = '#ffffff';
    wdLabelText.style.textShadow = '0 0 8px #ffffff';
    wdLabelDiv.appendChild(wdLabelText);
    const wdInfo = document.createElement('div');
    wdInfo.className = 'hover-info';
    wdLabelDiv.appendChild(wdInfo);

    const wdLabel = new CSS2DObject(wdLabelDiv);
    wdLabel.position.set(0, sunData.radius * 0.5, 0);
    wdMesh.add(wdLabel);

    wdMesh.body = { mesh: wdMesh, data: wdData, type: 'whiteDwarf', label: wdLabel, infoDiv: wdInfo };
    setupLabelInteraction(wdLabelDiv, wdMesh.body);
}

function createPlanet(data) {
    const orbitGroup = new THREE.Group();
    if (data.startAngle) {
        orbitGroup.rotation.y = data.startAngle;
    }
    appState.scene.add(orbitGroup);

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
    mesh.castShadow = false;
    mesh.receiveShadow = false;
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
    appState.scene.add(orbitPath);

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

            appState.celestialBodies.push({
                type: 'moon',
                mesh: moonMesh,
                orbit: moonOrbit,
                distance: moonData.distance,
                speed: moonData.speed,
                originalDistance: moonData.distance,
                originalSpeed: moonData.speed,
                data: moonData,
                label: null // Will be populated below if we decide to add one
            });

            // [NEW] Add Label for Moons (ONLY FOR 'Lua' as requested)
            if (moonData.name === 'Lua') {
                const moonLabelDiv = document.createElement('div');
                moonLabelDiv.className = 'label-container moon-label';

                const moonLabelText = document.createElement('div');
                moonLabelText.className = 'label-text';
                moonLabelText.innerText = moonData.name;
                moonLabelText.style.fontSize = '0.7em';
                moonLabelText.style.color = '#aaaaaa';
                moonLabelDiv.appendChild(moonLabelText);

                const moonLabel = new CSS2DObject(moonLabelDiv);
                moonLabel.position.set(0, moonData.radius * 2.5, 0);
                moonMesh.add(moonLabel);

                // Link label to the last added body
                const moonBody = appState.celestialBodies[appState.celestialBodies.length - 1];
                moonBody.label = moonLabel;

                setupLabelInteraction(moonLabelDiv, moonBody);
            }


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
    appState.celestialBodies.push(body);

    // FIX: Enable click/hover on label
    setupLabelInteraction(labelDiv, body);
}

export function createFluminensePlanet() {
    const data = solarSystemData.fluminense;
    if (!data) return;

    // --- 1. HIERARQUIA DE ÓRBITA ESTÁVEL (Sem Bambolê) ---
    // Estrutura: Scene -> TiltGroup (Inclinação Fixa) -> RotatorGroup (Animação Y) -> BodyGroup (Translação X)

    // Grupo de Inclinação (Fixo no Espaço)
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.x = Math.PI / 4; // 45 graus
    tiltGroup.rotation.z = Math.PI / 8; // Leve inclinação lateral
    appState.scene.add(tiltGroup);

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
    appState.scene.updateMatrixWorld(true);

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
    appState.celestialBodies.push(body);

    // Forçar renderização inicial
    mesh.visible = true;
    tiltGroup.visible = true;

    setupLabelInteraction(labelDiv, body);

    // --- 3. DURAÇÃO DE 60 SEGUNDOS ---
    setTimeout(() => {
        if (body && mesh) {
            console.log("🕊️ Planeta Fluminense partindo para a próxima vitória...");
            if (appState.focusedBody === body) closeInfo();

            // Remover label do DOM
            if (labelDiv && labelDiv.parentNode) {
                labelDiv.parentNode.removeChild(labelDiv);
            }

            // Remover da cena (Hierarquia correta: Root -> TiltGroup)
            if (tiltGroup) appState.scene.remove(tiltGroup);

            // Limpeza da lista
            appState.celestialBodies = appState.celestialBodies.filter(b => b !== body);
        }
    }, 60000); // 60 segundos

    return body;
}

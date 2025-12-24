import * as THREE from 'three';
import { state, saveEggs } from './GameState.js';
import { audioManager } from './AudioManager.js';

let uiCallbacks = {};

export function initUI(callbacks) {
    uiCallbacks = callbacks;
}

export function setupMenu() {
    const uiInfoBtn = document.getElementById('info-btn');
    const uiInfoMenu = document.getElementById('info-menu');

    if (uiInfoBtn && uiInfoMenu) {
        uiInfoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (uiInfoMenu.classList.contains('hidden')) {
                uiInfoMenu.classList.remove('hidden');
                state.isInteractingWithUI = true;
                // Note: selectedMenuItemIndex is in InputManager, we might want to reset it here if we had access
                // For now, InputManager handles keyboard nav when isInteractingWithUI is true.
                document.body.style.cursor = 'default';

                if (state.controls) {
                    state.controls.enabled = false;
                    state.controls.enableKeys = false;
                }
            } else {
                uiInfoMenu.classList.add('hidden');
                state.isInteractingWithUI = false;
                if (state.controls) {
                    state.controls.enabled = true;
                    state.controls.enableKeys = true;
                }
            }
            audioManager.playHover();
        });

        document.getElementById('menu-about').onclick = (e) => {
            e.stopPropagation();
            showAboutProject();
            uiInfoMenu.classList.add('hidden');
        };

        document.getElementById('menu-camera').onclick = (e) => {
            e.stopPropagation();
            showCameraInfo();
            uiInfoMenu.classList.add('hidden');
        };

        document.getElementById('menu-planets').onclick = (e) => {
            e.stopPropagation();
            showPlanetsInfo();
            uiInfoMenu.classList.add('hidden');
        };

        document.getElementById('menu-keyboard').onclick = (e) => {
            e.stopPropagation();
            showKeyboardShortcuts();
            uiInfoMenu.classList.add('hidden');
        };

        document.getElementById('menu-easter').onclick = (e) => {
            e.stopPropagation();
            showEasterInfo();
            uiInfoMenu.classList.add('hidden');
        };

        document.getElementById('menu-credits').onclick = (e) => {
            e.stopPropagation();
            showCredits();
            uiInfoMenu.classList.add('hidden');
        };

        document.querySelectorAll('.info-menu-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                audioManager.playHover();
            });
        });
    }
}

// --- BROWSER NOTIFICATION ---
export function showChromeWarning() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if (isChrome) {
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
        toast.style.zIndex = '11000';
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

export function showControlsToast(force = false) {
    if (!force && localStorage.getItem('solar_system_tutorial_shown')) return;

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
    toast.style.paddingRight = '45px';
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

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.transition = 'opacity 1s, transform 1s';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 1000);
        }
    }, 15000);
}

// --- TYPEWRITER EFFECT UTILITY ---
export async function typeWriter(element, htmlContent, speed = 10, onComplete) {
    if (element._cancelTyping) element._cancelTyping();
    element.innerHTML = '';

    let isCancelled = false;
    element._cancelTyping = () => { isCancelled = true; };

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const children = Array.from(tempDiv.childNodes);

    const prepareStructure = (sourceNode, targetNode) => {
        const tasks = [];
        if (sourceNode.nodeType === Node.TEXT_NODE) {
            const content = sourceNode.textContent;
            if (content.trim() === '') {
                targetNode.appendChild(document.createTextNode(content));
                return [];
            }

            const parts = content.match(/.*?[.!,?;:()\[\]\-]+|[^.!,?;:()\[\]\-]+/g) || [content];
            parts.forEach((partText) => {
                const partWrapper = document.createElement('span');
                partWrapper.className = 'sentence-wrapper';
                partWrapper.style.display = 'inline';
                targetNode.appendChild(partWrapper);

                const chars = [...partText];
                chars.forEach((char, i) => {
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.className = 'char-fade';
                    span.style.animationDelay = `${i * speed}ms`;
                    partWrapper.appendChild(span);
                });

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

export function closeActiveModal() {
    if (audioManager) audioManager.playHover();
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;

    const titleEl = overlay.querySelector('h2');
    const title = titleEl ? titleEl.innerText : '';
    const shouldRestoreMenu = title.includes('SOBRE') || title.includes('CONTROLE') || title.includes('ATALHOS') || title.includes('PLANETAS') || title.includes('CRÉDITOS') || title.includes('EASTER');

    const contentArea = document.getElementById('modal-content-area');
    if (contentArea && contentArea._cancelTyping) contentArea._cancelTyping();

    overlay.classList.remove('active');

    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();

        const infoMenu = document.getElementById('info-menu');
        if (shouldRestoreMenu && infoMenu) {
            infoMenu.classList.remove('hidden');
            state.isInteractingWithUI = true;
        }

        const isMenuOpen = infoMenu && !infoMenu.classList.contains('hidden');
        if (!isMenuOpen) {
            state.isInteractingWithUI = false;
            if (state.controls) state.controls.enabled = true;
        }

        state.isModalOpen = false;
        document.body.classList.remove('modal-blur');
        if (!state.focusedBody && state.controls) state.controls.enabled = true;
    }, 300);
}

export function createInfoModal(title, contentHTML, btnText = 'Entendi!') {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'info-modal';

    modal.innerHTML = `
        <h2 style="color: #00ccff; margin-bottom: 20px; font-size: 1.8rem; text-align: center; text-shadow: 0 0 10px rgba(0, 204, 255, 0.5);">${title}</h2>
        <div id="modal-content-area" style="line-height: 1.6; font-size: 1rem; min-height: 100px;"></div>
        <div id="modal-action-area" style="text-align: center; margin-top: 30px; opacity: 0; transition: opacity 0.5s;">
            <button id="close-modal-btn" style="background: transparent; border: 1px solid #00ccff; color: #00ccff; padding: 10px 30px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s;">${btnText}</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('active'));

    state.isInteractingWithUI = true;
    state.isModalOpen = true;
    document.body.classList.add('modal-blur');
    document.body.style.cursor = 'default';

    if (state.hoveredBody && uiCallbacks.highlightBody) {
        uiCallbacks.highlightBody(state.hoveredBody, false);
        state.hoveredBody = null;
    }

    if (state.controls) state.controls.enabled = false;

    const closeBtn = document.getElementById('close-modal-btn');
    closeBtn.onclick = closeActiveModal;

    closeBtn.onmouseover = () => {
        audioManager.playHover();
        closeBtn.style.background = 'rgba(0, 204, 255, 0.1)';
        closeBtn.style.boxShadow = '0 0 10px rgba(0, 204, 255, 0.3)';
    };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'transparent'; closeBtn.style.boxShadow = 'none'; };

    const contentDiv = document.getElementById('modal-content-area');
    typeWriter(contentDiv, contentHTML, 10, () => {
        const actionArea = document.getElementById('modal-action-area');
        if (actionArea) actionArea.style.opacity = '1';
    });
}

export function showAboutProject() {
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

export function showCameraInfo() {
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

export function showPlanetsInfo() {
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

export function showKeyboardShortcuts() {
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

export function showEasterToast(message = "Easter-egg encontrado") {
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

    requestAnimationFrame(() => {
        toast.classList.add('active');
        const bar = toast.querySelector('.toast-progress-bar');
        if (bar) bar.classList.add('animate');
    });

    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.remove('active');
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
        }
    }, 3000);
}

export function showEasterInfo(discoveredType = null) {
    if (discoveredType === 'pluto') {
        state.eggsFound.pluto = true;
        saveEggs();
        showEasterToast("Easter-egg de Plutão encontrado!");
        return;
    } else if (discoveredType === 'moon') {
        state.eggsFound.moon = true;
        saveEggs();
        showEasterToast("Easter-egg da Lua encontrado!");
        return;
    } else if (discoveredType === 'fluminense') {
        state.eggsFound.fluminense = true;
        saveEggs();
        showEasterToast("Fluminense encontrado!");
        return;
    }

    let title = '🥚 EASTER EGGS';
    let html = '';
    const foundCount = (state.eggsFound.pluto ? 1 : 0) + (state.eggsFound.moon ? 1 : 0) + (state.eggsFound.fluminense ? 1 : 0);

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
                    <p>${state.eggsFound.pluto ? '✅ <strong>Plutão:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
                    <p>${state.eggsFound.moon ? '✅ <strong>Lua:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
                    <p>${state.eggsFound.fluminense ? '✅ <strong>Fluminense:</strong> Descoberto!' : '❓ <strong>???:</strong> ???'}</p>
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
    saveEggs();
}

export function showCredits() {
    const html = `
        <p style="font-size: 1.1rem; text-align: center; margin-bottom: 20px;">Este projeto foi idealizado e desenvolvido por:</p>
        <div style="font-size: 2.8rem; font-weight: bold; text-align: center; color: #00ccff; text-shadow: 0 0 20px rgba(0, 204, 255, 0.8);">Jeb15Br</div>
        <p style="margin-top: 30px; color: #888; font-size: 0.9rem; text-align: center;">Tecnologias: Three.js | CSS2D | JavaScript Canvas</p>
    `;
    createInfoModal('💎 CRÉDITOS', html);
}

export function updateInfoPanel(body) {
    const data = body.data;
    const infoName = document.getElementById('info-name');
    const infoAge = document.getElementById('info-age');
    const infoType = document.getElementById('info-type');
    const infoTranslation = document.getElementById('info-translation');
    const infoRotation = document.getElementById('info-rotation');
    const infoMoons = document.getElementById('info-moons');
    const infoDesc = document.getElementById('info-desc');

    infoName.innerText = data.name;

    typeWriter(infoAge, data.info.age || '?', 10);
    typeWriter(infoType, data.info.type || '?', 10);
    typeWriter(infoTranslation, data.info.translation || '?', 10);
    typeWriter(infoRotation, data.info.rotation || '?', 10);
    typeWriter(infoMoons, data.info.moons || '0', 10);

    infoDesc.innerHTML = '';
    const textContainer = document.createElement('div');
    textContainer.id = 'panel-content-area';
    textContainer.style.marginBottom = '15px';
    infoDesc.appendChild(textContainer);

    if (data.name === 'Sol' || (data.name === 'Gigante Vermelha' && state.explosionPhase === 1) || (data.name === 'Anã Branca' && state.explosionPhase === 3)) {
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'sun-trigger-btn';

        if (state.explosionPhase === 0) {
            triggerBtn.innerText = '⚠️ INICIAR SEQUÊNCIA FINAL';
            triggerBtn.onclick = () => {
                if (uiCallbacks.startExplosion) uiCallbacks.startExplosion();
                triggerBtn.remove();
            };
        } else if (state.explosionPhase === 1) {
            triggerBtn.innerText = '⏳ AGUARDANDO COLAPSO...';
            triggerBtn.style.opacity = '0.7';
            triggerBtn.disabled = true;
        } else if (state.explosionPhase === 3) {
            triggerBtn.innerText = '↺ RENASCER SISTEMA';
            triggerBtn.onclick = () => {
                if (uiCallbacks.resetSolarSystem) uiCallbacks.resetSolarSystem();
                triggerBtn.remove();
            };
        }
        infoDesc.appendChild(triggerBtn);
    }

    let cheeseClicks = 0;
    infoDesc.onclick = (e) => {
        const egg = e.target.closest('.secret-interaction');
        if (!egg) return;
        e.stopPropagation();
        const category = egg.getAttribute('data-category') || 'moon';

        if (category === 'moon') {
            cheeseClicks++;
            if (cheeseClicks >= 10) {
                toggleMoonCheese(!state.isCheeseMode);
                cheeseClicks = 0;
            }
        } else {
            audioManager.playSecretAction(category);
            if (category === 'pluto' && !state.eggsFound.pluto) {
                setTimeout(() => showEasterInfo('pluto'), 100);
            }
        }
    };

    const descContent = data.info.desc || '...';
    typeWriter(textContainer, descContent, 10);
}

export function closeInfo() {
    if (state.isCheeseMode) {
        toggleMoonCheese(false);
    }
    state.focusedBody = null;
    state.isFlying = false;
    state.isModalOpen = false;
    if (state.controls) {
        state.controls.enabled = true;
        state.controls.enableKeys = true;
        state.controls.enablePan = true;
    }

    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.add('hidden');
}

let moonOriginalTexture = null;
let moonOriginalGeometry = null;
let moonMeshRef = null;
let originalInfo = {};

export function toggleMoonCheese(enable) {
    const descEl = document.getElementById('info-desc');
    const ageEl = document.getElementById('info-age');
    const typeEl = document.getElementById('info-type');
    const transEl = document.getElementById('info-translation');
    const rotEl = document.getElementById('info-rotation');

    if (enable) {
        let body = state.focusedBody;
        if (!body || body.data.name !== 'Lua') {
            body = state.celestialBodies.find(b => b.data && b.data.name === 'Lua');
        }
        if (!body) return;

        if (!state.isCheeseMode) {
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
                steps: 1, depth: 0.4, bevelEnabled: true,
                bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4
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

            state.isCheeseMode = true;
            if (!state.eggsFound.moon) {
                state.eggsFound.moon = true;
                saveEggs();
                showEasterInfo('moon');
            }
        }
    } else {
        if (state.isCheeseMode) {
            if (moonMeshRef && moonOriginalTexture && moonOriginalGeometry) {
                moonMeshRef.geometry = moonOriginalGeometry;
                moonMeshRef.rotation.set(0, 0, 0);
                moonMeshRef.material.map = moonOriginalTexture;
                moonMeshRef.material.color.setHex(0xffffff);
                moonMeshRef.material.needsUpdate = true;
            }
            if (originalInfo.desc) {
                if (!state.focusedBody || state.focusedBody.data.name === 'Lua') {
                    descEl.innerHTML = originalInfo.desc;
                    ageEl.innerText = originalInfo.age;
                    typeEl.innerText = originalInfo.type;
                    transEl.innerText = originalInfo.trans;
                    rotEl.innerText = originalInfo.rot;
                }
            }
            state.isCheeseMode = false;
            moonOriginalTexture = null;
            moonOriginalGeometry = null;
            moonMeshRef = null;
            originalInfo = {};
        }
    }
}

import { state, saveEggs } from './GameState.js?v=2';

// Centralize Audio Senses & Voice
export const audioManager = {
    playlist: [
        'assets/musics/Aria Math.mp3',
        'assets/musics/Droppy likes your Face.mp3',
        'assets/musics/The Guardian of The Threshold.mp3'
    ],
    currentIndex: 0,
    element: null,
    btn: null,
    hoverPool: [],
    hoverPoolIndex: 0,
    hoverPoolSize: 6,
    activeSecretAudio: null,
    discoveryAssets: [],
    discoveryQueue: [],
    resetSoundPool: [],
    resetPoolIndex: 0,
    resetPoolSize: 3,

    init: function () {
        this.initSpecialAssets();
        this.initResetSound();

        // Tenta buscar elementos (DOM pode não estar pronto ainda)
        this.element = document.getElementById('bg-music');
        this.btn = document.getElementById('audio-btn');

        if (this.element) {
            this.setupAudioListeners();
        } else {
            console.log("AudioManager: Audio element deferred (Lazy Load)");
        }

        if (this.btn) {
            this.setupBtnListeners();
        }

        // Pre-load hover sounds pool
        this.hoverPool = [];
        for (let i = 0; i < this.hoverPoolSize; i++) {
            const audio = new Audio('assets/sound_effects/click.mp3');
            audio.volume = 1.0;
            audio.load();
            this.hoverPool.push(audio);
        }

        this.discoverTracks();

        this.element.loop = false;
        this.element.addEventListener('ended', () => this.nextTrack());
        this.element.addEventListener('error', (e) => {
            console.warn("Audio Error, skipping:", this.playlist[this.currentIndex]);
            this.nextTrack();
        });

        this.element.src = this.playlist[0];
    },

    playHover: function () {
        const sound = this.hoverPool[this.hoverPoolIndex];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => { });
            this.hoverPoolIndex = (this.hoverPoolIndex + 1) % this.hoverPoolSize;
        }
    },

    playSecretAction: function (category = 'pluto', showToastCallback = null) {
        if (category === 'moon') return;

        if (category === 'fluminense') {
            console.log("🎺 Fluminense! Usando som de descoberta aleatório...");
            state.eggsFound.fluminense = true;
            saveEggs();
            if (showToastCallback) showToastCallback("Fluminense encontrado");
            return;
        }

        if (this.activeSecretAudio && !this.activeSecretAudio.paused && !this.activeSecretAudio.ended) {
            return;
        }

        if (this.discoveryQueue.length === 0) {
            let sourceList = this.discoveryAssets;
            if (!sourceList || sourceList.length === 0) return; // Safety check

            this.discoveryQueue = [...sourceList];
            for (let i = this.discoveryQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.discoveryQueue[i], this.discoveryQueue[j]] = [this.discoveryQueue[j], this.discoveryQueue[i]];
            }
        }

        const nextSound = this.discoveryQueue.pop();
        if (!nextSound || !nextSound.audio) return;

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

    initResetSound: function () {
        this.resetSoundPool = [];
        for (let i = 0; i < this.resetPoolSize; i++) {
            const audio = new Audio('assets/sound_effects/reset.mp3');
            audio.volume = 0.8;
            audio.preload = 'auto';
            audio.load();
            this.resetSoundPool.push(audio);
        }
    },

    playResetSound: function () {
        const sound = this.resetSoundPool[this.resetPoolIndex];
        if (sound) {
            sound.currentTime = 0.05;
            sound.play().catch(e => console.warn("Erro ao tocar reset sound:", e));
            this.resetPoolIndex = (this.resetPoolIndex + 1) % this.resetPoolSize;
        }
    },

    discoverTracks: function () {
        this.element.src = this.playlist[0];
    },

    setupAudioListeners: function () {
        if (!this.element) return;
        this.element.loop = false;
        // Evitar duplicar listeners
        this.element.onended = () => this.nextTrack();
        this.element.onerror = (e) => {
            console.warn("Audio Error, skipping:", this.playlist[this.currentIndex]);
            this.nextTrack();
        };
        if (!this.element.src) this.element.src = this.playlist[0];
    },

    setupBtnListeners: function () {
        if (!this.btn) return;
        this.btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        };
    },

    tryLazyLoad: function () {
        if (!this.element) {
            this.element = document.getElementById('bg-music');
            if (this.element) this.setupAudioListeners();
        }
        if (!this.btn) {
            this.btn = document.getElementById('audio-btn');
            if (this.btn) this.setupBtnListeners();
        }
        return !!this.element;
    },

    toggle: function () {
        // [LAZY LOAD] Se não achou antes, tenta achar agora
        if (!this.element) {
            if (!this.tryLazyLoad()) {
                console.warn("AudioManager: Audio element still missing.");
                return;
            }
        }

        if (this.element.paused) {
            this.element.play().then(() => {
                if (this.btn) this.btn.innerText = '🔇 Pausar';
            }).catch(e => console.warn("Play failed:", e));
        } else {
            this.element.pause();
            if (this.btn) this.btn.innerText = '🔈 Música';
        }
    },

    showMusicToast: function () {
        const existingToast = document.getElementById('music-toast');
        if (existingToast) existingToast.remove();

        let rawName = this.playlist[this.currentIndex].split('/').pop().replace(/%20/g, ' ').replace('.mp3', '');

        const prettyNames = {
            'Aria Math': 'Aria Math - C418',
            'Droppy likes your Face': 'Droopy likes your Face - C418',
            'Droopy likes your Face': 'Droopy likes your Face - C418',
            'The Guardian of The Threshold': 'The Guardian of The Threshold - I Think I Can Help You'
        };

        const songName = prettyNames[rawName] || (rawName + ' - Unknown Author');

        const toast = document.createElement('div');
        toast.id = 'music-toast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 20px; background: rgba(0, 20, 40, 0.82);
            color: #00ccff; padding: 12px 25px; border-radius: 8px; border: 1px solid #00ccff;
            font-family: 'Exo 2', sans-serif; z-index: 20000; pointer-events: none;
            box-shadow: 0 0 20px rgba(0, 204, 255, 0.2); transition: opacity 0.8s ease-out;
            opacity: 0;
        `;
        toast.innerText = '♪ Tocando: ' + songName;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.style.opacity = '1');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 800);
            }
        }, 3000);
    },

    nextTrack: function () {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.element.src = this.playlist[this.currentIndex];
        this.element.play().then(() => {
            this.btn.innerText = '🔇 Pausar';
            this.showMusicToast();
        }).catch(e => console.warn("Skip error:", e));
    },

    prevTrack: function () {
        this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.element.src = this.playlist[this.currentIndex];
        this.element.play().then(() => {
            this.btn.innerText = '🔇 Pausar';
            this.showMusicToast();
        }).catch(e => console.warn("Skip error:", e));
    }
};

export const IOSManager = {
    init: function () {
        // Check if running in browser (not standalone)
        // iOS "standalone" property is true when running from Home Screen
        const isStandalone = window.navigator.standalone === true;

        if (!isStandalone) {
            this.showAddToHomeHint();
        }
    },

    setupFullscreen: function () {
        // iOS Safari doesn't support requestFullscreen for DOM elements easily.
        // We use the "Scroll Hack" to hide the address bar.
        window.scrollTo(0, 1);
    },

    showAddToHomeHint: function () {
        // Create Hint Element
        const hint = document.createElement('div');
        hint.id = 'ios-install-hint';
        hint.className = 'ios-install-hint';
        hint.innerHTML = `
            <div class="hint-content">
                <button id="close-hint">×</button>
                <div class="hint-icon">📱</div>
                <div class="hint-text">
                    <h3>Instale o App</h3>
                    <p>Para obter a <strong>Tela Cheia</strong> real, adicione à Tela de Início.</p>
                    <div class="hint-instructions">
                        <span>1. Toque em Compartilhar <img src="assets/ios_share_icon.png" style="width:12px; filter:invert(1);" onerror="this.outerHTML='(Quadrado com seta)'"></span>
                        <span>2. "Adicionar à Tela de Início" ➕</span>
                    </div>
                </div>
            </div>
            <div class="hint-arrow">⬇</div>
        `;

        document.body.appendChild(hint);

        // Auto-show after a delay
        setTimeout(() => {
            hint.classList.add('visible');
        }, 2000);

        // Close Handler
        hint.querySelector('#close-hint').addEventListener('click', () => {
            hint.classList.remove('visible');
            setTimeout(() => hint.remove(), 500);
        });

        // Also close if user taps the hint body (except instructions) to allow them to work
        // Actually, let's keep it persistent until closed or added.
    },

    config: {
        platform: 'iOS',
        supportsNativeFullscreen: false
    }
};

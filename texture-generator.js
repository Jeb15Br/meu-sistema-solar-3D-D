import * as THREE from 'three';

export const textureGenerator = {
    // Helper to get random ranges
    rand: (min, max) => Math.random() * (max - min) + min,

    createSunTexture: function () {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(0, 0, 512, 256);

        // Noise/Spots
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 256;
            const r = Math.random() * 20 + 5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 100, 0, ${Math.random() * 0.5})`;
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    },

    createGasGiantTexture: function (colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const baseColor = new THREE.Color(colorHex);
        const hsl = {};
        baseColor.getHSL(hsl);

        // Draw bands
        for (let y = 0; y < 256; y++) {
            // Vary lightness sine-wave style for bands
            const l = hsl.l + Math.sin(y * 0.1) * 0.1 + (Math.random() * 0.05);
            const color = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, l)));
            ctx.fillStyle = '#' + color.getHexString();
            ctx.fillRect(0, y, 512, 1);
        }

        // Add some storms
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 256;
            const r = Math.random() * 20 + 5;
            // Ellipse
            ctx.beginPath();
            ctx.ellipse(x, y, r * 2, r, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0,0.1)`;
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    },

    createTerrestrialTexture: function (colorHex, type) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const baseColor = new THREE.Color(colorHex);

        ctx.fillStyle = '#' + baseColor.getHexString();
        ctx.fillRect(0, 0, 512, 256);

        // Simple noise
        if (type === 'earth') {
            // Ocean base (Deep blue)
            ctx.fillStyle = '#001133';
            ctx.fillRect(0, 0, 512, 256);

            // Continents (Irregular blobs)
            // Use smaller, more numerous shapes for land
            ctx.fillStyle = '#225522'; // Darker Green
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 180 + 38; // Avoid poles
                const r = Math.random() * 30 + 10;
                ctx.beginPath();
                // Distort circle
                for (let a = 0; a < Math.PI * 2; a += 0.5) {
                    const rad = r + Math.random() * 15;
                    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
                }
                ctx.fill();
            }

            // Add some brown/mountains
            ctx.fillStyle = '#554433';
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 180 + 38;
                const r = Math.random() * 15 + 5;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Polar Caps
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 30); // North
            ctx.fillRect(0, 226, 512, 30); // South

            // Clouds (Wispy overlays)
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            for (let i = 0; i < 150; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 256;
                const w = Math.random() * 50 + 10;
                const h = Math.random() * 10 + 2;
                ctx.fillRect(x, y, w, h);
            }

        } else {
            // Craters / Noise for Mars/Mercury
            for (let i = 0; i < 300; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 256;
                const w = Math.random() * 3 + 1;
                ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
                ctx.fillRect(x, y, w, w);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    },

    createRingTexture: function () {
        // Simple gradient for rings
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        // We map this to ring geometry, so U is radial?
        // Actually RingGeometry UVs are polar. 
        // Let's just make a radial gradient if mapped standardly, or linear if mapped linearly.
        // Standard THREE Ring mapping is difficult without custom UVs.
        // Let's assume basic white tint for now or try to make lines.

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 32);

        return new THREE.CanvasTexture(canvas);
    }
};

export const solarSystemData = {
    sun: {
        name: "Sol",
        radius: 10,
        color: 0xffaa00,
        emissive: 0xff4400,
        info: { age: "4.6 Bi Anos", type: "Estrela", desc: "A estrela central do sistema solar. 99.86% da massa do sistema.", translation: "230 Mi Anos", rotation: "27 dias", moons: "0" }
    },
    planets: [
        {
            name: "Mercúrio",
            radius: 1.5,
            distance: 20,
            speed: 0.04,
            startAngle: 1.2, // Approx radians
            color: 0x999999, // Mercury - more metallic/gray
            info: { age: "4.5 Bi Anos", type: "Rochoso", desc: "O planeta mais próximo do Sol. Super quentinho de dia, congelante à noite.", translation: "88 dias", rotation: "59 dias", moons: "0" },
            textureMap: 'assets/mercury.jpg',
            moons: []
        },
        {
            name: "Vênus",
            radius: 2,
            distance: 30,
            speed: 0.03,
            startAngle: 3.5,
            color: 0xffddaa, // Venus - brighter
            retrograde: false, // Tilt 177 handles the visual retrograde. True would double-flip it.
            tilt: 177, // Upside down effectively
            info: { age: "4.5 Bi Anos", type: "Rochoso", desc: "O planeta mais quente, com efeito estufa intenso.", translation: "225 dias", rotation: "243 dias", moons: "0" },
            textureMap: 'assets/venus.jpg',
            moons: []
        },
        {
            name: "Terra",
            radius: 2.1,
            distance: 40,
            speed: 0.02,
            startAngle: 5.92, // ~94% of orbit (Dec 11)
            color: 0x00aaff, // Earth - more vibrant blue
            tilt: 23.5,
            info: { age: "4.5 Bi Anos", type: "Rochoso", desc: "Nossa casa! O único lugar conhecido com vida (e pizza).", translation: "365 dias", rotation: "24h", moons: "1" },
            textureMap: 'assets/earth_day_custom.jpg',
            nightMap: 'assets/earth_night_custom.jpg',
            moons: [{
                name: "Lua",
                radius: 0.5,
                distance: 4,
                speed: 0.1,
                startAngle: 1.5, // Começar ao lado da Terra (visível)
                color: 0x888888,
                textureMap: 'assets/moon.jpg',
                tilt: 5,
                info: {
                    age: "4.5 Bi Anos",
                    type: "Satélite",
                    desc: "Nossa fiel companheira. <span class='secret-interaction' data-category='moon'>Queijo suíço?</span>",
                    translation: "27 dias",
                    rotation: "27 dias",
                    moons: "0"
                }
            }]
        },
        {
            name: "Marte",
            radius: 1.8,
            distance: 55,
            speed: 0.016,
            startAngle: 0.5,
            color: 0xff4411, // Mars - more red
            tilt: 25.2,
            info: { age: "4.5 Bi Anos", type: "Rochoso", desc: "O Planeta Vermelho. Lar de futuros colonizadores?", translation: "687 dias", rotation: "24h 37m", moons: "2" },
            textureMap: 'assets/mars.jpg',
            moons: [{ name: "Fobos", radius: 0.2, distance: 2.5, speed: 0.3, color: 0x555555 }, { name: "Deimos", radius: 0.15, distance: 3.5, speed: 0.2, color: 0x555555 }]
        },
        {
            name: "Júpiter",
            radius: 6,
            distance: 80,
            speed: 0.008,
            startAngle: 2.2,
            color: 0xffaa77, // Jupiter - richer
            tilt: 3.1,
            info: { age: "4.5 Bi Anos", type: "Gigante Gasoso", desc: "O maior planeta. Uma tempestade eterna chamada Grande Mancha Vermelha.", translation: "12 anos", rotation: "9h 55m", moons: "95" },
            textureMap: 'assets/jupiter.jpg',
            moons: [
                { name: "Io", radius: 0.6, distance: 8, speed: 0.1, color: 0xffffaa },
                { name: "Europa", radius: 0.5, distance: 10, speed: 0.08, color: 0xaaffff },
                { name: "Ganimedes", radius: 0.7, distance: 12, speed: 0.06, color: 0xcccccc },
                { name: "Calisto", radius: 0.6, distance: 14, speed: 0.04, color: 0x888888 }
            ]
        },
        {
            name: "Saturno",
            radius: 5,
            distance: 110,
            speed: 0.006,
            startAngle: 4.8,
            color: 0xeebb66,
            hasRings: true,
            tilt: 27,
            info: { age: "4.5 Bi Anos", type: "Gigante Gasoso", desc: "Famoso pelos seus anéis deslumbrantes.", translation: "29 anos", rotation: "10h 33m", moons: "146" },
            textureMap: 'assets/saturn.jpg',
            ringMap: 'assets/saturn_rings.png',
            moons: [{ name: "Titã", radius: 0.8, distance: 9, speed: 0.05, color: 0xffaa00 }]
        },
        {
            name: "Urano",
            radius: 4,
            distance: 140,
            speed: 0.004,
            startAngle: 1.0,
            color: 0x88eeff, // Uranus - vibrant cyan
            tilt: 98, // Rolling on side
            info: { age: "4.5 Bi Anos", type: "Gigante de Gelo", desc: "Gira de lado. Muito frio.", translation: "84 anos", rotation: "17h 14m", moons: "28" },
            textureMap: 'assets/uranus.jpg',
            moons: [{ name: "Titânia", radius: 0.4, distance: 6, speed: 0.06, color: 0xdddddd }]
        },
        {
            name: "Netuno",
            radius: 3.8,
            distance: 165,
            speed: 0.003,
            startAngle: 6.0,
            color: 0x4488ff, // Neptune - deeper blue
            tilt: 28.3,
            info: { age: "4.5 Bi Anos", type: "Gigante de Gelo", desc: "Ventos supersônicos e muito azul.", translation: "165 anos", rotation: "16h", moons: "16" },
            textureMap: 'assets/neptune.jpg',
            moons: [{ name: "Tritão", radius: 0.5, distance: 6, speed: 0.05, color: 0xffcccc }]
        }
    ],
    dwarfs: [
        {
            name: "Plutão",
            radius: 0.8,
            distance: 190,
            speed: 0.002,
            startAngle: 3.0,
            color: 0xccccaa,
            info: { age: "4.5 Bi Anos", type: "Planeta Anão", desc: "Rebaixado à Série B dos planetas, mas jamais esquecido, <span class='secret-interaction' data-category='pluto'>brutal, não sobrou nada pro beta.</span> Coração gelado.", translation: "248 anos", rotation: "6 dias", moons: "5" },
            textureMap: 'assets/pluto.jpg'
        }
    ],
    whiteDwarf: {
        name: "Anã Branca",
        info: {
            age: "5+ Bi Anos",
            type: "Remanescente Estelar",
            desc: "O núcleo denso que restou após o Sol esgotar seu combustível e expelir suas camadas externas. É extremamente quente e densa.",
            rotation: "Horas/Dias",
            moons: "0"
        }
    },
    fluminense: {
        name: "Planeta Fluminense",
        radius: 4.5,
        distance: 130, // Órbita entre Saturno e Urano
        speed: 0.005,
        color: 0x800000, // Grená
        info: {
            age: "Eterno",
            type: "Planeta Tricolor",
            desc: "Um planeta habitado por torcedores tricolores. Sua órbita é única e inclinada, desafiando a física comum, assim como o talento do time das Laranjeiras.",
            translation: "Varia (Guerreiro)",
            rotation: "90 min",
            moons: "1 (Libertadores)"
        }
    }
};

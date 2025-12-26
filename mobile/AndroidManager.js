export const AndroidManager = {
    setupFullscreen: function () {
        const doc = document.documentElement;
        const requestFS = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.mozRequestFullScreen || doc.msRequestFullscreen;

        if (requestFS) {
            requestFS.call(doc).catch(err => {
                console.warn("Android/PC Fullscreen request blocked:", err);
            });
        }
    },

    // Future Android-specific settings can go here
    config: {
        platform: 'Android',
        supportsNativeFullscreen: true
    }
};

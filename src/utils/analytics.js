/**
 * Analytics & User Tracking (RGPD-Compliant)
 * Utilise Plausible Analytics (ou Google Analytics 4 en option)
 */

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || '';
const ENABLE_ANALYTICS = import.meta.env.PROD && PLAUSIBLE_DOMAIN;

// Configuration
const config = {
    plausible: ENABLE_ANALYTICS,
    customEvents: true, // Tracking d'événements personnalisés
    autoPageviews: true, // Pageviews automatiques
};

/**
 * Initialise Plausible Analytics
 */
export function initAnalytics() {
    if (!config.plausible) {
        console.log('📊 Analytics disabled (dev mode or no domain configured)');
        return;
    }

    try {
        // Charger le script Plausible dynamiquement
        const script = document.createElement('script');
        script.defer = true;
        script.dataset.domain = PLAUSIBLE_DOMAIN;
        script.src = 'https://plausible.io/js/script.js';

        // Support des événements custom
        if (config.customEvents) {
            script.dataset.api = 'https://plausible.io/api/event';
        }

        document.head.appendChild(script);

        console.log('✅ Plausible Analytics initialized for:', PLAUSIBLE_DOMAIN);
    } catch (error) {
        console.error('❌ Failed to load analytics:', error);
    }
}

/**
 * Track un événement personnalisé
 * @param {string} eventName - Nom de l'événement
 * @param {Object} props - Propriétés additionnelles
 */
export function trackEvent(eventName, props = {}) {
    if (!config.plausible) {
        console.log('📊 [Analytics]', eventName, props);
        return;
    }

    try {
        if (window.plausible) {
            window.plausible(eventName, { props });
        }
    } catch (error) {
        console.error('Failed to track event:', error);
    }
}

/**
 * Track une pageview (automatique normalement)
 * @param {string} page - URL de la page
 */
export function trackPageview(page) {
    if (!config.autoPageviews || !config.plausible) return;

    try {
        if (window.plausible) {
            window.plausible('pageview', { props: { page } });
        }
    } catch (error) {
        console.error('Failed to track pageview:', error);
    }
}

/**
 * Track des événements spécifiques au jeu
 */
export const GameAnalytics = {
    // Track quand le jeu démarre
    gameStart() {
        trackEvent('Game Start');
    },

    // Track quand l'utilisateur active le boost
    boostUsed(count) {
        trackEvent('Boost Used', { count });
    },

    // Track achievement débloqué
    achievementUnlocked(name) {
        trackEvent('Achievement Unlocked', { achievement: name });
    },

    // Track collectible ramassé
    collectiblePicked(score) {
        trackEvent('Collectible Picked', { score });
    },

    // Track entrée dans une zone
    zoneEntered(zoneName) {
        trackEvent('Zone Entered', { zone: zoneName });
    },

    // Track entrée dans le garage
    garageEntered() {
        trackEvent('Garage Entered');
    },

    // Track customization de la voiture
    carCustomized(part, color) {
        trackEvent('Car Customized', { part, color });
    },

    // Track vitesse max atteinte
    maxSpeedReached(speed) {
        trackEvent('Max Speed Reached', { speed_kmh: speed });
    },

    // Track temps de jeu
    playTime(minutes) {
        trackEvent('Play Time', { minutes });
    },

    // Track erreurs de chargement
    loadingError(assetName) {
        trackEvent('Loading Error', { asset: assetName });
    },

    // Track performance
    performanceIssue(fps) {
        trackEvent('Performance Issue', { fps });
    },
};

/**
 * Alternative : Google Analytics 4
 * (Décommenter pour utiliser GA4 au lieu de Plausible)
 */
/*
export function initGA4() {
    const GA4_ID = import.meta.env.VITE_GA4_ID || '';
    if (!GA4_ID || !import.meta.env.PROD) return;

    // Charger Google Analytics
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA4_ID, {
        anonymize_ip: true, // RGPD
        cookie_flags: 'SameSite=None;Secure',
    });

    console.log('✅ Google Analytics 4 initialized');
}
*/

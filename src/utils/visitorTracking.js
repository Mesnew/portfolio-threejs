/**
 * Custom Visitor Tracking System
 * Système de tracking avancé pour monitorer les visiteurs et leurs actions
 */

import { trackEvent } from './analytics.js';

class VisitorTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.visitorId = this.getOrCreateVisitorId();
        this.sessionStart = Date.now();
        this.actions = [];
        this.currentPage = window.location.pathname;

        // Infos du visiteur
        this.visitorInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            memory: navigator.deviceMemory || 'unknown',
            connection: this.getConnectionInfo(),
            referrer: document.referrer,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        // Détection du type d'appareil
        this.deviceType = this.detectDeviceType();

        // Stocker localement pour debug
        if (!import.meta.env.PROD) {
            console.log('👤 Visitor Info:', this.visitorInfo);
            console.log('📱 Device Type:', this.deviceType);
        }

        this.init();
    }

    init() {
        // Tracker la session
        this.trackSession();

        // Tracker les interactions
        this.setupEventListeners();

        // Envoyer un heartbeat toutes les 30 secondes
        this.startHeartbeat();

        // Tracker avant de quitter
        window.addEventListener('beforeunload', () => this.endSession());
    }

    /**
     * Génère un ID de session unique
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Récupère ou crée un ID visiteur persistant
     */
    getOrCreateVisitorId() {
        let visitorId = localStorage.getItem('visitor_id');

        if (!visitorId) {
            visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('visitor_id', visitorId);
            localStorage.setItem('first_visit', new Date().toISOString());
        }

        return visitorId;
    }

    /**
     * Détecte le type d'appareil
     */
    detectDeviceType() {
        const ua = navigator.userAgent;

        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    /**
     * Récupère les infos de connexion
     */
    getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        if (connection) {
            return {
                effectiveType: connection.effectiveType, // '4g', '3g', etc.
                downlink: connection.downlink, // Mbps
                rtt: connection.rtt, // Round-trip time en ms
                saveData: connection.saveData, // Mode économie de données
            };
        }

        return null;
    }

    /**
     * Track la session initiale
     */
    trackSession() {
        const sessionData = {
            sessionId: this.sessionId,
            visitorId: this.visitorId,
            device: this.deviceType,
            timestamp: new Date().toISOString(),
            ...this.visitorInfo,
        };

        // Envoyer à l'analytics
        trackEvent('Session Start', sessionData);

        // Vérifier si c'est la première visite
        const firstVisit = localStorage.getItem('first_visit');
        const visitCount = parseInt(localStorage.getItem('visit_count') || '0') + 1;
        localStorage.setItem('visit_count', visitCount.toString());

        if (visitCount === 1) {
            trackEvent('First Visit', { timestamp: firstVisit });
        }

        // Logger en dev
        if (!import.meta.env.PROD) {
            console.log('📊 Session tracked:', sessionData);
        }
    }

    /**
     * Setup les event listeners pour tracker les actions
     */
    setupEventListeners() {
        // Clicks
        document.addEventListener('click', (e) => {
            this.trackAction('click', {
                target: e.target.tagName,
                x: e.clientX,
                y: e.clientY,
            });
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.trackAction('keypress', {
                key: e.code,
                // Ne pas logger les valeurs sensibles
            });
        });

        // Scroll (throttled)
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackAction('scroll', {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX,
                });
            }, 500);
        });

        // Resize
        window.addEventListener('resize', () => {
            this.trackAction('resize', {
                width: window.innerWidth,
                height: window.innerHeight,
            });
        });

        // Visibilité (tab change)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackAction('tab_hidden');
            } else {
                this.trackAction('tab_visible');
            }
        });
    }

    /**
     * Track une action utilisateur
     */
    trackAction(actionType, data = {}) {
        const action = {
            type: actionType,
            timestamp: Date.now(),
            ...data,
        };

        this.actions.push(action);

        // Limiter le nombre d'actions en mémoire
        if (this.actions.length > 100) {
            this.actions.shift();
        }

        // Logger en dev
        if (!import.meta.env.PROD && actionType !== 'keypress') {
            // console.log('👆 Action:', action);
        }
    }

    /**
     * Track des événements de jeu spécifiques
     */
    trackGameEvent(eventName, data = {}) {
        this.trackAction('game_event', {
            event: eventName,
            ...data,
        });

        trackEvent(eventName, data);
    }

    /**
     * Track les performances du jeu
     */
    trackPerformance(fps, carSpeed) {
        this.trackAction('performance', {
            fps,
            carSpeed,
            timestamp: Date.now(),
        });

        // Alerter si performance faible
        if (fps < 30) {
            trackEvent('Low FPS', { fps, device: this.deviceType });
        }
    }

    /**
     * Track la position de la voiture (heatmap)
     */
    trackCarPosition(x, z, speed) {
        // Ne tracker que toutes les 2 secondes pour ne pas surcharger
        const now = Date.now();
        if (!this.lastPositionTrack || now - this.lastPositionTrack > 2000) {
            this.trackAction('car_position', {
                x: Math.round(x),
                z: Math.round(z),
                speed: Math.round(speed),
            });
            this.lastPositionTrack = now;
        }
    }

    /**
     * Heartbeat toutes les 30 secondes
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const duration = Math.floor((Date.now() - this.sessionStart) / 1000);

            trackEvent('Heartbeat', {
                sessionId: this.sessionId,
                duration,
                actionCount: this.actions.length,
            });
        }, 30000);
    }

    /**
     * Fin de session
     */
    endSession() {
        const duration = Math.floor((Date.now() - this.sessionStart) / 1000);

        trackEvent('Session End', {
            sessionId: this.sessionId,
            duration,
            actionCount: this.actions.length,
        });

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }

    /**
     * Récupère les stats de la session
     */
    getSessionStats() {
        return {
            sessionId: this.sessionId,
            visitorId: this.visitorId,
            duration: Math.floor((Date.now() - this.sessionStart) / 1000),
            actionCount: this.actions.length,
            deviceType: this.deviceType,
            visitCount: parseInt(localStorage.getItem('visit_count') || '0'),
        };
    }

    /**
     * Export des données pour analyse
     */
    exportData() {
        return {
            session: this.getSessionStats(),
            visitor: this.visitorInfo,
            actions: this.actions,
        };
    }
}

// Instance globale
let tracker = null;

/**
 * Initialise le tracker
 */
export function initVisitorTracking() {
    if (!tracker) {
        tracker = new VisitorTracker();
        console.log('✅ Visitor Tracking initialized');
    }
    return tracker;
}

/**
 * Récupère l'instance du tracker
 */
export function getTracker() {
    return tracker;
}

/**
 * Helpers pour tracker depuis l'app
 */
export const VisitorTracking = {
    trackGameEvent(eventName, data) {
        if (tracker) tracker.trackGameEvent(eventName, data);
    },

    trackPerformance(fps, carSpeed) {
        if (tracker) tracker.trackPerformance(fps, carSpeed);
    },

    trackCarPosition(x, z, speed) {
        if (tracker) tracker.trackCarPosition(x, z, speed);
    },

    getStats() {
        return tracker ? tracker.getSessionStats() : null;
    },

    exportData() {
        return tracker ? tracker.exportData() : null;
    },
};

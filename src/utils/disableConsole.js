/**
 * Désactive console.log en production pour améliorer les performances
 * Garde console.error et console.warn pour le debugging critique
 */

export function disableConsoleInProduction() {
    if (import.meta.env.PROD) {
        // Save original console.log
        const originalLog = console.log;

        // Override console.log to do nothing in production
        console.log = function() {};

        console.info('🚀 Production mode: console.log disabled for performance');
    }
}

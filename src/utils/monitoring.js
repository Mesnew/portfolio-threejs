/**
 * Monitoring & Error Tracking avec Sentry
 */

import * as Sentry from '@sentry/browser';

// Configuration Sentry (à configurer avant déploiement)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''; // Depuis .env
const ENABLE_SENTRY = import.meta.env.PROD && SENTRY_DSN; // Actif seulement en production

/**
 * Initialise Sentry pour le monitoring des erreurs
 */
export function initSentry() {
    if (!ENABLE_SENTRY) {
        console.log('📊 Sentry disabled (dev mode or no DSN)');
        return;
    }

    try {
        Sentry.init({
            dsn: SENTRY_DSN,

            // Environment
            environment: import.meta.env.MODE, // 'production' ou 'development'

            // Release tracking
            release: `portfolio-3d@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

            // Performance Monitoring
            tracesSampleRate: 0.2, // 20% des transactions (gratuit jusqu'à 10k/mois)

            // Error Sampling
            sampleRate: 1.0, // 100% des erreurs

            // Ignore certain errors
            ignoreErrors: [
                // Browser extensions
                'top.GLOBALS',
                'chrome-extension://',
                'moz-extension://',
                // Network errors
                'NetworkError',
                'Failed to fetch',
                // Random plugins/extensions
                'ResizeObserver loop limit exceeded',
            ],

            // Breadcrumbs (historique d'actions avant erreur)
            beforeBreadcrumb(breadcrumb) {
                // Filtrer les breadcrumbs sensibles
                if (breadcrumb.category === 'console') {
                    return null; // Ignorer les console.log
                }
                return breadcrumb;
            },

            // Avant d'envoyer une erreur
            beforeSend(event, hint) {
                // Ne pas envoyer en dev
                if (!import.meta.env.PROD) {
                    console.log('Sentry event (not sent in dev):', event);
                    return null;
                }

                // Anonymiser les données sensibles
                if (event.request && event.request.url) {
                    // Retirer query params sensibles
                    event.request.url = event.request.url.split('?')[0];
                }

                return event;
            },

            // Intégrations
            integrations: [
                // Performance monitoring
                new Sentry.BrowserTracing({
                    tracingOrigins: ['localhost', /^\//],
                }),
            ],
        });

        console.log('✅ Sentry initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Sentry:', error);
    }
}

/**
 * Log une erreur custom dans Sentry
 * @param {Error} error
 * @param {Object} context - Contexte additionnel
 */
export function logError(error, context = {}) {
    console.error('Error:', error, context);

    if (ENABLE_SENTRY) {
        Sentry.captureException(error, {
            extra: context,
        });
    }
}

/**
 * Log un événement personnalisé (non-erreur)
 * @param {string} message
 * @param {string} level - 'info' | 'warning' | 'error'
 * @param {Object} context
 */
export function logEvent(message, level = 'info', context = {}) {
    console.log(`[${level}]`, message, context);

    if (ENABLE_SENTRY) {
        Sentry.captureMessage(message, {
            level: level,
            extra: context,
        });
    }
}

/**
 * Définir l'utilisateur actuel (pour tracking)
 * @param {Object} user
 */
export function setUser(user) {
    if (ENABLE_SENTRY) {
        Sentry.setUser(user);
    }
}

/**
 * Ajouter du contexte à toutes les erreurs futures
 * @param {string} key
 * @param {any} value
 */
export function setContext(key, value) {
    if (ENABLE_SENTRY) {
        Sentry.setContext(key, value);
    }
}

/**
 * Mesurer la performance d'une fonction
 * @param {string} name - Nom de l'opération
 * @param {Function} fn - Fonction à mesurer
 */
export async function measurePerformance(name, fn) {
    if (!ENABLE_SENTRY) {
        return await fn();
    }

    const transaction = Sentry.startTransaction({ name });

    try {
        const result = await fn();
        transaction.setStatus('ok');
        return result;
    } catch (error) {
        transaction.setStatus('internal_error');
        logError(error, { operation: name });
        throw error;
    } finally {
        transaction.finish();
    }
}

/**
 * Wrapper pour les fonctions async qui catch automatiquement les erreurs
 * @param {Function} fn
 * @param {string} errorMessage
 */
export function safeAsync(fn, errorMessage = 'Async operation failed') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            logError(error, {
                message: errorMessage,
                args: args,
            });
            throw error;
        }
    };
}

// Export Sentry pour usage avancé
export { Sentry };

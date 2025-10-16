/**
 * Professional logging system for Portfolio 3D
 * Allows control over log levels in development vs production
 */

const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
};

class Logger {
    constructor() {
        // Set log level based on environment
        // In production, only show errors and warnings
        this.level = import.meta.env.PROD ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
        this.prefix = '🎮';
    }

    setLevel(level) {
        this.level = level;
    }

    error(message, ...args) {
        if (this.level >= LOG_LEVELS.ERROR) {
            console.error(`${this.prefix} ❌`, message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.level >= LOG_LEVELS.WARN) {
            console.warn(`${this.prefix} ⚠️`, message, ...args);
        }
    }

    info(message, ...args) {
        if (this.level >= LOG_LEVELS.INFO) {
            console.log(`${this.prefix} ℹ️`, message, ...args);
        }
    }

    debug(message, ...args) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            console.log(`${this.prefix} 🔍`, message, ...args);
        }
    }

    // Méthodes spécifiques pour les différents systèmes
    physics(message, ...args) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            console.log(`${this.prefix} ⚙️ [Physics]`, message, ...args);
        }
    }

    model(message, ...args) {
        if (this.level >= LOG_LEVELS.INFO) {
            console.log(`${this.prefix} 📦 [Model]`, message, ...args);
        }
    }

    achievement(message, ...args) {
        if (this.level >= LOG_LEVELS.INFO) {
            console.log(`${this.prefix} 🏆 [Achievement]`, message, ...args);
        }
    }

    performance(message, ...args) {
        if (this.level >= LOG_LEVELS.DEBUG) {
            console.log(`${this.prefix} ⚡ [Performance]`, message, ...args);
        }
    }
}

// Export singleton instance
export const logger = new Logger();
export { LOG_LEVELS };

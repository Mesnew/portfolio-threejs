/**
 * Système de cycle jour/nuit réaliste
 * Gère les transitions d'éclairage et de couleurs
 */

import * as THREE from 'three';

// Configuration réaliste pour le jour
const DAY_CONFIG = {
    // Soleil
    sunIntensity: 1.8,
    sunColor: 0xfff5e6, // Légèrement chaud
    sunPosition: { x: 50, y: 80, z: 30 },

    // Lumière ambiante du ciel
    skyIntensity: 0.8,
    skyColor: 0x87ceeb, // Bleu ciel
    groundColor: 0xd2b48c, // Sable/terre

    // Lumière d'ambiance
    ambientIntensity: 1.0,
    ambientColor: 0xffffff,

    // Couleur du ciel
    backgroundColor: 0x87ceeb, // Bleu ciel jour
    fogColor: 0xc5e3f6,
    fogDensity: 0.0008,

    // Post-processing
    bloomStrength: 0.3,
    brightness: 0.1,
    saturation: 1.15,
    vignetteDarkness: 0.5
};

// Configuration pour la nuit (crépuscule/lune brillante - très visible)
const NIGHT_CONFIG = {
    // Lune très brillante
    sunIntensity: 1.2,
    sunColor: 0xc8d8e6, // Bleu très clair lunaire
    sunPosition: { x: -50, y: 60, z: -30 },

    // Lumière ambiante nocturne forte
    skyIntensity: 0.7,
    skyColor: 0x3a4f64, // Bleu nuit plus clair
    groundColor: 0x4a5a6e, // Gris bleuté plus clair

    // Lumière d'ambiance forte
    ambientIntensity: 0.8,
    ambientColor: 0x8a9ba8, // Gris bleu clair

    // Couleur du ciel (crépuscule lumineux)
    backgroundColor: 0x2a3a4a, // Bleu nuit lumineux
    fogColor: 0x3a4a5a,
    fogDensity: 0.0012,

    // Post-processing
    bloomStrength: 0.7, // Bloom plus fort pour les lampadaires
    brightness: 0.05, // Légèrement plus lumineux
    saturation: 0.95, // Presque normal
    vignetteDarkness: 0.6 // Plus subtil
};

export class DayNightCycle {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // État actuel (0 = jour, 1 = nuit)
        this.timeOfDay = 0; // Commence en jour
        this.isTransitioning = false;
        this.transitionDuration = 3000; // 3 secondes de transition
        this.transitionStartTime = 0;
        this.transitionStartValue = 0;
        this.transitionTargetValue = 0;

        // Références aux lumières
        this.lights = {
            sun: null,
            hemisphere: null,
            ambient: null,
            pointLight: null
        };

        // Référence au composer pour post-processing
        this.composer = null;

        // Fog
        this.fog = null;
    }

    /**
     * Initialise les lumières de la scène
     */
    setupLights() {
        // Soleil/Lune (directional light)
        this.lights.sun = new THREE.DirectionalLight(DAY_CONFIG.sunColor, DAY_CONFIG.sunIntensity);
        this.lights.sun.position.set(
            DAY_CONFIG.sunPosition.x,
            DAY_CONFIG.sunPosition.y,
            DAY_CONFIG.sunPosition.z
        );
        this.lights.sun.castShadow = this.renderer.shadowMap.enabled;
        if (this.lights.sun.castShadow) {
            this.lights.sun.shadow.mapSize.width = 2048;
            this.lights.sun.shadow.mapSize.height = 2048;
            this.lights.sun.shadow.camera.near = 0.5;
            this.lights.sun.shadow.camera.far = 500;
            this.lights.sun.shadow.camera.left = -100;
            this.lights.sun.shadow.camera.right = 100;
            this.lights.sun.shadow.camera.top = 100;
            this.lights.sun.shadow.camera.bottom = -100;
        }
        this.scene.add(this.lights.sun);

        // Lumière hémisphérique (ciel/sol)
        this.lights.hemisphere = new THREE.HemisphereLight(
            DAY_CONFIG.skyColor,
            DAY_CONFIG.groundColor,
            DAY_CONFIG.skyIntensity
        );
        this.lights.hemisphere.position.set(0, 50, 0);
        this.scene.add(this.lights.hemisphere);

        // Lumière ambiante
        this.lights.ambient = new THREE.AmbientLight(
            DAY_CONFIG.ambientColor,
            DAY_CONFIG.ambientIntensity
        );
        this.scene.add(this.lights.ambient);

        // Point light subtile pour les reflets
        this.lights.pointLight = new THREE.PointLight(0xffd700, 0.2, 50);
        this.lights.pointLight.position.set(0, 5, 0);
        this.scene.add(this.lights.pointLight);

        // Fond et brouillard
        this.scene.background = new THREE.Color(DAY_CONFIG.backgroundColor);
        this.fog = new THREE.FogExp2(DAY_CONFIG.fogColor, DAY_CONFIG.fogDensity);
        this.scene.fog = this.fog;

        console.log('☀️ Day/Night cycle initialized (starting in DAY mode)');
    }

    /**
     * Définit le composer pour le post-processing
     */
    setComposer(composer) {
        this.composer = composer;
    }

    /**
     * Bascule entre jour et nuit
     */
    toggle() {
        if (this.isTransitioning) return;

        this.isTransitioning = true;
        this.transitionStartTime = Date.now();
        this.transitionStartValue = this.timeOfDay;
        this.transitionTargetValue = this.timeOfDay === 0 ? 1 : 0;

        const mode = this.transitionTargetValue === 1 ? 'NIGHT' : 'DAY';
        console.log(`🌓 Transitioning to ${mode} mode...`);
    }

    /**
     * Interpole entre deux configurations
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }

    /**
     * Interpole entre deux couleurs
     */
    lerpColor(color1, color2, t) {
        const c1 = new THREE.Color(color1);
        const c2 = new THREE.Color(color2);
        return c1.lerp(c2, t);
    }

    /**
     * Fonction d'easing pour une transition douce
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Met à jour le cycle (à appeler chaque frame)
     */
    update() {
        if (!this.isTransitioning) return;

        const now = Date.now();
        const elapsed = now - this.transitionStartTime;
        let progress = Math.min(elapsed / this.transitionDuration, 1);

        // Appliquer easing
        progress = this.easeInOutCubic(progress);

        // Calculer la valeur actuelle
        this.timeOfDay = this.lerp(this.transitionStartValue, this.transitionTargetValue, progress);

        // Appliquer les changements
        this.applyLighting(this.timeOfDay);

        // Fin de transition
        if (progress >= 1) {
            this.isTransitioning = false;
            const mode = this.timeOfDay === 1 ? 'NIGHT' : 'DAY';
            console.log(`✨ Transition to ${mode} complete`);
        }
    }

    /**
     * Applique l'éclairage basé sur timeOfDay (0 = jour, 1 = nuit)
     */
    applyLighting(t) {
        // Soleil/Lune
        if (this.lights.sun) {
            this.lights.sun.intensity = this.lerp(DAY_CONFIG.sunIntensity, NIGHT_CONFIG.sunIntensity, t);
            this.lights.sun.color = this.lerpColor(DAY_CONFIG.sunColor, NIGHT_CONFIG.sunColor, t);

            // Position du soleil/lune
            this.lights.sun.position.x = this.lerp(DAY_CONFIG.sunPosition.x, NIGHT_CONFIG.sunPosition.x, t);
            this.lights.sun.position.y = this.lerp(DAY_CONFIG.sunPosition.y, NIGHT_CONFIG.sunPosition.y, t);
            this.lights.sun.position.z = this.lerp(DAY_CONFIG.sunPosition.z, NIGHT_CONFIG.sunPosition.z, t);
        }

        // Hemisphere light
        if (this.lights.hemisphere) {
            this.lights.hemisphere.intensity = this.lerp(DAY_CONFIG.skyIntensity, NIGHT_CONFIG.skyIntensity, t);
            this.lights.hemisphere.color = this.lerpColor(DAY_CONFIG.skyColor, NIGHT_CONFIG.skyColor, t);
            this.lights.hemisphere.groundColor = this.lerpColor(DAY_CONFIG.groundColor, NIGHT_CONFIG.groundColor, t);
        }

        // Ambient light
        if (this.lights.ambient) {
            this.lights.ambient.intensity = this.lerp(DAY_CONFIG.ambientIntensity, NIGHT_CONFIG.ambientIntensity, t);
            this.lights.ambient.color = this.lerpColor(DAY_CONFIG.ambientColor, NIGHT_CONFIG.ambientColor, t);
        }

        // Background
        this.scene.background = this.lerpColor(DAY_CONFIG.backgroundColor, NIGHT_CONFIG.backgroundColor, t);

        // Fog
        if (this.fog) {
            this.fog.color = this.lerpColor(DAY_CONFIG.fogColor, NIGHT_CONFIG.fogColor, t);
            this.fog.density = this.lerp(DAY_CONFIG.fogDensity, NIGHT_CONFIG.fogDensity, t);
        }

        // Post-processing
        if (this.composer && this.composer.passes) {
            // Bloom
            const bloomPass = this.composer.passes.find(pass => pass.constructor.name === 'UnrealBloomPass');
            if (bloomPass) {
                bloomPass.strength = this.lerp(DAY_CONFIG.bloomStrength, NIGHT_CONFIG.bloomStrength, t);
            }

            // Color grading
            const colorGradingPass = this.composer.passes.find(pass => pass.uniforms && pass.uniforms.brightness);
            if (colorGradingPass) {
                colorGradingPass.uniforms.brightness.value = this.lerp(DAY_CONFIG.brightness, NIGHT_CONFIG.brightness, t);
                colorGradingPass.uniforms.saturation.value = this.lerp(DAY_CONFIG.saturation, NIGHT_CONFIG.saturation, t);
            }

            // Vignette
            const vignettePass = this.composer.passes.find(pass => pass.uniforms && pass.uniforms.darkness);
            if (vignettePass) {
                vignettePass.uniforms.darkness.value = this.lerp(DAY_CONFIG.vignetteDarkness, NIGHT_CONFIG.vignetteDarkness, t);
            }
        }
    }

    /**
     * Force le mode jour
     */
    setDay() {
        this.timeOfDay = 0;
        this.isTransitioning = false;
        this.applyLighting(0);
        console.log('☀️ Set to DAY mode');
    }

    /**
     * Force le mode nuit
     */
    setNight() {
        this.timeOfDay = 1;
        this.isTransitioning = false;
        this.applyLighting(1);
        console.log('🌙 Set to NIGHT mode');
    }

    /**
     * Retourne si c'est le jour (true) ou la nuit (false)
     */
    isDay() {
        return this.timeOfDay < 0.5;
    }

    /**
     * Nettoie les ressources
     */
    dispose() {
        Object.values(this.lights).forEach(light => {
            if (light) {
                this.scene.remove(light);
                if (light.dispose) light.dispose();
            }
        });
    }
}

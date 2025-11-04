/**
 * Weather System - Système de météo dynamique
 * Effets: Pluie, brouillard, changement de visibilité
 * Inspiré par les jeux de course réalistes (Gran Turismo, Forza)
 */

import * as THREE from 'three';

export class WeatherSystem {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.intensity = 0; // 0 = pas de pluie, 1 = pluie forte
        this.targetIntensity = 0;

        // Paramètres de la pluie
        this.rainCount = 5000; // Nombre de gouttes de pluie
        this.rainGeometry = null;
        this.rainMaterial = null;
        this.rainParticles = null;
        this.rainVelocities = [];

        // Paramètres du brouillard
        this.baseFogDensity = 0.0005;
        this.rainFogDensity = 0.003;

        // Paramètres des éclaboussures au sol
        this.splashes = [];
        this.maxSplashes = 100;
        this.splashPool = []; // Pool de réutilisation

        // Paramètres des éclaboussures sur la voiture
        this.carSplashes = [];
        this.maxCarSplashes = 50;

        // Son de la pluie (optionnel)
        this.rainSound = null;

        // UI
        this.weatherIndicator = null;

        this.createRainSystem();
        this.createUI();
    }

    /**
     * Crée le système de particules de pluie
     */
    createRainSystem() {
        // Créer les particules de pluie avec BufferGeometry pour les performances
        this.rainGeometry = new THREE.BufferGeometry();

        const positions = new Float32Array(this.rainCount * 3);
        const velocities = [];

        // Zone de spawn de la pluie autour de la caméra
        const spawnRange = 100;
        const heightRange = 80;

        for (let i = 0; i < this.rainCount; i++) {
            const i3 = i * 3;

            // Position aléatoire dans une zone autour du joueur
            positions[i3] = (Math.random() - 0.5) * spawnRange;
            positions[i3 + 1] = Math.random() * heightRange + 20;
            positions[i3 + 2] = (Math.random() - 0.5) * spawnRange;

            // Vélocité de chaque goutte (légèrement aléatoire)
            velocities.push({
                x: (Math.random() - 0.5) * 2, // Vent horizontal
                y: -(20 + Math.random() * 10), // Vitesse de chute
                z: (Math.random() - 0.5) * 2
            });
        }

        this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.rainVelocities = velocities;

        // Matériau des gouttes
        this.rainMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.3,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Créer le système de particules
        this.rainParticles = new THREE.Points(this.rainGeometry, this.rainMaterial);
        this.rainParticles.visible = false; // Caché par défaut

        console.log('🌧️ Rain system created with', this.rainCount, 'particles');
    }

    /**
     * Active/désactive la pluie
     */
    toggle() {
        this.enabled = !this.enabled;

        if (this.enabled) {
            this.start();
        } else {
            this.stop();
        }
    }

    /**
     * Démarre la pluie avec une intensité donnée
     */
    start(intensity = 0.5) {
        this.enabled = true;
        this.targetIntensity = Math.max(0, Math.min(1, intensity));

        // Ajouter les particules de pluie à la scène
        if (!this.rainParticles.parent) {
            this.app.scene.add(this.rainParticles);
        }
        this.rainParticles.visible = true;

        // Activer le brouillard
        this.updateFog(true);

        // Afficher l'indicateur
        this.showIndicator();

        console.log('🌧️ Rain started with intensity:', this.targetIntensity);
    }

    /**
     * Arrête la pluie progressivement
     */
    stop() {
        this.enabled = false;
        this.targetIntensity = 0;

        // Désactiver le brouillard
        this.updateFog(false);

        // Masquer l'indicateur
        this.hideIndicator();

        console.log('☀️ Rain stopped');
    }

    /**
     * Change l'intensité de la pluie (0 à 1)
     */
    setIntensity(intensity) {
        this.targetIntensity = Math.max(0, Math.min(1, intensity));

        if (this.targetIntensity === 0 && this.enabled) {
            this.stop();
        } else if (this.targetIntensity > 0 && !this.enabled) {
            this.start(this.targetIntensity);
        }
    }

    /**
     * Met à jour le système de pluie (appelé chaque frame)
     */
    update(deltaTime) {
        if (!this.enabled && this.intensity <= 0) return;

        // Transition progressive de l'intensité
        const transitionSpeed = 0.3 * deltaTime;
        if (this.intensity < this.targetIntensity) {
            this.intensity = Math.min(this.intensity + transitionSpeed, this.targetIntensity);
        } else if (this.intensity > this.targetIntensity) {
            this.intensity = Math.max(this.intensity - transitionSpeed, this.targetIntensity);
        }

        // Cacher les particules si intensité = 0
        if (this.intensity <= 0) {
            this.rainParticles.visible = false;
            return;
        }

        // Mise à jour de l'opacité selon l'intensité
        this.rainMaterial.opacity = 0.4 + this.intensity * 0.3;

        // Obtenir la position de la voiture pour suivre
        let carPos = { x: 0, y: 0, z: 0 };
        if (this.app.car) {
            const carPosRapier = this.app.car.body.translation();
            carPos = { x: carPosRapier.x, y: carPosRapier.y, z: carPosRapier.z };
        }

        // Mise à jour des positions des gouttes
        const positions = this.rainGeometry.attributes.position.array;
        const spawnRange = 100;
        const heightRange = 80;

        for (let i = 0; i < this.rainCount; i++) {
            const i3 = i * 3;
            const velocity = this.rainVelocities[i];

            // Déplacer la goutte selon sa vélocité
            positions[i3] += velocity.x * deltaTime * this.intensity;
            positions[i3 + 1] += velocity.y * deltaTime * this.intensity;
            positions[i3 + 2] += velocity.z * deltaTime * this.intensity;

            // Si la goutte touche le sol, créer une éclaboussure et respawn
            if (positions[i3 + 1] < 0) {
                // Créer éclaboussure au sol
                if (Math.random() < 0.3 * this.intensity) { // 30% de chance avec intensité
                    this.createSplash(
                        positions[i3] + carPos.x,
                        0.1,
                        positions[i3 + 2] + carPos.z
                    );
                }

                // Respawn la goutte en haut
                positions[i3] = (Math.random() - 0.5) * spawnRange;
                positions[i3 + 1] = Math.random() * heightRange + 20;
                positions[i3 + 2] = (Math.random() - 0.5) * spawnRange;
            }

            // Garder les particules centrées autour de la voiture
            // Si trop loin, respawn
            const dx = positions[i3] - 0;
            const dz = positions[i3 + 2] - 0;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > spawnRange) {
                positions[i3] = (Math.random() - 0.5) * spawnRange;
                positions[i3 + 1] = Math.random() * heightRange + 20;
                positions[i3 + 2] = (Math.random() - 0.5) * spawnRange;
            }
        }

        // Positionner le système de pluie pour suivre la voiture
        this.rainParticles.position.set(carPos.x, 0, carPos.z);

        // Marquer pour mise à jour GPU
        this.rainGeometry.attributes.position.needsUpdate = true;

        // Mise à jour des éclaboussures
        this.updateSplashes(deltaTime);

        // Mise à jour des éclaboussures sur la voiture
        this.updateCarSplashes(deltaTime);

        // Créer des éclaboussures sur la voiture si elle bouge
        if (this.app.car && this.app.car.speed > 2) {
            if (Math.random() < 0.1 * this.intensity) {
                this.createCarSplash();
            }
        }
    }

    /**
     * Crée une éclaboussure au sol
     */
    createSplash(x, y, z) {
        // Réutiliser un splash du pool si disponible
        let splash = this.splashPool.pop();

        if (!splash) {
            // Créer un nouveau splash
            const geometry = new THREE.RingGeometry(0.1, 0.3, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xaaaaaa,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            splash = new THREE.Mesh(geometry, material);
            splash.rotation.x = -Math.PI / 2; // À plat sur le sol
        }

        splash.position.set(x, y, z);
        splash.scale.set(0.5, 0.5, 0.5);
        splash.material.opacity = 0.6;
        splash.userData = {
            life: 1.0,
            scale: 0.5,
            decay: 3.0 // Vitesse de disparition
        };

        this.app.scene.add(splash);
        this.splashes.push(splash);

        // Limiter le nombre d'éclaboussures
        if (this.splashes.length > this.maxSplashes) {
            const oldSplash = this.splashes.shift();
            this.app.scene.remove(oldSplash);
            this.splashPool.push(oldSplash);
        }
    }

    /**
     * Met à jour les éclaboussures au sol
     */
    updateSplashes(deltaTime) {
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const splash = this.splashes[i];
            const userData = splash.userData;

            // Expansion et fade out
            userData.scale += deltaTime * 2;
            userData.life -= userData.decay * deltaTime;

            splash.scale.set(userData.scale, userData.scale, userData.scale);
            splash.material.opacity = userData.life * 0.4;

            // Supprimer si mort
            if (userData.life <= 0) {
                this.app.scene.remove(splash);
                this.splashes.splice(i, 1);
                this.splashPool.push(splash);
            }
        }
    }

    /**
     * Crée une éclaboussure sur la voiture
     */
    createCarSplash() {
        if (!this.app.car) return;

        const carPos = this.app.car.body.translation();
        const carQuat = this.app.car.body.rotation();

        // Position aléatoire autour de la voiture
        const offset = {
            x: (Math.random() - 0.5) * 2,
            y: 0.5 + Math.random() * 1,
            z: (Math.random() - 0.5) * 2
        };

        // Créer des particules d'eau
        const particleCount = 5;
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: 0xaaaaaa,
                transparent: true,
                opacity: 0.7
            });
            const particle = new THREE.Mesh(geometry, material);

            particle.position.set(
                carPos.x + offset.x,
                carPos.y + offset.y,
                carPos.z + offset.z
            );

            // Vélocité de l'éclaboussure
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 3 + 2,
                (Math.random() - 0.5) * 5
            );

            particle.userData = {
                velocity: velocity,
                life: 1.0,
                decay: 2.0
            };

            this.carSplashes.push(particle);
            this.app.scene.add(particle);
        }

        // Limiter le nombre
        while (this.carSplashes.length > this.maxCarSplashes) {
            const old = this.carSplashes.shift();
            this.app.scene.remove(old);
            old.geometry.dispose();
            old.material.dispose();
        }
    }

    /**
     * Met à jour les éclaboussures sur la voiture
     */
    updateCarSplashes(deltaTime) {
        for (let i = this.carSplashes.length - 1; i >= 0; i--) {
            const splash = this.carSplashes[i];
            const userData = splash.userData;

            // Physique simple
            splash.position.add(userData.velocity.clone().multiplyScalar(deltaTime));
            userData.velocity.y -= 9.8 * deltaTime; // Gravité
            userData.life -= userData.decay * deltaTime;

            splash.material.opacity = userData.life * 0.7;

            // Supprimer si mort ou sous le sol
            if (userData.life <= 0 || splash.position.y < 0) {
                this.app.scene.remove(splash);
                splash.geometry.dispose();
                splash.material.dispose();
                this.carSplashes.splice(i, 1);
            }
        }
    }

    /**
     * Met à jour le brouillard selon l'état de la pluie
     */
    updateFog(enabled) {
        if (!this.app.scene.fog) {
            this.app.scene.fog = new THREE.FogExp2(0x87ceeb, this.baseFogDensity);
        }

        const targetDensity = enabled ? this.rainFogDensity : this.baseFogDensity;

        // Transition progressive (sera appliquée dans update())
        if (this.app.scene.fog) {
            this.app.scene.fog.density = targetDensity;
        }
    }

    /**
     * Crée l'interface utilisateur
     */
    createUI() {
        this.weatherIndicator = document.createElement('div');
        this.weatherIndicator.style.cssText = `
            position: fixed;
            bottom: 200px;
            right: 20px;
            z-index: 200;
            background: linear-gradient(135deg, rgba(70, 130, 180, 0.9), rgba(100, 160, 200, 0.9));
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            padding: 15px 20px;
            color: white;
            font-family: 'Segoe UI', sans-serif;
            font-weight: bold;
            display: none;
            box-shadow: 0 4px 20px rgba(70, 130, 180, 0.5);
        `;
        this.weatherIndicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🌧️</span>
                <div>
                    <div style="font-size: 12px; opacity: 0.8;">WEATHER</div>
                    <div style="font-size: 16px;">RAIN</div>
                </div>
                <div style="margin-left: 10px;">
                    <div style="font-size: 10px; opacity: 0.7;">INTENSITY</div>
                    <div id="rain-intensity" style="font-size: 18px; color: #4ecdc4;">50%</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.weatherIndicator);
    }

    /**
     * Affiche l'indicateur météo
     */
    showIndicator() {
        if (this.weatherIndicator) {
            this.weatherIndicator.style.display = 'block';
        }
    }

    /**
     * Masque l'indicateur météo
     */
    hideIndicator() {
        if (this.weatherIndicator) {
            this.weatherIndicator.style.display = 'none';
        }
    }

    /**
     * Met à jour l'indicateur avec l'intensité actuelle
     */
    updateIndicator() {
        const intensityElement = document.getElementById('rain-intensity');
        if (intensityElement) {
            intensityElement.textContent = Math.round(this.intensity * 100) + '%';
        }
    }

    /**
     * Nettoie les ressources
     */
    dispose() {
        // Supprimer les particules de pluie
        if (this.rainParticles) {
            this.app.scene.remove(this.rainParticles);
            this.rainGeometry.dispose();
            this.rainMaterial.dispose();
        }

        // Supprimer les éclaboussures
        this.splashes.forEach(splash => {
            this.app.scene.remove(splash);
            splash.geometry.dispose();
            splash.material.dispose();
        });

        this.carSplashes.forEach(splash => {
            this.app.scene.remove(splash);
            splash.geometry.dispose();
            splash.material.dispose();
        });

        // Supprimer l'UI
        if (this.weatherIndicator && this.weatherIndicator.parentNode) {
            document.body.removeChild(this.weatherIndicator);
        }
    }
}

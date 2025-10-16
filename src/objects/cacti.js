/**
 * Système de cactus pour le désert autour de Radiator Springs
 * Les cactus sont placés dans le désert, pas en ville ni sur les routes
 * Utilise un modèle GLB
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Cache du modèle de cactus
let cactusModelCache = null;
const loader = new GLTFLoader();

/**
 * Charge le modèle de cactus (une seule fois)
 */
async function loadCactusModel() {
    if (cactusModelCache) {
        return cactusModelCache.clone();
    }

    return new Promise((resolve, reject) => {
        loader.load(
            '/cactus.glb',
            (gltf) => {
                cactusModelCache = gltf.scene;
                console.log('🌵 Cactus GLB model loaded successfully');
                console.log('Cactus model info:', {
                    children: cactusModelCache.children.length,
                    scale: cactusModelCache.scale
                });
                resolve(cactusModelCache.clone());
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                if (percent % 25 === 0) {
                    console.log(`🌵 Loading cactus: ${percent}%`);
                }
            },
            (error) => {
                console.error('❌ Error loading cactus model:', error);
                reject(error);
            }
        );
    });
}

/**
 * Crée un cactus à partir du modèle GLB
 */
async function createCactus(scale = 1) {
    const cactusGroup = new THREE.Group();

    try {
        // Charger le modèle 3D
        const cactusModel = await loadCactusModel();

        // Configurer le modèle avec échelle augmentée pour visibilité
        const adjustedScale = scale * 50; // Multiplier par 50 pour qu'ils soient très visibles
        cactusModel.scale.set(adjustedScale, adjustedScale, adjustedScale);

        cactusModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        cactusGroup.add(cactusModel);

    } catch (error) {
        console.warn('⚠️ Failed to load cactus model, using fallback geometry');
        // Fallback: créer un cactus simple
        const cactusColor = 0x4a7c4e;
        const cactusMaterial = new THREE.MeshStandardMaterial({
            color: cactusColor,
            roughness: 0.9,
            metalness: 0.1
        });

        const trunkHeight = 3 * scale;
        const trunkRadius = 0.4 * scale;
        const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 0.9, trunkHeight, 8);
        const trunk = new THREE.Mesh(trunkGeometry, cactusMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        cactusGroup.add(trunk);
    }

    return cactusGroup;
}

/**
 * Vérifie si une position est sur une route
 * Routes: zone centrale entre -25 et +25 sur X et Z
 */
function isOnRoad(x, z) {
    // Route principale nord-sud: X entre -10 et +10
    const onNorthSouthRoad = Math.abs(x) < 10 && Math.abs(z) < 30;

    // Route est-ouest: Z entre -10 et +10
    const onEastWestRoad = Math.abs(z) < 10 && Math.abs(x) < 30;

    return onNorthSouthRoad || onEastWestRoad;
}

/**
 * Crée plusieurs cactus dans la scène
 * Placés dans le désert, évite les routes et la ville
 * @param {THREE.Scene} scene - La scène Three.js
 */
export async function createCacti(scene) {
    const cacti = [];

    // Zones de cactus - SEULEMENT dans le désert lointain (pas près de la ville ni des routes)
    const cactusAreas = [
        // Désert lointain (Nord) - au-delà de z > 40
        { x: -50, z: 60, count: 5, spread: 20 },
        { x: 0, z: 60, count: 4, spread: 15 },
        { x: 50, z: 60, count: 5, spread: 20 },

        // Désert lointain (Sud) - au-delà de z < -40
        { x: -50, z: -60, count: 5, spread: 20 },
        { x: 0, z: -60, count: 4, spread: 15 },
        { x: 50, z: -60, count: 5, spread: 20 },

        // Désert Est - au-delà de x > 40
        { x: 60, z: 0, count: 6, spread: 25 },
        { x: 70, z: 30, count: 4, spread: 15 },
        { x: 70, z: -30, count: 4, spread: 15 },

        // Désert Ouest - au-delà de x < -40
        { x: -60, z: 0, count: 6, spread: 25 },
        { x: -70, z: 30, count: 4, spread: 15 },
        { x: -70, z: -30, count: 4, spread: 15 }
    ];

    // Charger tous les cactus
    for (const area of cactusAreas) {
        for (let i = 0; i < area.count; i++) {
            // Position aléatoire dans la zone
            let offsetX, offsetZ, position;
            let attempts = 0;
            const maxAttempts = 10;

            // Essayer de trouver une position qui n'est pas sur une route
            do {
                offsetX = (Math.random() - 0.5) * area.spread;
                offsetZ = (Math.random() - 0.5) * area.spread;
                position = new THREE.Vector3(
                    area.x + offsetX,
                    0,
                    area.z + offsetZ
                );
                attempts++;
            } while (isOnRoad(position.x, position.z) && attempts < maxAttempts);

            // Si on est encore sur une route après maxAttempts, skip ce cactus
            if (isOnRoad(position.x, position.z)) {
                console.log(`🌵 Skipping cactus on road at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
                continue;
            }

            // Créer un cactus avec taille variable
            const scale = 0.8 + Math.random() * 0.4;
            const cactus = await createCactus(scale);

            cactus.position.copy(position);

            // Rotation aléatoire
            cactus.rotation.y = Math.random() * Math.PI * 2;

            // Légère inclinaison aléatoire pour naturel
            cactus.rotation.x = (Math.random() - 0.5) * 0.1;
            cactus.rotation.z = (Math.random() - 0.5) * 0.1;

            scene.add(cactus);
            cacti.push(cactus);
        }
    }

    console.log(`🌵 ${cacti.length} cacti planted in the desert (GLB model)`);

    return cacti;
}

/**
 * Animation des cactus (oscillation légère au vent)
 */
export function animateCacti(cacti, deltaTime) {
    if (!cacti || cacti.length === 0) return;

    const time = Date.now() * 0.0005;

    cacti.forEach((cactus, index) => {
        // Oscillation très légère au vent
        const windStrength = 0.02;
        const windSpeed = 0.5;
        const offset = index * 0.5; // Déphasage pour chaque cactus

        cactus.rotation.x = Math.sin(time * windSpeed + offset) * windStrength;
        cactus.rotation.z = Math.cos(time * windSpeed * 0.7 + offset) * windStrength;
    });
}

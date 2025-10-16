/**
 * Système de lampadaires pour Radiator Springs
 * Les lampadaires s'allument automatiquement la nuit
 * Utilise un modèle GLB
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Cache du modèle de lampadaire
let lampModelCache = null;
const loader = new GLTFLoader();

/**
 * Charge le modèle de lampadaire (une seule fois)
 */
async function loadLampModel() {
    if (lampModelCache) {
        return lampModelCache.clone();
    }

    return new Promise((resolve, reject) => {
        loader.load(
            '/lampadaire_stylise.glb',
            (gltf) => {
                lampModelCache = gltf.scene;
                console.log('💡 Street lamp GLB model loaded successfully');
                console.log('Lamp model info:', {
                    children: lampModelCache.children.length,
                    scale: lampModelCache.scale
                });
                resolve(lampModelCache.clone());
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                if (percent % 25 === 0) {
                    console.log(`💡 Loading lamp: ${percent}%`);
                }
            },
            (error) => {
                console.error('❌ Error loading lamp model:', error);
                reject(error);
            }
        );
    });
}

/**
 * Crée un lampadaire avec sa lumière
 */
async function createStreetLamp(position) {
    const lampGroup = new THREE.Group();

    try {
        // Charger le modèle 3D
        const lampModel = await loadLampModel();

        // Ajuster l'échelle du modèle (taille normale)
        lampModel.scale.set(1, 1, 1);

        // Configurer le modèle
        lampModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        lampGroup.add(lampModel);

        // Trouver la partie lumineuse du modèle (ou créer une sphère par défaut)
        let lampMesh = null;
        let lampPosition = new THREE.Vector3(0, 3.8, 0); // Position par défaut

        // Essayer de trouver un mesh nommé "Lamp" ou "Light" dans le modèle
        lampModel.traverse((child) => {
            if (child.isMesh && (child.name.toLowerCase().includes('lamp') ||
                                 child.name.toLowerCase().includes('light') ||
                                 child.name.toLowerCase().includes('bulb'))) {
                lampMesh = child;
                lampPosition.copy(child.position);
            }
        });

        // Si pas de mesh lumineux trouvé, créer une petite sphère émissive
        if (!lampMesh) {
            const lampGeometry = new THREE.SphereGeometry(0.2, 16, 16);
            const lampMaterial = new THREE.MeshStandardMaterial({
                color: 0xffdd88,
                emissive: 0xffdd88,
                emissiveIntensity: 0,
                metalness: 0.2,
                roughness: 0.1
            });
            lampMesh = new THREE.Mesh(lampGeometry, lampMaterial);
            lampMesh.position.copy(lampPosition);
            lampGroup.add(lampMesh);
        } else {
            // Modifier le matériau existant pour qu'il soit émissif
            if (lampMesh.material) {
                lampMesh.material.emissive = new THREE.Color(0xffdd88);
                lampMesh.material.emissiveIntensity = 0;
            }
        }

    } catch (error) {
        console.warn('⚠️ Failed to load lamp model, using fallback geometry');
        // Fallback: créer une géométrie simple
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.12, 4, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            metalness: 0.8,
            roughness: 0.3
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 2;
        pole.castShadow = true;
        lampGroup.add(pole);
    }

    // Point Light pour éclairer la scène
    const pointLight = new THREE.PointLight(0xffdd88, 0, 15, 2);
    pointLight.position.set(0, 3.8, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 512;
    pointLight.shadow.mapSize.height = 512;
    lampGroup.add(pointLight);

    // Halo lumineux (visible la nuit)
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd88,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 3.8, 0);
    glow.scale.set(1.5, 1.5, 1.5);
    lampGroup.add(glow);

    // Positionner le groupe
    lampGroup.position.copy(position);

    // Stocker les références pour l'animation
    lampGroup.userData = {
        pointLight: pointLight,
        glow: glow,
        glowMaterial: glowMaterial,
        isLit: false,
        targetIntensity: 0
    };

    return lampGroup;
}

/**
 * Crée plusieurs lampadaires dans la scène
 * Alignés d'un seul côté de la route principale dans la ville
 */
export async function createStreetLamps(scene) {
    const streetLamps = [];

    // Positions des lampadaires alignés d'un seul côté de la route nord-sud (ville)
    // Route nord-sud sur l'axe Z, lampadaires à l'est (X positif)
    const lampPositions = [
        // Route nord-sud - côté est (alignement régulier)
        new THREE.Vector3(3, 0, -20),
        new THREE.Vector3(3, 0, -13),
        new THREE.Vector3(3, 0, -6),
        new THREE.Vector3(3, 0, 1),
        new THREE.Vector3(3, 0, 8),
        new THREE.Vector3(3, 0, 15),
        new THREE.Vector3(3, 0, 22),

        // Quelques lampadaires aux intersections
        new THREE.Vector3(10, 0, -3),
        new THREE.Vector3(-4, 0, -3)
    ];

    // Créer chaque lampadaire (async)
    for (const position of lampPositions) {
        const lamp = await createStreetLamp(position);
        scene.add(lamp);
        streetLamps.push(lamp);
    }

    console.log(`💡 ${streetLamps.length} street lamps created along main road (GLB model)`);

    return streetLamps;
}

/**
 * Met à jour les lampadaires selon le cycle jour/nuit
 * @param {Array} streetLamps - Tableau des lampadaires
 * @param {number} timeOfDay - 0 = jour, 1 = nuit
 */
export function updateStreetLamps(streetLamps, timeOfDay) {
    if (!streetLamps || streetLamps.length === 0) return;

    // Calculer l'intensité cible (s'allument la nuit)
    // Commencent à s'allumer à partir de timeOfDay > 0.3
    const fadeStart = 0.3;
    const fadeEnd = 0.7;

    let targetIntensity = 0;
    if (timeOfDay > fadeEnd) {
        targetIntensity = 1;
    } else if (timeOfDay > fadeStart) {
        targetIntensity = (timeOfDay - fadeStart) / (fadeEnd - fadeStart);
    }

    // Mettre à jour chaque lampadaire
    streetLamps.forEach(lampGroup => {
        const userData = lampGroup.userData;

        // Interpolation douce de l'intensité
        const currentIntensity = userData.pointLight.intensity / 2; // Normaliser (max = 2)
        const newIntensity = currentIntensity + (targetIntensity - currentIntensity) * 0.1;

        // Point light
        userData.pointLight.intensity = newIntensity * 2;

        // Halo lumineux
        userData.glowMaterial.opacity = newIntensity * 0.4;

        // Trouver et mettre à jour les matériaux émissifs dans le modèle
        lampGroup.traverse((child) => {
            if (child.isMesh && child.material) {
                if (child.material.emissive) {
                    child.material.emissiveIntensity = newIntensity * 1.5;
                }
            }
        });

        // Animation de scintillement subtil quand allumé
        if (newIntensity > 0.1) {
            const flicker = 1 + Math.sin(Date.now() * 0.003 + lampGroup.position.x) * 0.02;
            userData.pointLight.intensity *= flicker;

            // Appliquer le scintillement aux matériaux émissifs
            lampGroup.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissiveIntensity *= flicker;
                }
            });
        }
    });
}

/**
 * Animation des lampadaires (à appeler chaque frame)
 */
export function animateStreetLamps(streetLamps, deltaTime) {
    if (!streetLamps || streetLamps.length === 0) return;

    const time = Date.now() * 0.001;

    streetLamps.forEach((lampGroup, index) => {
        // Légère oscillation du halo pour effet vivant
        const userData = lampGroup.userData;
        if (userData.glow && userData.pointLight.intensity > 0.1) {
            const scale = 1.5 + Math.sin(time * 2 + index) * 0.1;
            userData.glow.scale.set(scale, scale, scale);
        }
    });
}

/**
 * CHARGEMENT RADIATOR SPRINGS VIA MODÈLE GLB
 * Remplace la création manuelle par l'import d'un modèle 3D complet
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { logger } from './utils/logger.js';
import { ColliderHelper } from './physics/ColliderHelper.js';
import { optimizeModel } from './utils/textureOptimizer.js';

/**
 * Charge et ajoute le modèle 3D de Radiator Springs à la scène
 * @param {THREE.Scene} scene - La scène Three.js
 * @param {RAPIER.World} world - Le monde physique Rapier
 * @param {Object} objects - Objets de la scène
 * @param {THREE.WebGLRenderer} renderer - Le renderer (pour optimiser les textures)
 */
export function createRadiatorSpringsSVGLayout(scene, world, objects, renderer) {
    console.log('🏜️ Loading Radiator Springs 3D model...');

    // Retourner une Promise pour attendre le chargement
    return new Promise((resolve, reject) => {
        // Rapier: Créer un sol temporaire à Y=0 pendant le chargement
        const tempFloorWidth = 1000;
        const tempFloorDepth = 1000;
        const tempFloorHeight = 1;

        const tempFloorBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, 0, 0);
        const tempFloorBody = world.createRigidBody(tempFloorBodyDesc);

        const tempFloorColliderDesc = RAPIER.ColliderDesc.cuboid(
            tempFloorWidth / 2,
            tempFloorHeight / 2,
            tempFloorDepth / 2
        );
        world.createCollider(tempFloorColliderDesc, tempFloorBody);

        console.log('✅ Temporary floor created at Y=0 while loading model (Rapier)...');

        const loader = new GLTFLoader();

    loader.load(
        '/xbox360_cars_the_video_game_radiator_springs.glb',
        (gltf) => {
            console.log('✅ Radiator Springs model loaded successfully!');

            const model = gltf.scene;

            // Ajuster la position, l'échelle et la rotation si nécessaire
            model.position.set(0, 0, 0);
            model.scale.set(20, 20, 20); // Augmentation de l'échelle pour correspondre à la voiture

            // Activer les ombres et filtrer les meshes problématiques
            model.traverse((child) => {
                if (child.isMesh) {
                    // Filtrer les meshes noirs ou invisibles (probablement des colliders)
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        // Vérifier chaque matériau
                        let shouldHide = false;
                        materials.forEach(material => {
                            // Si le matériau est complètement noir (0x000000) ou très sombre
                            if (material.color) {
                                const colorHex = material.color.getHex();
                                if (colorHex === 0x000000 || colorHex < 0x0a0a0a) {
                                    shouldHide = true;
                                }
                            }
                            // Ou si c'est un matériau invisible/transparent sans texture
                            if (material.transparent && material.opacity < 0.1 && !material.map) {
                                shouldHide = true;
                            }
                        });

                        if (shouldHide) {
                            child.visible = false;
                            console.log('🚫 Hidden problematic mesh:', child.name || 'unnamed',
                                'position:', child.position.x.toFixed(2), child.position.y.toFixed(2), child.position.z.toFixed(2));
                            return;
                        }
                    }

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Optimiser les textures pour éviter les rayures et artifacts visuels
            console.error('🏜️ [RadiatorSprings] About to optimize textures, renderer:', !!renderer);
            if (renderer) {
                optimizeModel(model, renderer);
            } else {
                console.error('❌ [RadiatorSprings] Renderer non fourni, optimisation des textures ignorée');
            }

            scene.add(model);

            // IMPORTANT: Attendre que le modèle soit complètement ajouté à la scène
            // pour que les transformations soient correctement calculées
            model.updateMatrixWorld(true);

            // Utiliser le ColliderHelper pour créer automatiquement les colliders
            // MODE PRÉCIS: Colliders qui suivent EXACTEMENT la forme du modèle 3D
            const stats = ColliderHelper.createCollidersFromModel(model, world, {
                autoDetect: true,       // Détection intelligente (sol + murs uniquement)
                includeInvisible: false, // NE PAS capturer les meshes invisibles
                simplify: false,        // PAS de simplification = forme EXACTE du modèle
                verbose: true
            });

            // Créer un sol de sécurité avec le helper
            ColliderHelper.createSafetyFloor(world, {
                y: -0.25,  // Position pour que la voiture repose à Y=0.55
                width: 1000,
                depth: 1000,
                height: 0.5,
                friction: 0.8
            });

            // Retirer le sol temporaire
            console.log('🗑️ Removing temporary floor...');
            world.removeRigidBody(tempFloorBody);
            console.log('✅ Temporary floor removed!');
            console.log(`  🌍 Total bodies in physics world: ${world.bodies.len}`);

            // Résoudre la Promise (pas de matériau avec Rapier)
            resolve(null);
        },
        (progress) => {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            console.log(`Loading model: ${percent}%`);
        },
        (error) => {
            console.error('❌ Error loading Radiator Springs model:', error);
            reject(error);
        }
    );
    });
}

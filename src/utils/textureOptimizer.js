/**
 * Utilitaire pour optimiser les textures et éviter les artifacts visuels
 */

import * as THREE from 'three';

/**
 * Améliore la qualité d'une texture pour éviter les rayures et artifacts
 * @param {THREE.Texture} texture - La texture à optimiser
 * @param {THREE.WebGLRenderer} renderer - Le renderer pour obtenir l'anisotropie max
 */
export function optimizeTexture(texture, renderer) {
    if (!texture || !texture.isTexture) return;

    // Anisotropie maximale pour réduire les rayures sur les surfaces inclinées
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.anisotropy = maxAnisotropy;

    // Filtrage pour améliorer la qualité
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // S'assurer que les mipmaps sont générés
    texture.generateMipmaps = true;

    // Wrapping par défaut
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Forcer la mise à jour
    texture.needsUpdate = true;
}

/**
 * Optimise toutes les textures d'un matériau
 * @param {THREE.Material} material - Le matériau à optimiser
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 */
export function optimizeMaterial(material, renderer) {
    if (!material) return;

    // Liste des propriétés de texture courantes dans Three.js
    const textureProperties = [
        'map',              // Color map
        'normalMap',        // Normal map
        'roughnessMap',     // Roughness map
        'metalnessMap',     // Metalness map
        'aoMap',            // Ambient occlusion map
        'emissiveMap',      // Emissive map
        'bumpMap',          // Bump map
        'displacementMap',  // Displacement map
        'alphaMap',         // Alpha map
        'lightMap',         // Light map
        'envMap'            // Environment map
    ];

    // Optimiser chaque texture présente
    textureProperties.forEach(prop => {
        if (material[prop]) {
            optimizeTexture(material[prop], renderer);
        }
    });

    // Force la mise à jour du matériau
    material.needsUpdate = true;
}

/**
 * Optimise toutes les textures d'un modèle 3D
 * @param {THREE.Object3D} model - Le modèle 3D
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 */
export function optimizeModel(model, renderer) {
    if (!model || !renderer) {
        console.warn('⚠️ optimizeModel: model or renderer is missing');
        return;
    }

    let textureCount = 0;
    let materialCount = 0;

    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];

            materials.forEach(material => {
                optimizeMaterial(material, renderer);
                materialCount++;

                // Compter les textures
                const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
                textureProps.forEach(prop => {
                    if (material[prop]) textureCount++;
                });
            });
        }
    });

    console.log(`✅ Textures optimisées : ${textureCount} textures dans ${materialCount} matériaux`);
    console.log(`   → Anisotropie: ${renderer.capabilities.getMaxAnisotropy()}x`);
}

/**
 * Options pour améliorer la qualité visuelle globale du renderer
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 */
export function optimizeRenderer(renderer) {
    // Activer l'anti-aliasing si pas déjà fait
    // (Cela doit être fait lors de la création du renderer)

    // Encoding des couleurs pour un rendu plus réaliste
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Tone mapping pour un meilleur contraste
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Précision des ombres
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Ombres douces

    console.log('✅ Renderer optimisé pour une meilleure qualité visuelle');
}

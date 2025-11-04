/**
 * Module d'optimisation pour le chargement des textures et modèles GLTF
 * Corrige les bugs de textures et améliore la performance
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Créer un GLTFLoader optimisé avec support Draco
 * @returns {GLTFLoader} Loader configuré
 */
export function createOptimizedGLTFLoader() {
    const loader = new GLTFLoader();

    // Configurer le DRACOLoader pour les modèles compressés
    const dracoLoader = new DRACOLoader();
    // Utiliser les décodeurs depuis un CDN (pas besoin de fichiers locaux)
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    loader.setDRACOLoader(dracoLoader);

    return loader;
}

/**
 * Créer un TextureLoader optimisé
 * @returns {THREE.TextureLoader} Loader configuré
 */
export function createOptimizedTextureLoader() {
    const loader = new THREE.TextureLoader();

    // Gestionnaire d'erreurs pour éviter les crashs
    loader.manager.onError = (url) => {
        console.error(`❌ Erreur de chargement de texture: ${url}`);
    };

    return loader;
}

/**
 * Optimiser une texture après chargement
 * @param {THREE.Texture} texture - La texture à optimiser
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 */
export function optimizeLoadedTexture(texture, renderer) {
    if (!texture || !texture.isTexture) {
        return;
    }

    // Anisotropie maximale pour éviter les rayures
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.anisotropy = maxAnisotropy;

    // Filtrage trilinéaire pour qualité optimale
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Mipmaps
    texture.generateMipmaps = true;

    // Wrapping
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    // Color space correct
    if (texture.colorSpace === undefined) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    // Forcer la mise à jour
    texture.needsUpdate = true;

    console.log('✅ Texture optimized with', maxAnisotropy + 'x anisotropy');
}

/**
 * Charger une texture avec optimisation automatique
 * @param {string} url - URL de la texture
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 * @returns {Promise<THREE.Texture>} Promise de la texture optimisée
 */
export function loadOptimizedTexture(url, renderer) {
    return new Promise((resolve, reject) => {
        const loader = createOptimizedTextureLoader();

        loader.load(
            url,
            (texture) => {
                optimizeLoadedTexture(texture, renderer);
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error(`❌ Failed to load texture: ${url}`, error);
                reject(error);
            }
        );
    });
}

/**
 * Charger un modèle GLTF avec optimisation automatique des textures
 * @param {string} url - URL du modèle GLTF
 * @param {THREE.WebGLRenderer} renderer - Le renderer
 * @returns {Promise<any>} Promise du modèle chargé
 */
export function loadOptimizedGLTF(url, renderer) {
    return new Promise((resolve, reject) => {
        const loader = createOptimizedGLTFLoader();

        loader.load(
            url,
            (gltf) => {
                // Optimiser toutes les textures du modèle
                gltf.scene.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const materials = Array.isArray(child.material)
                            ? child.material
                            : [child.material];

                        materials.forEach(material => {
                            // Optimiser toutes les textures du matériau
                            const textureProps = [
                                'map', 'normalMap', 'roughnessMap',
                                'metalnessMap', 'aoMap', 'emissiveMap',
                                'bumpMap', 'displacementMap', 'alphaMap'
                            ];

                            textureProps.forEach(prop => {
                                if (material[prop]) {
                                    optimizeLoadedTexture(material[prop], renderer);
                                }
                            });
                        });
                    }
                });

                console.log('✅ GLTF model loaded and optimized:', url);
                resolve(gltf);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                console.log(`⏳ Loading ${url}: ${percent}%`);
            },
            (error) => {
                console.error(`❌ Failed to load GLTF: ${url}`, error);
                reject(error);
            }
        );
    });
}

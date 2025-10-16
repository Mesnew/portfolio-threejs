/**
 * ColliderHelper - Utilitaires pour créer automatiquement des colliders physiques
 * à partir de modèles 3D Three.js
 */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class ColliderHelper {
    /**
     * Types de colliders disponibles
     */
    static ColliderType = {
        AUTO: 'auto',           // Détection automatique
        GROUND: 'ground',       // Surface de route/sol
        WALL: 'wall',          // Mur/barrière
        BUILDING: 'building',   // Bâtiment (pas de collider)
        DECORATION: 'decoration' // Décoration (pas de collider)
    };

    /**
     * Configurations par défaut pour chaque type
     */
    static DefaultConfig = {
        ground: {
            friction: 0.8,
            restitution: 0.0,
            createCollider: true,
            minTriangles: 3,     // ULTRA permissif - capturer quasiment tout
            maxHeight: 15.0,     // Augmenté pour capturer plus de surfaces
            maxCenterY: 40       // Très permissif pour routes en hauteur
        },
        wall: {
            friction: 0.5,
            restitution: 0.1,
            createCollider: true,
            minTriangles: 3,     // ULTRA permissif
            maxHeight: 50,
            maxCenterY: 50
        },
        building: {
            createCollider: false
        },
        decoration: {
            createCollider: false
        }
    };

    /**
     * Crée automatiquement des colliders pour tous les meshes d'un modèle
     * @param {THREE.Object3D} model - Le modèle 3D chargé
     * @param {RAPIER.World} world - Le monde physique Rapier
     * @param {Object} options - Options de configuration
     * @returns {Object} Statistiques de création
     */
    static createCollidersFromModel(model, world, options = {}) {
        const config = {
            autoDetect: true,
            filterType: null,
            verbose: true,
            includeInvisible: false,  // Créer colliders même pour meshes invisibles
            forceAll: false,  // Force la création de colliders pour TOUS les meshes (ignore tous les critères)
            simplify: true,   // Simplifier les géométries pour meilleures performances
            maxTrianglesPerCollider: 1000,  // Limiter le nombre de triangles par collider
            mergeThreshold: 5.0,  // Distance pour fusionner les meshes proches
            ...options
        };

        const stats = {
            total: 0,
            created: 0,
            skipped: 0,
            vertices: 0,
            triangles: 0,
            types: {}
        };

        console.log('🔧 ColliderHelper: Creating colliders from model...');

        // Assurer que les transformations sont à jour
        model.updateMatrixWorld(true);

        // OPTIMISATION: Créer un seul RigidBody pour tous les colliders statiques
        // Cela réduit drastiquement la charge CPU de Rapier
        const sharedBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        console.log('✨ OPTIMIZATION: Using single shared RigidBody for all static colliders');

        // Parcourir tous les meshes
        model.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;

            // Ignorer les meshes invisibles SAUF si includeInvisible est activé
            if (!child.visible && !config.includeInvisible) {
                stats.skipped++;
                return;
            }

            stats.total++;

            // MODE FORCE ALL: Créer colliders pour TOUS les meshes sans aucun filtrage
            if (config.forceAll) {
                const result = this.createColliderForMesh(child, world, 'ground', config.verbose, true, {
                    simplify: config.simplify,
                    maxTrianglesPerCollider: config.maxTrianglesPerCollider,
                    sharedBody: sharedBody  // OPTIMISATION: Partager le même body
                });

                if (result.created) {
                    stats.created++;
                    stats.vertices += result.vertices;
                    stats.triangles += result.triangles;
                    stats.types['ground'] = (stats.types['ground'] || 0) + 1;
                } else {
                    stats.skipped++;
                }
                return;
            }

            // MODE NORMAL: Déterminer le type de collider
            const type = config.autoDetect
                ? this.detectColliderType(child)
                : (config.filterType || ColliderHelper.ColliderType.AUTO);

            // Filtrer si nécessaire
            if (config.filterType && type !== config.filterType) {
                stats.skipped++;
                return;
            }

            // Créer le collider si nécessaire
            const result = this.createColliderForMesh(child, world, type, config.verbose, false, {
                simplify: config.simplify,
                maxTrianglesPerCollider: config.maxTrianglesPerCollider,
                sharedBody: sharedBody  // OPTIMISATION: Partager le même body
            });

            if (result.created) {
                stats.created++;
                stats.vertices += result.vertices;
                stats.triangles += result.triangles;
                stats.types[type] = (stats.types[type] || 0) + 1;
            } else {
                stats.skipped++;
                if (config.verbose) {
                    console.log(`  ⏭️ Skipped [${type}]: ${child.name || 'unnamed'} - Reason: ${result.reason}`);
                }
            }
        });

        console.log(`✅ ColliderHelper: Created ${stats.created}/${stats.total} colliders`);
        console.log(`   - Vertices: ${stats.vertices.toLocaleString()}, Triangles: ${stats.triangles.toLocaleString()}`);
        console.log(`   - By type:`, stats.types);

        return stats;
    }

    /**
     * Détecte automatiquement le type de collider approprié pour un mesh
     * @param {THREE.Mesh} mesh - Le mesh à analyser
     * @returns {string} Type de collider détecté
     */
    static detectColliderType(mesh) {
        const geometry = mesh.geometry;

        // Calculer bounding box si nécessaire
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        const bbox = geometry.boundingBox;

        // Obtenir position mondiale
        mesh.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3();
        worldPos.setFromMatrixPosition(mesh.matrixWorld);

        // Calculer dimensions
        const height = Math.abs(bbox.max.y - bbox.min.y);
        const centerY = worldPos.y + (bbox.max.y + bbox.min.y) / 2;
        const width = Math.abs(bbox.max.x - bbox.min.x);
        const depth = Math.abs(bbox.max.z - bbox.min.z);

        // Compter triangles
        const triangleCount = geometry.index
            ? geometry.index.count / 3
            : geometry.attributes.position.count / 3;

        // Règles de détection ULTRA PERMISSIVES pour capturer TOUTES les routes

        // Bâtiments: SEULEMENT les TRÈS TRÈS hauts et très éloignés
        if (height > 30 || centerY > 40) {
            return ColliderHelper.ColliderType.BUILDING;
        }

        // Décorations: SEULEMENT les minuscules (< 3 triangles)
        if (triangleCount < 3) {
            return ColliderHelper.ColliderType.DECORATION;
        }

        // Murs: seulement si TRÈS hauts ET TRÈS étroits
        if (height > 15 && height < 30) {
            const isNarrow = (width < 1.5 || depth < 1.5);
            if (isNarrow) {
                return ColliderHelper.ColliderType.WALL;
            }
        }

        // Sol/Route: ACCEPTER TOUT ce qui n'est pas explicitement un bâtiment
        // Si c'est proche du sol (Y < 35) et a au moins 3 triangles = GROUND
        return ColliderHelper.ColliderType.GROUND;
    }

    /**
     * Simplifie une géométrie en réduisant le nombre de triangles
     * @param {Float32Array} vertices - Vertices originaux
     * @param {Uint32Array} indices - Indices originaux
     * @param {number} maxTriangles - Nombre max de triangles
     * @returns {Object} Vertices et indices simplifiés
     */
    static simplifyGeometry(vertices, indices, maxTriangles) {
        const triangleCount = indices.length / 3;

        if (triangleCount <= maxTriangles) {
            return { vertices, indices };
        }

        // SIMPLIFICATION MOINS AGRESSIVE pour éviter les artefacts (murs invisibles)
        let targetTriangles = maxTriangles;
        if (triangleCount > 3000) {
            // Ne pas trop simplifier les gros meshes (garder 50% minimum)
            targetTriangles = Math.max(Math.floor(triangleCount * 0.5), maxTriangles);
        }

        // S'assurer de ne pas descendre sous 50 triangles (trop peu = artefacts)
        targetTriangles = Math.max(targetTriangles, 50);

        // Simplification par échantillonnage uniforme avec seed déterministe
        const ratio = targetTriangles / triangleCount;
        const newIndices = [];
        const step = Math.max(1, Math.floor(1 / ratio));

        // Échantillonnage régulier plutôt qu'aléatoire pour de meilleurs résultats
        for (let i = 0; i < indices.length; i += step * 3) {
            if (newIndices.length / 3 >= targetTriangles) break;
            if (i + 2 < indices.length) {
                newIndices.push(indices[i], indices[i + 1], indices[i + 2]);
            }
        }

        // Si on n'a pas assez de triangles, garder l'original
        if (newIndices.length < 150) { // Au moins 50 triangles
            return { vertices, indices };
        }

        return {
            vertices,
            indices: new Uint32Array(newIndices)
        };
    }

    /**
     * Crée un collider Trimesh pour un mesh donné
     * @param {THREE.Mesh} mesh - Le mesh source
     * @param {RAPIER.World} world - Le monde physique
     * @param {string} type - Type de collider
     * @param {boolean} verbose - Afficher les logs
     * @param {boolean} forceCreate - Forcer la création
     * @param {Object} options - Options supplémentaires
     * @returns {Object} Résultat de la création
     */
    static createColliderForMesh(mesh, world, type, verbose = false, forceCreate = false, options = {}) {
        const config = this.DefaultConfig[type];

        // En mode force, on ignore la vérification du type
        if (!forceCreate && (!config || !config.createCollider)) {
            return { created: false, reason: 'Type does not create colliders' };
        }

        const geometry = mesh.geometry;
        const bufferGeometry = geometry.isBufferGeometry
            ? geometry
            : new THREE.BufferGeometry().fromGeometry(geometry);

        const positionAttribute = bufferGeometry.getAttribute('position');
        if (!positionAttribute) {
            return { created: false, reason: 'No position attribute' };
        }

        // Extraire vertices et indices
        const vertices = new Float32Array(positionAttribute.array);
        let indices;

        if (bufferGeometry.index) {
            indices = new Uint32Array(bufferGeometry.index.array);
        } else {
            const vertexCount = vertices.length / 3;
            indices = new Uint32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) {
                indices[i] = i;
            }
        }

        let triangleCount = indices.length / 3;
        const originalTriangleCount = triangleCount;

        // Vérifier taille minimale SAUF en mode force
        if (!forceCreate && config && triangleCount < config.minTriangles) {
            return { created: false, reason: `Too few triangles (${triangleCount})` };
        }

        // OPTIMISATION: Simplifier la géométrie si demandé
        if (options.simplify && options.maxTrianglesPerCollider && triangleCount > options.maxTrianglesPerCollider) {
            const simplified = this.simplifyGeometry(vertices, indices, options.maxTrianglesPerCollider);
            indices = simplified.indices;
            triangleCount = indices.length / 3;

            if (verbose) {
                console.log(`  🔧 Simplified: ${originalTriangleCount} → ${triangleCount} triangles`);
            }
        }

        // Appliquer transformations du mesh
        mesh.updateWorldMatrix(true, false);
        const worldMatrix = mesh.matrixWorld;

        const transformedVertices = new Float32Array(vertices.length);
        const vertex = new THREE.Vector3();

        for (let i = 0; i < vertices.length; i += 3) {
            vertex.set(vertices[i], vertices[i + 1], vertices[i + 2]);
            vertex.applyMatrix4(worldMatrix);
            transformedVertices[i] = vertex.x;
            transformedVertices[i + 1] = vertex.y;
            transformedVertices[i + 2] = vertex.z;
        }

        // Créer le Trimesh collider
        try {
            // Utiliser config si disponible, sinon valeurs par défaut (mode force)
            const restitution = config ? config.restitution : 0.0;
            const friction = config ? config.friction : 0.8;

            const trimeshDesc = RAPIER.ColliderDesc.trimesh(transformedVertices, indices)
                .setRestitution(restitution)
                .setFriction(friction);

            // OPTIMISATION: Utiliser le shared body si fourni, sinon créer un nouveau
            const trimeshBody = options.sharedBody || world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
            world.createCollider(trimeshDesc, trimeshBody);

            if (verbose) {
                console.log(`  ✅ Collider created [${type}]: ${mesh.name || 'unnamed'} (${triangleCount} triangles)`);
            }

            return {
                created: true,
                vertices: transformedVertices.length / 3,
                triangles: triangleCount,
                type: type
            };
        } catch (error) {
            console.error(`  ❌ Error creating collider for ${mesh.name}:`, error);
            return { created: false, reason: error.message };
        }
    }

    /**
     * Visualise les colliders créés (pour debug)
     * @param {THREE.Scene} scene - La scène Three.js
     * @param {RAPIER.World} world - Le monde physique
     * @param {Object} options - Options de visualisation
     */
    static visualizeColliders(scene, world, options = {}) {
        const config = {
            color: 0x00ff00,
            opacity: 0.3,
            wireframe: true,
            ...options
        };

        console.log('🔍 Visualizing colliders...');

        const material = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: config.opacity,
            wireframe: config.wireframe,
            side: THREE.DoubleSide
        });

        let count = 0;

        // Parcourir tous les colliders
        world.forEachCollider((collider) => {
            const shape = collider.shape;

            // Gérer différents types de shapes
            if (shape.type === RAPIER.ShapeType.Cuboid) {
                const halfExtents = shape.halfExtents;
                const geometry = new THREE.BoxGeometry(
                    halfExtents.x * 2,
                    halfExtents.y * 2,
                    halfExtents.z * 2
                );

                const mesh = new THREE.Mesh(geometry, material);
                const parent = collider.parent();
                const pos = parent.translation();
                const rot = parent.rotation();

                mesh.position.set(pos.x, pos.y, pos.z);
                mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
                mesh.userData.isDebugCollider = true;

                scene.add(mesh);
                count++;
            }
            // Note: Trimesh visualization would be complex, skip for now
        });

        console.log(`✅ Visualized ${count} colliders`);
    }

    /**
     * Retire la visualisation des colliders
     * @param {THREE.Scene} scene - La scène Three.js
     */
    static removeColliderVisualization(scene) {
        const toRemove = [];
        scene.traverse((obj) => {
            if (obj.userData.isDebugCollider) {
                toRemove.push(obj);
            }
        });

        toRemove.forEach((obj) => {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });

        console.log(`🗑️ Removed ${toRemove.length} debug colliders`);
    }

    /**
     * Crée un sol de sécurité simple
     * @param {RAPIER.World} world - Le monde physique
     * @param {Object} options - Options (position, size, friction, etc.)
     */
    static createSafetyFloor(world, options = {}) {
        const config = {
            y: -0.25,
            width: 1000,
            height: 0.5,
            depth: 1000,
            friction: 0.8,
            restitution: 0.0,
            ...options
        };

        console.log(`🛡️ ColliderHelper: Creating safety floor at Y=${config.y}...`);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, config.y, 0);
        const body = world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            config.width / 2,
            config.height / 2,
            config.depth / 2
        )
        .setRestitution(config.restitution)
        .setFriction(config.friction);

        world.createCollider(colliderDesc, body);

        console.log('✅ Safety floor created!');

        return body;
    }
}

/**
 * Helper pour créer un système de composants physiques
 */
export class PhysicsComponentSystem {
    constructor(world) {
        this.world = world;
        this.components = new Map();
    }

    /**
     * Ajoute un composant physique à un objet
     */
    addComponent(object, config) {
        const component = {
            object,
            body: null,
            collider: null,
            config
        };

        // Créer le rigid body
        const bodyDesc = config.dynamic
            ? RAPIER.RigidBodyDesc.dynamic()
            : RAPIER.RigidBodyDesc.fixed();

        if (config.position) {
            bodyDesc.setTranslation(config.position.x, config.position.y, config.position.z);
        }

        component.body = this.world.createRigidBody(bodyDesc);

        // Créer le collider selon le type
        if (config.shape === 'box') {
            const colliderDesc = RAPIER.ColliderDesc.cuboid(
                config.size.x / 2,
                config.size.y / 2,
                config.size.z / 2
            );
            component.collider = this.world.createCollider(colliderDesc, component.body);
        }
        // Ajouter d'autres formes au besoin...

        this.components.set(object.uuid, component);
        return component;
    }

    /**
     * Met à jour tous les composants
     */
    update() {
        this.components.forEach((component) => {
            if (component.config.dynamic && component.object && component.body) {
                const pos = component.body.translation();
                const rot = component.body.rotation();

                component.object.position.set(pos.x, pos.y, pos.z);
                component.object.quaternion.set(rot.x, rot.y, rot.z, rot.w);
            }
        });
    }

    /**
     * Supprime un composant
     */
    removeComponent(object) {
        const component = this.components.get(object.uuid);
        if (component) {
            this.world.removeRigidBody(component.body);
            this.components.delete(object.uuid);
        }
    }
}

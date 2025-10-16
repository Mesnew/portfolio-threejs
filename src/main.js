import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { logger } from './utils/logger.js';
import { disableConsoleInProduction } from './utils/disableConsole.js';
import {
    toRapierVector,
    toThreeVector,
    toRapierRotation,
    toThreeQuaternion,
    getYRotationFromQuaternion,
    quaternionFromYRotation,
    rotateVectorByQuaternion
} from './utils/rapierHelper.js';
import { createPostProcessing, updatePostProcessingBySpeed } from './effects/postProcessing.js';
import { chromeShader, glowShader } from './shaders/carShader.js';
import { DayNightCycle } from './utils/dayNightCycle.js';
import { createStreetLamps, updateStreetLamps, animateStreetLamps } from './objects/streetLamps.js';
import { createCacti, animateCacti } from './objects/cacti.js';

// Radiator Springs Layout
import { RadiatorSpringsLayout } from './radiatorSpringsLayout.js';

// NOUVEAU LAYOUT basé sur le schéma SVG
import {
    createRadiatorSpringsSVGLayout
} from './radiatorSpringsNew.js';
import { ColliderHelper } from './physics/ColliderHelper.js';
import { loadingManager } from './utils/loadingManager.js';
import { initSentry, logError, setContext } from './utils/monitoring.js';
import { initAnalytics, GameAnalytics } from './utils/analytics.js';
import { initVisitorTracking, VisitorTracking } from './utils/visitorTracking.js';
import { optimizeModel } from './utils/textureOptimizer.js';

// Initialiser le monitoring des erreurs (Sentry)
initSentry();

// Initialiser l'analytique (Plausible)
initAnalytics();

// Initialiser le tracking des visiteurs
initVisitorTracking();

// Désactiver console.log en production pour les performances
disableConsoleInProduction();

logger.info('Starting Portfolio 3D app...');

class Portfolio3D {
    constructor() {
        this.clock = new THREE.Clock();
        this.objects = [];
        this.world = null;
        this.car = null;
        this.keys = {};
        this.cameraTarget = new THREE.Vector3();
        this.particles = [];
        this.interactiveZones = [];
        this.currentZone = null;
        this.font = null;
        this.speedLines = [];
        this.exhaustSmoke = [];
        this.fps = 60;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.collectibles = [];
        this.score = 0;

        // Système audio
        this.audioContext = null;
        this.engineOscillator = null;
        this.engineGain = null;
        this.engineFilter = null;

        // Mini-map
        this.minimapCanvas = null;
        this.minimapCtx = null;

        // Zone du garage
        this.garageZone = null;
        this.inGarage = false;

        // Système de turbo/boost
        this.boostActive = false;
        this.boostEnergy = 100;
        this.boostMaxEnergy = 100;
        this.boostRechargeRate = 10; // par seconde
        this.boostDrainRate = 30; // par seconde
        this.boostMultiplier = 2.5;
        this.boostParticles = [];
        this.boostTrails = [];

        // Système d'achievements
        this.achievements = {
            speedDemon: { unlocked: false, name: "Speed Demon", desc: "Atteindre 150 km/h" },
            collector: { unlocked: false, name: "Collector", desc: "Ramasser 10 étoiles" },
            explorer: { unlocked: false, name: "Explorer", desc: "Visiter toutes les zones" },
            customizer: { unlocked: false, name: "Customizer", desc: "Personnaliser la voiture" },
            boostMaster: { unlocked: false, name: "Boost Master", desc: "Utiliser le boost 20 fois" },
        };
        this.achievementNotifications = [];
        this.boostUseCount = 0;
        this.visitedZones = new Set();

        // Accumulateur pour fixed timestep
        this.timeAccumulator = 0;
        this.fixedTimeStep = 1 / 60; // 60 FPS

        // Contrôle de la caméra
        this.cameraManualControl = false;
        this.cameraAutoTimeout = null;
        this.cameraAutoDelay = 3000; // Retour en mode auto après 3 secondes d'inactivité

        // Post-processing
        this.composer = null;
        this.postProcessingEnabled = true;

        // Day/Night cycle
        this.dayNightCycle = null;

        // Street lamps
        this.streetLamps = [];

        // Cacti
        this.cacti = [];

        // Debug colliders
        this.showColliders = false;

        this.init();
    }

    async init() {
        console.log('Initializing...');
        loadingManager.setStatus('init');

        try {
            // Initialiser Rapier (async - requis avant toute utilisation)
            loadingManager.updateProgress(0.05, 'rapier');
            await RAPIER.init();
            console.log('✅ Rapier initialized');

            loadingManager.updateProgress(0.10, 'init');
            this.createScene();
            this.createPhysicsWorld();
            this.createCamera();
            this.createRenderer();
            this.createControls();

            // NOUVEAU LAYOUT RADIATOR SPRINGS basé sur le schéma SVG
            console.log('🏜️ Creating Radiator Springs from SVG layout...');
            loadingManager.updateProgress(0.20, 'world');

            // Chargement du modèle 3D complet de Radiator Springs
            // IMPORTANT: Attendre que le modèle soit chargé AVANT de créer la voiture
            console.log('⏳ Waiting for Radiator Springs model to load...');
            this.floorMaterial = await createRadiatorSpringsSVGLayout(this.scene, this.world, this.objects, this.renderer);
            console.log('✅ Model loaded, creating car...');

            loadingManager.updateProgress(0.60, 'car');
            this.createCar();
            this.addEventListeners();
            this.initMinimap();
            this.loadAchievements();

            // Initialiser le post-processing
            loadingManager.updateProgress(0.70, 'postfx');
            this.initPostProcessing();

            // Créer les lampadaires (async)
            console.log('⏳ Loading street lamps...');
            loadingManager.updateProgress(0.80, 'lamps');
            this.streetLamps = await createStreetLamps(this.scene);

            // Créer les cactus dans le désert (async)
            console.log('⏳ Loading cacti...');
            loadingManager.updateProgress(0.90, 'cacti');
            this.cacti = await createCacti(this.scene);

            // Hide loading with animation
            loadingManager.updateProgress(1.0, 'complete');
            loadingManager.hide();

            // Track game start
            GameAnalytics.gameStart();

            // Start animation loop FIRST
            this.animate();
            console.log('App initialized successfully! Animation started.');

            // Font loading removed - no interactive zones needed

        } catch (error) {
            console.error('Initialization error:', error);
            loadingManager.showError(error.message);
        }
    }


    createScene() {
        this.scene = new THREE.Scene();
        // Background et fog seront gérés par le cycle jour/nuit
        console.log('Scene created');
    }

    createPhysicsWorld() {
        // Créer le monde physique Rapier avec gravité augmentée
        const gravity = { x: 0.0, y: -25.0, z: 0.0 };  // Gravité augmentée pour sensation plus réaliste
        this.world = new RAPIER.World(gravity);

        console.log('✅ Rapier physics world created (gravity: -25.0)');
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);
        console.log('Camera created at:', this.camera.position);
    }

    createRenderer() {
        // Détecter les appareils bas de gamme
        const isLowEnd = window.devicePixelRatio < 2 ||
                        (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);

        this.renderer = new THREE.WebGLRenderer({
            antialias: !isLowEnd, // Désactiver antialias sur appareils bas de gamme
            powerPreference: 'high-performance' // Force GPU
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Limiter pixel ratio à 1.5 pour les performances
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowEnd ? 1 : 1.5));
        this.renderer.shadowMap.enabled = !isLowEnd; // Désactiver shadows sur appareils bas de gamme
        if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.type = THREE.BasicShadowMap; // Plus rapide que PCFSoft
        }

        const container = document.getElementById('canvas-container');
        container.appendChild(this.renderer.domElement);
        console.log('Renderer created (low-end mode:', isLowEnd, ')');
    }

    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0);

        // Désactiver les contrôles par défaut (seront activés en mode manuel)
        this.controls.enabled = false;

        // Limites de rotation pour éviter de se retrouver sous le sol
        this.controls.minPolarAngle = 0; // Angle minimum (vertical)
        this.controls.maxPolarAngle = Math.PI / 2 + 0.3; // Angle maximum (ne peut pas aller sous l'horizon)

        // Limites de zoom
        this.controls.minDistance = 3;
        this.controls.maxDistance = 50;

        // Ajouter des événements pour détecter l'utilisation des contrôles
        this.controls.addEventListener('start', () => {
            this.enableManualCamera();
        });

        this.controls.addEventListener('change', () => {
            if (this.cameraManualControl) {
                // Réinitialiser le timer d'auto-retour
                this.resetCameraAutoTimeout();
            }
        });

        console.log('Controls created (manual mode with right-click)');
    }

    initPostProcessing() {
        try {
            // Créer le post-processing avec des effets optimisés
            const postProcessing = createPostProcessing(this.renderer, this.scene, this.camera, {
                enableBloom: true,
                enableVignette: true,
                enableColorGrading: true,
                enableSharpen: false,
                bloomStrength: 0.6,
                bloomRadius: 0.4,
                bloomThreshold: 0.85
            });

            this.composer = postProcessing.composer;
            console.log('✨ Post-processing initialized with bloom, vignette, and color grading');

            // Initialiser le cycle jour/nuit
            this.initDayNightCycle();
        } catch (error) {
            console.warn('⚠️ Post-processing failed to initialize, using standard rendering:', error);
            this.postProcessingEnabled = false;
        }
    }

    initDayNightCycle() {
        // Créer le système de cycle jour/nuit
        this.dayNightCycle = new DayNightCycle(this.scene, this.renderer);

        // Initialiser les lumières
        this.dayNightCycle.setupLights();

        // Passer le composer pour le post-processing
        if (this.composer) {
            this.dayNightCycle.setComposer(this.composer);
        }

        console.log('🌓 Day/Night cycle system initialized');
    }




















    createCar() {
        console.log('Creating Lightning McQueen car from GLB model...');

        // Échelle de la voiture
        const carScale = 0.5;

        // Groupe pour la voiture complète
        const carGroup = new THREE.Group();
        carGroup.position.set(0, 3, 0);
        this.scene.add(carGroup);

        // Charger le modèle Lightning McQueen
        const loader = new GLTFLoader();
        loader.load(
            '/lightning_mcqueen_cars_3.glb',
            (gltf) => {
                console.log('✅ Lightning McQueen model loaded successfully!');

                const mcqueenModel = gltf.scene;

                // Ajuster l'échelle et la position
                mcqueenModel.scale.set(carScale, carScale, carScale);
                mcqueenModel.position.set(0, -0.75, 0); // Ajuster la hauteur pour aligner avec le corps physique

                // Activer les ombres pour tous les meshes
                mcqueenModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                // Optimiser les textures pour éviter les rayures et artifacts visuels
                console.error('🏎️ [McQueen] About to optimize textures, renderer:', !!this.renderer);
                if (this.renderer) {
                    optimizeModel(mcqueenModel, this.renderer);
                } else {
                    console.error('❌ [McQueen] Renderer non fourni, optimisation des textures ignorée');
                }

                // Ajouter le modèle au groupe de la voiture
                carGroup.add(mcqueenModel);

                console.log('🏎️ Lightning McQueen added to car group');
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                console.log(`Loading McQueen: ${percent}%`);
            },
            (error) => {
                console.error('❌ Error loading Lightning McQueen model:', error);
            }
        );

        console.log('Car mesh added to scene at:', carGroup.position);

        // Physics body matching visual size (dimensions réduites avec carScale)
        // Rapier: Create box collider
        const halfWidth = 1 * carScale;
        const halfHeight = 0.55;  // Hauteur totale = 1.1 (0.55 * 2)
        const halfDepth = 1.5 * carScale;
        const carColliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
            .setRestitution(0.0)  // Pas de rebond
            .setFriction(0.3)     // Augmenté de 0.0 à 0.3 pour meilleure adhérence
            .setDensity(2.0);     // Densité augmentée pour voiture plus lourde

        // Position de départ à l'entrée de Radiator Springs
        const startPos = RadiatorSpringsLayout.playerStart.position;
        const startRotation = RadiatorSpringsLayout.playerStart.rotation;

        // Créer le RigidBody Rapier avec rotation initiale
        const carBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(startPos.x, startPos.y, startPos.z)
            .setRotation(quaternionFromYRotation(startRotation.y))
            .setLinearDamping(0.3)    // Augmenté pour plus de contrôle (0.05 -> 0.3)
            .setAngularDamping(1.5)   // Augmenté pour meilleure stabilité (0.9 -> 1.5)
            .setCanSleep(false);      // Empêcher le sommeil

        const carBody = this.world.createRigidBody(carBodyDesc);
        this.world.createCollider(carColliderDesc, carBody);

        // Empêcher le basculement: Lock rotations sur X et Z
        carBody.lockRotations(false, false); // Par défaut pas de lock
        carBody.setEnabledRotations(false, true, false, true); // Only Y rotation enabled

        console.log('🚗 Car physics initialized (Rapier):');
        console.log('  - Position:', carBody.translation().x, carBody.translation().y, carBody.translation().z);
        console.log('  - Mass:', carBody.mass());
        console.log('  - Gravity:', this.world.gravity.y);
        console.log('  - CanSleep:', !carBody.isSleeping());
        console.log('  - Type:', carBody.isDynamic() ? 'DYNAMIC' : 'STATIC');
        console.log('  - LinearDamping:', carBody.linearDamping());
        console.log('  - AngularDamping:', carBody.angularDamping());
        console.log('  - Bodies in world:', this.world.bodies.len);

        console.log('Car body added to physics world');

        this.car = {
            mesh: carGroup,
            body: carBody,
            speed: 0,
            maxSpeed: 35,            // Augmenté de 25 à 35 pour plus de vitesse
            acceleration: 0,
            steering: 0,
            maxSteering: 0.05,       // Augmenté de 0.04 à 0.05 pour meilleure maniabilité
            driftParticles: [],
            wheels: [], // Sera rempli après le chargement du modèle si nécessaire
            headlights: [] // Pas de phares pour l'instant avec le modèle GLB
        };
        this.objects.push(this.car);

        console.log('Car created successfully! Total objects:', this.objects.length);
        console.log('Scene children count:', this.scene.children.length);
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());

        // Contrôles clavier
        window.addEventListener('keydown', (event) => {
            const wasPressed = this.keys[event.code];
            this.keys[event.code] = true;

            // Son de freinage au premier appui sur Espace
            if (event.code === 'Space' && !wasPressed && this.car && this.car.speed > 5) {
                this.playBrakeSound();
            }

            // Close zone content with Enter
            if (event.code === 'Enter' && this.currentZone) {
                this.hideZoneContent();
            }

            // Touche 'C' pour revenir en mode caméra automatique
            if (event.code === 'KeyC') {
                this.disableManualCamera();
                console.log('📷 Camera: Auto mode (following car)');
            }

            // Touche 'N' pour basculer jour/nuit
            if (event.code === 'KeyN' && this.dayNightCycle) {
                this.dayNightCycle.toggle();
            }

            // Touche 'V' pour visualiser les colliders (debug)
            if (event.code === 'KeyV') {
                this.toggleColliderVisualization();
            }
        });

        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });

        // Clic pour faire sauter les objets ET initialiser l'audio
        this.renderer.domElement.addEventListener('click', (event) => {
            // Initialiser l'audio au premier clic (nécessaire pour les navigateurs)
            if (!this.audioContext) {
                this.initAudio();
            }
            this.handleClick(event);
        });

        // Détecter le clic droit (bouton 2) pour activer le contrôle manuel de la caméra
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            if (event.button === 2) { // Bouton droit
                this.enableManualCamera();
                event.preventDefault();
            }
        });

        // Empêcher le menu contextuel sur clic droit
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Créer le son de moteur (oscillateur + filtre)
            this.engineOscillator = this.audioContext.createOscillator();
            this.engineOscillator.type = 'sawtooth';
            this.engineOscillator.frequency.value = 80;

            this.engineFilter = this.audioContext.createBiquadFilter();
            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.value = 800;
            this.engineFilter.Q.value = 1;

            this.engineGain = this.audioContext.createGain();
            this.engineGain.gain.value = 0; // Commence silencieux

            // Connecter : Oscillateur -> Filtre -> Gain -> Destination
            this.engineOscillator.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.audioContext.destination);

            this.engineOscillator.start();

            console.log('Audio system initialized');
        } catch (e) {
            console.warn('Web Audio API not supported', e);
        }
    }

    handleClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const meshes = this.objects.map(obj => obj.mesh);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const clickedObject = this.objects.find(obj => obj.mesh === clickedMesh);

            if (clickedObject && clickedObject !== this.car) {
                // Rapier: Apply impulse
                const impulse = { x: 0, y: 15, z: 0 };
                clickedObject.body.applyImpulse(impulse, true);
                const bodyPos = clickedObject.body.translation();
                this.createParticleExplosion(bodyPos);
                console.log('Object boosted!');
            }
        }
    }

    createParticleExplosion(position) {
        const particleCount = 15; // Réduit de 20 à 15 pour les performances
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4); // Réduit de 8 à 4 segments

        for (let i = 0; i < particleCount; i++) {
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6)
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            particle.position.set(position.x, position.y, position.z);

            // Direction aléatoire
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 8 + 2,
                (Math.random() - 0.5) * 10
            );

            particle.userData = {
                velocity: velocity,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.01
            };

            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    createDriftParticle() {
        if (!this.car || Math.random() > 0.5) return; // Réduit fréquence de 30% à 50%

        const carPos = this.car.body.translation();
        const particleGeometry = new THREE.SphereGeometry(0.15, 4, 4); // Réduit segments
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.6
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        // Position à l'arrière de la voiture
        const offset = { x: 0, y: 0, z: -1.5 };
        const carQuat = this.car.body.rotation();
        const worldOffset = rotateVectorByQuaternion(offset, carQuat);

        particle.position.set(
            carPos.x + worldOffset.x,
            0.4,
            carPos.z + worldOffset.z
        );

        particle.userData = {
            velocity: new THREE.Vector3(0, 0.5, 0),
            life: 1.0,
            decay: 0.03
        };

        this.particles.push(particle);
        this.scene.add(particle);
    }

    createExhaustSmoke() {
        if (!this.car || Math.random() > 0.4) return; // Réduit fréquence de 20% à 40%

        const carPos = this.car.body.translation();
        const carQuat = this.car.body.rotation();
        const particleGeometry = new THREE.SphereGeometry(0.2, 4, 4); // Réduit segments
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.4
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);

        // Position au pot d'échappement
        const offset = { x: -0.6, y: 0.3, z: -1.6 };
        const worldOffset = rotateVectorByQuaternion(offset, carQuat);

        particle.position.set(
            carPos.x + worldOffset.x,
            carPos.y + worldOffset.y,
            carPos.z + worldOffset.z
        );

        // Vitesse initiale vers l'arrière et légèrement vers le haut
        const backwardDir = { x: 0, y: 0.5, z: -1 };
        const worldBackward = rotateVectorByQuaternion(backwardDir, carQuat);

        particle.userData = {
            velocity: new THREE.Vector3(
                worldBackward.x * 0.5,
                worldBackward.y + 0.5,
                worldBackward.z * 0.5
            ),
            life: 1.0,
            decay: 0.015,
            scale: 0.2
        };

        this.particles.push(particle);
        this.scene.add(particle);
    }

    createSpeedLines() {
        if (!this.car || this.car.speed < 15) return;

        if (Math.random() > 0.5) return;

        const lineLength = 2;
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });

        // Créer une ligne derrière la voiture
        const carPos = this.car.body.translation();
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 2,
            (Math.random() - 0.5) * 10
        );

        const startPos = new THREE.Vector3(
            carPos.x + offset.x,
            carPos.y + offset.y,
            carPos.z + offset.z
        );

        const forwardDirLocal = { x: 0, y: 0, z: 1 };
        const carQuat = this.car.body.rotation();
        const forwardDir = rotateVectorByQuaternion(forwardDirLocal, carQuat);

        const endPos = new THREE.Vector3(
            startPos.x - forwardDir.x * lineLength,
            startPos.y,
            startPos.z - forwardDir.z * lineLength
        );

        const points = [startPos, endPos];
        lineGeometry.setFromPoints(points);

        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.userData = {
            life: 1.0,
            decay: 0.05
        };

        this.speedLines.push(line);
        this.scene.add(line);
    }

    updateSpeedLines(deltaTime) {
        // Limiter les speed lines
        const maxLines = 15; // Réduit de 20 à 15
        if (this.speedLines.length > maxLines) {
            const toRemove = this.speedLines.length - maxLines;
            for (let i = 0; i < toRemove; i++) {
                this.scene.remove(this.speedLines[i]);
                this.speedLines[i].geometry.dispose();
                this.speedLines[i].material.dispose();
            }
            this.speedLines.splice(0, toRemove);
        }

        for (let i = this.speedLines.length - 1; i >= 0; i--) {
            const line = this.speedLines[i];
            const userData = line.userData;

            userData.life -= userData.decay;
            line.material.opacity = userData.life * 0.6;

            if (userData.life <= 0) {
                this.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
                this.speedLines.splice(i, 1);
            }
        }
    }

    createBoostParticles() {
        if (!this.car) return;

        const carPos = this.car.body.translation();
        const carQuat = this.car.body.rotation();

        // Créer 2 particules par frame (réduit de 3 pour les performances)
        for (let i = 0; i < 2; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.1, 4, 4); // Réduit segments
            const colors = [0xff6600, 0xff8800, 0xffaa00, 0x00ffff, 0x0088ff];
            const color = colors[Math.floor(Math.random() * colors.length)];

            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            // Position à l'arrière de la voiture, aléatoire
            const offset = {
                x: (Math.random() - 0.5) * 1.5,
                y: 0.2 + Math.random() * 0.3,
                z: -1.8 - Math.random() * 0.5
            };
            const worldOffset = rotateVectorByQuaternion(offset, carQuat);

            particle.position.set(
                carPos.x + worldOffset.x,
                carPos.y + worldOffset.y,
                carPos.z + worldOffset.z
            );

            // Vélocité vers l'arrière et vers le haut
            const backwardDir = { x: 0, y: 0, z: -1 };
            const worldBackward = rotateVectorByQuaternion(backwardDir, carQuat);

            particle.userData = {
                velocity: new THREE.Vector3(
                    worldBackward.x * -2 + (Math.random() - 0.5) * 2,
                    1 + Math.random() * 2,
                    worldBackward.z * -2 + (Math.random() - 0.5) * 2
                ),
                life: 1.0,
                decay: 0.02 + Math.random() * 0.01,
                scale: 0.2 + Math.random() * 0.1,
                isBoostParticle: true
            };

            this.boostParticles.push(particle);
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    updateBoostUI() {
        const boostBar = document.getElementById('boost-bar');
        const boostValue = document.getElementById('boost-value');

        if (boostBar && boostValue) {
            const percentage = (this.boostEnergy / this.boostMaxEnergy) * 100;
            boostBar.style.width = percentage + '%';
            boostValue.textContent = Math.round(this.boostEnergy);

            // Changer la couleur selon l'état
            if (this.boostActive) {
                boostBar.style.background = 'linear-gradient(90deg, #ff6600, #ffaa00)';
                boostBar.style.boxShadow = '0 0 20px rgba(255, 170, 0, 0.8)';
            } else if (this.boostEnergy < 20) {
                boostBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
                boostBar.style.boxShadow = 'none';
            } else {
                boostBar.style.background = 'linear-gradient(90deg, #4ecdc4, #44ff44)';
                boostBar.style.boxShadow = 'none';
            }
        }
    }

    checkAchievement(achievementKey) {
        if (!this.achievements[achievementKey]) return;
        if (this.achievements[achievementKey].unlocked) return;

        let shouldUnlock = false;

        switch(achievementKey) {
            case 'speedDemon':
                if (this.car && this.car.speed >= 150) shouldUnlock = true;
                break;
            case 'collector':
                if (this.score >= 10) shouldUnlock = true;
                break;
            case 'explorer':
                if (this.visitedZones.size >= 4) shouldUnlock = true;
                break;
            case 'customizer':
                // Vérifier si localStorage contient une customization
                if (localStorage.getItem('carCustomization')) shouldUnlock = true;
                break;
            case 'boostMaster':
                if (this.boostUseCount >= 20) shouldUnlock = true;
                break;
        }

        if (shouldUnlock) {
            this.unlockAchievement(achievementKey);
        }
    }

    unlockAchievement(achievementKey) {
        const achievement = this.achievements[achievementKey];
        if (!achievement || achievement.unlocked) return;

        achievement.unlocked = true;
        console.log(`🏆 Achievement Unlocked: ${achievement.name}!`);

        // Track achievement
        GameAnalytics.achievementUnlocked(achievement.name);

        // Créer une notification
        this.showAchievementNotification(achievement);

        // Sauvegarder dans localStorage
        const savedAchievements = JSON.parse(localStorage.getItem('achievements') || '{}');
        savedAchievements[achievementKey] = true;
        localStorage.setItem('achievements', JSON.stringify(savedAchievements));
    }

    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">🏆</div>
            <div class="achievement-content">
                <div class="achievement-title">Achievement Unlocked!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.desc}</div>
            </div>
        `;
        document.body.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        // Retirer après 4 secondes
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 4000);
    }

    loadAchievements() {
        try {
            const saved = localStorage.getItem('achievements');
            if (saved) {
                const savedAchievements = JSON.parse(saved);
                for (const key in savedAchievements) {
                    if (this.achievements[key]) {
                        this.achievements[key].unlocked = savedAchievements[key];
                    }
                }
                console.log('📂 Achievements loaded:', this.achievements);
            }
        } catch (error) {
            console.error('Error loading achievements:', error);
        }

        // Vérifier l'achievement customizer au démarrage
        this.checkAchievement('customizer');
    }

    updateParticles(deltaTime) {
        // Limiter le nombre de particules pour les performances
        const maxParticles = 75; // Réduit de 100 à 75
        if (this.particles.length > maxParticles) {
            const toRemove = this.particles.length - maxParticles;
            for (let i = 0; i < toRemove; i++) {
                this.scene.remove(this.particles[i]);
            }
            this.particles.splice(0, toRemove);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const userData = particle.userData;

            // Mise à jour position
            particle.position.add(userData.velocity.clone().multiplyScalar(deltaTime));

            // Gravité (sauf pour la fumée) - cohérente avec la gravité du monde
            if (!userData.scale) {
                userData.velocity.y -= 25.0 * deltaTime;  // Augmenté de 9.8 à 25.0
            } else {
                // Fumée : ralentir et s'élargir
                userData.velocity.multiplyScalar(0.98);
                userData.scale += deltaTime * 0.5;
                particle.scale.setScalar(userData.scale);
            }

            // Diminuer la vie
            userData.life -= userData.decay;

            // Mise à jour opacité
            particle.material.opacity = userData.life * (userData.scale ? 0.4 : 1);
            particle.material.transparent = true;

            // Supprimer les particules mortes
            if (userData.life <= 0) {
                this.scene.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    updateCar(deltaTime) {
        if (!this.car) return;

        let forward = 0;
        let turn = 0;
        let brake = false;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) turn += 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) turn -= 1;
        if (this.keys['Space']) brake = true;

        // Gérer le boost
        const boostKey = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        if (boostKey && this.boostEnergy > 0 && forward > 0) {
            if (!this.boostActive) {
                this.boostActive = true;
                this.boostUseCount++;
                this.checkAchievement('boostMaster');
                GameAnalytics.boostUsed(this.boostUseCount);
                console.log('🚀 BOOST ACTIVATED!');
            }
        } else {
            this.boostActive = false;
        }

        // Mettre à jour l'énergie du boost
        if (this.boostActive && forward > 0) {
            this.boostEnergy = Math.max(0, this.boostEnergy - this.boostDrainRate * deltaTime);
            if (this.boostEnergy <= 0) {
                this.boostActive = false;
            }
        } else {
            this.boostEnergy = Math.min(this.boostMaxEnergy, this.boostEnergy + this.boostRechargeRate * deltaTime);
        }

        // Mettre à jour la barre de boost dans l'UI
        this.updateBoostUI();

        const carBody = this.car.body;
        const car = this.car;

        // Rapier: Obtenir rotation et position
        const carQuat = carBody.rotation();
        const yRotation = getYRotationFromQuaternion(carQuat);

        // Rapier: Annuler toutes les rotations indésirables
        const angVel = carBody.angvel();
        carBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

        // Obtenir la direction actuelle de la voiture
        const forwardDirLocal = { x: 0, y: 0, z: 1 };
        let forwardDir = rotateVectorByQuaternion(forwardDirLocal, carQuat);
        forwardDir.y = 0;
        // Normalize
        const len = Math.sqrt(forwardDir.x * forwardDir.x + forwardDir.y * forwardDir.y + forwardDir.z * forwardDir.z);
        forwardDir.x /= len;
        forwardDir.y /= len;
        forwardDir.z /= len;

        // Vitesse actuelle
        const currentVel = carBody.linvel();
        const currentSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);

        // Calculer la vitesse signée (positive = avant, négative = arrière)
        let signedSpeed = 0;
        if (currentSpeed > 0.05) {
            const velocityDir = { x: currentVel.x, y: 0, z: currentVel.z };
            const velLen = Math.sqrt(velocityDir.x * velocityDir.x + velocityDir.z * velocityDir.z);
            velocityDir.x /= velLen;
            velocityDir.z /= velLen;
            const dot = forwardDir.x * velocityDir.x + forwardDir.z * velocityDir.z;
            signedSpeed = currentSpeed * (dot >= 0 ? 1 : -1);
        }

        // Initialiser signedSpeed depuis la propriété car si elle existe
        if (!this.car.currentSpeed) {
            this.car.currentSpeed = 0;
        }
        if (currentSpeed < 0.05) {
            signedSpeed = this.car.currentSpeed;
        }

        // DIRECTION - Tourner la voiture (plus réactif)
        if (turn !== 0 && currentSpeed > 0.1) {  // Seuil abaissé de 0.2 à 0.1
            const speedFactor = Math.min(currentSpeed / 12, 1);  // Ajusté pour meilleure sensation
            const maxTurnRate = 2.5;  // Augmenté de 2.0 à 2.5 pour virages plus réactifs

            // Inverser si marche arrière
            const isReversing = signedSpeed < -0.1;
            const actualTurn = isReversing ? -turn : turn;

            // Appliquer la rotation directement
            const turnAmount = actualTurn * maxTurnRate * speedFactor * deltaTime;
            const newYRotation = yRotation + turnAmount;
            const newQuat = quaternionFromYRotation(newYRotation);
            carBody.setRotation(newQuat, true);

            // Effet de drift
            if (currentSpeed > 10 && Math.abs(turn) > 0.5) {
                this.createDriftParticle();
            }
        }

        // MOUVEMENT - Accélération/Freinage (plus fluide et réactif)
        if (forward !== 0) {
            const acceleration = this.boostActive ? 50 : 35; // Augmenté (40->50, 25->35)
            const baseMaxSpeed = car.maxSpeed;
            const maxSpeed = this.boostActive ? baseMaxSpeed * this.boostMultiplier : baseMaxSpeed;
            const maxReverseSpeed = maxSpeed * 0.6;

            // Créer des particules de boost
            if (this.boostActive && forward > 0) {
                this.createBoostParticles();
            }

            if (forward > 0) {
                // Avancer
                if (signedSpeed < 0) {
                    // Freiner si on recule (plus rapide)
                    signedSpeed = Math.min(signedSpeed + acceleration * 2.0 * deltaTime, 0);
                } else {
                    // Accélération progressive plus rapide
                    const accelFactor = 1 - (signedSpeed / maxSpeed) * 0.7;  // Réduit le facteur de ralentissement
                    signedSpeed = Math.min(signedSpeed + acceleration * accelFactor * deltaTime, maxSpeed);
                }
            } else {
                // Reculer
                if (signedSpeed > 0.3) {
                    // Freiner si on avance (plus efficace)
                    signedSpeed = Math.max(signedSpeed - acceleration * 2.5 * deltaTime, 0);
                } else {
                    // Marche arrière (plus rapide)
                    signedSpeed = Math.max(signedSpeed - acceleration * 0.8 * deltaTime, -maxReverseSpeed);
                }
            }
        } else if (brake) {
            // Frein à main (plus efficace)
            signedSpeed *= 0.7;  // Plus fort (0.8 -> 0.7)
        } else {
            // Friction naturelle (plus faible pour conserver vitesse)
            signedSpeed *= 0.95;  // Réduit (0.93 -> 0.95)
            if (Math.abs(signedSpeed) < 0.01) signedSpeed = 0;
        }

        // Appliquer la vitesse dans la direction de la voiture
        const newVelocity = {
            x: forwardDir.x * signedSpeed,
            y: currentVel.y,  // Conserver la vitesse verticale
            z: forwardDir.z * signedSpeed
        };

        // Limiter la vélocité verticale excessive pour éviter les rebonds
        if (newVelocity.y < -40) {
            newVelocity.y = -40; // Augmenté de -20 à -40 pour permettre chutes plus rapides
        }

        carBody.setLinvel(newVelocity, true);

        // Sauvegarder la vitesse signée pour le prochain frame
        this.car.currentSpeed = signedSpeed;
        car.speed = Math.abs(signedSpeed);
    }

    enableManualCamera() {
        if (!this.cameraManualControl) {
            this.cameraManualControl = true;
            this.controls.enabled = true;

            // Positionner le target des contrôles sur la voiture
            if (this.car) {
                const carPos = this.car.body.translation();
                this.controls.target.set(
                    carPos.x,
                    carPos.y,
                    carPos.z
                );
            }

            console.log('📷 Camera: Manual mode (right-click + drag to rotate)');
        }

        // Réinitialiser le timer d'auto-retour
        this.resetCameraAutoTimeout();
    }

    disableManualCamera() {
        this.cameraManualControl = false;
        this.controls.enabled = false;

        // Annuler le timer d'auto-retour
        if (this.cameraAutoTimeout) {
            clearTimeout(this.cameraAutoTimeout);
            this.cameraAutoTimeout = null;
        }

        console.log('📷 Camera: Auto mode (following car)');
    }

    resetCameraAutoTimeout() {
        // Annuler l'ancien timer
        if (this.cameraAutoTimeout) {
            clearTimeout(this.cameraAutoTimeout);
        }

        // Créer un nouveau timer pour revenir en mode auto après inactivité
        this.cameraAutoTimeout = setTimeout(() => {
            this.disableManualCamera();
        }, this.cameraAutoDelay);
    }

    updateCamera() {
        if (!this.car) return;

        // Si en mode manuel, update seulement le target des contrôles pour suivre la voiture
        if (this.cameraManualControl) {
            // Mettre à jour le target pour qu'il suive doucement la voiture
            const carPosition = this.car.body.translation();
            this.controls.target.lerp(
                new THREE.Vector3(carPosition.x, carPosition.y, carPosition.z),
                0.05
            );

            // Mettre à jour les contrôles
            this.controls.update();
            return; // Ne pas appliquer la caméra automatique
        }

        // Mode automatique : suivre la voiture
        const carPosition = this.car.body.translation();
        const carQuaternion = this.car.body.rotation();
        const carSpeed = this.car.speed;

        // Distance caméra adaptée à la vitesse (recule quand on va vite)
        const baseDistance = 10;
        const speedFactor = Math.min(carSpeed / 12, 1.5);
        const distance = baseDistance + speedFactor * 2; // Réduit de 5 à 2 pour effet plus subtil

        // Hauteur caméra adaptée à la vitesse
        const baseHeight = 5;
        const height = baseHeight + speedFactor * 0.5; // Réduit de 1.5 à 0.5 pour effet plus subtil

        // Position de la caméra derrière la voiture
        const offset = { x: 0, y: height, z: -distance };
        const worldOffset = rotateVectorByQuaternion(offset, carQuaternion);

        const targetPosition = new THREE.Vector3(
            carPosition.x + worldOffset.x,
            carPosition.y + worldOffset.y,
            carPosition.z + worldOffset.z
        );

        // Point de visée devant la voiture (anticipe le mouvement)
        const lookAheadDistance = 3 + speedFactor * 3;
        const lookAtOffset = { x: 0, y: 0.5, z: lookAheadDistance };
        const worldLookAt = rotateVectorByQuaternion(lookAtOffset, carQuaternion);

        const targetLookAt = new THREE.Vector3(
            carPosition.x + worldLookAt.x,
            carPosition.y + worldLookAt.y,
            carPosition.z + worldLookAt.z
        );

        // Interpolation fluide et dynamique - plus lisse
        const positionLerpSpeed = 0.05 + (carSpeed / 200); // Plus lent pour plus de fluidité
        const lookAtLerpSpeed = 0.08; // Plus lent

        this.camera.position.lerp(targetPosition, Math.min(positionLerpSpeed, 0.15));
        this.cameraTarget.lerp(targetLookAt, lookAtLerpSpeed);
        this.camera.lookAt(this.cameraTarget);
    }

    updateUI() {
        if (this.car) {
            const speedKmh = Math.round(this.car.speed * 3.6);
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = speedKmh;

                // Changer couleur selon la vitesse
                if (speedKmh > 50) {
                    speedElement.style.color = '#ff4444';
                } else if (speedKmh > 25) {
                    speedElement.style.color = '#ffaa44';
                } else {
                    speedElement.style.color = '#44ff44';
                }
            }

            // Vérifier l'achievement speedDemon
            if (speedKmh >= 150) {
                this.checkAchievement('speedDemon');
            }

            // Mise à jour position
            const posX = document.getElementById('pos-x');
            const posZ = document.getElementById('pos-z');
            const carPos = this.car.body.translation();
            if (posX) posX.textContent = Math.round(carPos.x);
            if (posZ) posZ.textContent = Math.round(carPos.z);
        }

        // Mise à jour nombre d'objets
        const objCount = document.getElementById('obj-count');
        if (objCount) objCount.textContent = this.objects.length;

        // Mise à jour du score
        const scoreElement = document.getElementById('score-value');
        if (scoreElement) scoreElement.textContent = this.score;

        // Mise à jour FPS
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime >= this.lastTime + 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;

            const fpsElement = document.getElementById('fps-count');
            if (fpsElement) {
                fpsElement.textContent = this.fps;
                // Colorer selon performance
                if (this.fps >= 55) {
                    fpsElement.style.color = '#44ff44';
                } else if (this.fps >= 30) {
                    fpsElement.style.color = '#ffaa44';
                } else {
                    fpsElement.style.color = '#ff4444';
                }
            }

            // Track performance
            if (this.car) {
                VisitorTracking.trackPerformance(this.fps, this.car.speed);

                // Track position pour heatmap
                const carPos = this.car.body.translation();
                VisitorTracking.trackCarPosition(carPos.x, carPos.z, this.car.speed);
            }
        }

        // Mise à jour indicateur de zone active
        const zoneMapping = {
            'About Me': 'about',
            'Projects': 'projects',
            'Skills': 'skills',
            'Contact': 'contact'
        };

        document.querySelectorAll('.zone-item').forEach(item => {
            item.classList.remove('active');
        });

        if (this.currentZone) {
            const zoneKey = zoneMapping[this.currentZone.name];
            const zoneItem = document.querySelector(`[data-zone="${zoneKey}"]`);
            if (zoneItem) {
                zoneItem.classList.add('active');
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCollectibles(deltaTime) {
        this.collectibles.forEach(collectible => {
            if (collectible.collected) return;

            // Rotation
            collectible.mesh.rotation.y += collectible.rotationSpeed;

            // Lévitation
            const time = Date.now() * 0.001;
            collectible.mesh.position.y = collectible.baseY + Math.sin(time + collectible.mesh.position.x) * 0.3;
            collectible.light.position.y = collectible.mesh.position.y;

            // Pulse de la lumière
            collectible.light.intensity = 0.3 + Math.sin(time * 2) * 0.2;
        });
    }

    checkCollectibles() {
        if (!this.car) return;

        const carPosRapier = this.car.body.translation();
        const carPos = new THREE.Vector3(
            carPosRapier.x,
            carPosRapier.y,
            carPosRapier.z
        );

        this.collectibles.forEach(collectible => {
            if (collectible.collected) return;

            const distance = carPos.distanceTo(collectible.mesh.position);

            if (distance < 2) {
                // Collecter !
                collectible.collected = true;
                this.score += 10;

                // Vérifier l'achievement collector
                this.checkAchievement('collector');

                // Animation de collection
                this.animateCollection(collectible);

                // Particules
                this.createCollectionParticles(collectible.mesh.position);

                // Son de collecte
                this.playCollectSound();
            }
        });
    }

    animateCollection(collectible) {
        const startScale = collectible.mesh.scale.clone();
        const startTime = Date.now();
        const duration = 300;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Scale up et fade out
            const scale = 1 + progress * 2;
            collectible.mesh.scale.set(scale, scale, scale);
            collectible.mesh.material.opacity = 1 - progress;
            collectible.mesh.material.transparent = true;
            collectible.light.intensity *= 0.9;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(collectible.mesh);
                this.scene.remove(collectible.light);
            }
        };

        animate();
    }

    createCollectionParticles(position) {
        const particleCount = 10; // Réduit de 15 à 10
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4); // Réduit segments

        for (let i = 0; i < particleCount; i++) {
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: 0xffdd00,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            particle.position.copy(position);

            // Explosion radiale
            const angle = (i / particleCount) * Math.PI * 2;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * 5,
                Math.random() * 5 + 3,
                Math.sin(angle) * 5
            );

            particle.userData = {
                velocity: velocity,
                life: 1.0,
                decay: 0.03
            };

            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    toggleColliderVisualization() {
        this.showColliders = !this.showColliders;

        if (this.showColliders) {
            console.log('🔍 Showing colliders (press V to hide)');
            ColliderHelper.visualizeColliders(this.scene, this.world, {
                color: 0x00ff00,
                opacity: 0.5,
                wireframe: true
            });
        } else {
            console.log('👁️ Hiding colliders');
            ColliderHelper.removeColliderVisualization(this.scene);
        }
    }

    checkGarageProximity() {
        if (!this.car || !this.garageZone || this.inGarage) return;

        const carPos = this.car.body.translation();
        const garage = this.garageZone;

        // Vérifier si la voiture est dans la zone du garage
        const inGarageX = Math.abs(carPos.x - garage.x) < garage.width / 2;
        const inGarageZ = Math.abs(carPos.z - garage.z) < garage.depth / 2;

        if (inGarageX && inGarageZ) {
            this.inGarage = true;
            this.enterGarage();
        }
    }

    enterGarage() {
        console.log('🚗 Entering garage!');

        // Créer un overlay de transition
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            opacity: 0;
            z-index: 10000;
            transition: opacity 1s ease-in-out;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 48px;
            font-family: 'Segoe UI', sans-serif;
            font-weight: bold;
        `;
        overlay.textContent = 'GARAGE';
        document.body.appendChild(overlay);

        // Fade in
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);

        // Rediriger vers la page garage après l'animation
        setTimeout(() => {
            window.location.href = 'garage.html';
        }, 1000);
    }


    playCollectSound() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Oscillateur pour le son de collecte (arpège ascendant)
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    updateEngineSound() {
        if (!this.audioContext || !this.car) return;

        const speed = this.car.speed;
        const maxSpeed = this.car.maxSpeed;

        // Fréquence du moteur augmente avec la vitesse (80Hz à 300Hz)
        const targetFreq = 80 + (speed / maxSpeed) * 220;
        this.engineOscillator.frequency.exponentialRampToValueAtTime(
            Math.max(targetFreq, 80),
            this.audioContext.currentTime + 0.1
        );

        // Filtre s'ouvre avec la vitesse
        const targetFilterFreq = 800 + (speed / maxSpeed) * 1200;
        this.engineFilter.frequency.exponentialRampToValueAtTime(
            targetFilterFreq,
            this.audioContext.currentTime + 0.1
        );

        // Volume du moteur
        const targetGain = speed > 0.5 ? 0.15 + (speed / maxSpeed) * 0.1 : 0;
        this.engineGain.gain.linearRampToValueAtTime(
            targetGain,
            this.audioContext.currentTime + 0.1
        );
    }

    playBrakeSound() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Son de freinage (bruit blanc filtré)
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        noise.start(now);
        noise.stop(now + 0.3);
    }

    initMinimap() {
        this.minimapCanvas = document.getElementById('minimap');
        if (!this.minimapCanvas) return;
        this.minimapCtx = this.minimapCanvas.getContext('2d');
    }

    updateMinimap() {
        if (!this.minimapCtx || !this.car) return;

        const ctx = this.minimapCtx;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;

        // Effacer le canvas
        ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
        ctx.fillRect(0, 0, width, height);

        // Échelle : 1 pixel = 2m
        const scale = 0.75;
        const centerX = width / 2;
        const centerY = height / 2;

        // Position de la voiture
        const carPosRapier = this.car.body.translation();
        const carX = carPosRapier.x;
        const carZ = carPosRapier.z;

        // Dessiner les zones interactives
        ctx.fillStyle = 'rgba(78, 205, 196, 0.3)';
        this.interactiveZones.forEach(zone => {
            const x = centerX + (zone.position.x - carX) * scale;
            const y = centerY + (zone.position.z - carZ) * scale;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Dessiner les collectibles non collectés
        ctx.fillStyle = '#ffdd00';
        this.collectibles.forEach(c => {
            if (c.collected) return;
            const x = centerX + (c.mesh.position.x - carX) * scale;
            const y = centerY + (c.mesh.position.z - carZ) * scale;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Dessiner la voiture (centre avec direction)
        ctx.save();
        ctx.translate(centerX, centerY);

        // Rotation de la voiture
        // Dans Three.js/Rapier, la direction "forward" de la voiture est Z+
        // Dans le canvas 2D, notre triangle pointe vers Y- (haut du canvas)
        // On doit ajouter PI pour que ça corresponde
        const carQuat = this.car.body.rotation();
        const yRotation = getYRotationFromQuaternion(carQuat);
        ctx.rotate(-yRotation + Math.PI);

        // Triangle pour la voiture
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Bordure
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        let deltaTime = this.clock.getDelta();

        // Limiter deltaTime pour éviter les spirales de mort
        deltaTime = Math.min(deltaTime, 0.1);

        // Accumuler le temps
        this.timeAccumulator += deltaTime;

        // Mise à jour physique avec fixed timestep pour mouvement fluide
        const maxIterations = 5; // Limiter pour éviter les boucles infinies
        let iterations = 0;

        while (this.timeAccumulator >= this.fixedTimeStep && iterations < maxIterations) {
            // Mise à jour de la voiture et de la physique avec timestep fixe
            this.updateCar(this.fixedTimeStep);
            this.world.step(); // Rapier utilise son propre timestep interne

            // Debug toutes les 60 frames
            if (this.frameCount % 60 === 0 && iterations === 0) {
                console.log('⚙️ Physics step called (Rapier)');
            }

            this.timeAccumulator -= this.fixedTimeStep;
            iterations++;
        }

        // Si trop de temps accumulé, réinitialiser pour éviter les problèmes
        if (this.timeAccumulator > this.fixedTimeStep * 5) {
            this.timeAccumulator = 0;
        }

        // Calculer alpha pour interpolation lisse
        const alpha = this.timeAccumulator / this.fixedTimeStep;

        // Synchronisation de la VOITURE (prioritaire et séparée)
        if (this.car && this.car.mesh && this.car.body) {
            // Rapier: Get position and rotation
            const carPos = this.car.body.translation();
            const carRot = this.car.body.rotation();
            const carVel = this.car.body.linvel();

            // Debug: Log position Y plus fréquemment pour diagnostiquer
            if (this.frameCount % 30 === 0) {
                console.log('Car Y position:', carPos.y.toFixed(2), 'Velocity Y:', carVel.y.toFixed(2), 'Sleeping:', this.car.body.isSleeping());
            }

            this.car.mesh.position.lerp(
                new THREE.Vector3(carPos.x, carPos.y, carPos.z),
                0.3
            );
            this.car.mesh.quaternion.slerp(
                new THREE.Quaternion(carRot.x, carRot.y, carRot.z, carRot.w),
                0.3
            );
        }

        // Synchronisation autres objets physiques/visuels avec interpolation
        this.objects.forEach(({ mesh, body }) => {
            // Skip la voiture car déjà traitée
            if (mesh === this.car?.mesh) return;

            // Interpolation linéaire pour un mouvement plus fluide
            if (mesh && body) {
                const bodyPos = body.translation();
                const bodyRot = body.rotation();
                mesh.position.lerp(
                    new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z),
                    0.3
                );
                mesh.quaternion.slerp(
                    new THREE.Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w),
                    0.3
                );
            }
        });

        // Animation des roues
        if (this.car && this.car.wheels) {
            const wheelRotationSpeed = this.car.speed * deltaTime * 2;
            this.car.wheels.forEach(wheel => {
                wheel.rotation.x += wheelRotationSpeed;
            });

            // Intensité des phares selon la vitesse
            if (this.car.headlights) {
                const speedFactor = Math.min(this.car.speed / this.car.maxSpeed, 1);
                const intensity = 0.5 + speedFactor * 0.8;
                this.car.headlights.forEach(light => {
                    light.intensity = intensity;
                });
            }
        }

        // Mise à jour des particules
        this.updateParticles(deltaTime);
        this.updateSpeedLines(deltaTime);

        // Animer les nuages
        if (this.clouds) {
            const time = Date.now() * 0.001;
            this.clouds.forEach(cloud => {
                // Lévitation douce
                cloud.position.y = cloud.userData.baseY + Math.sin(time * cloud.userData.speed + cloud.userData.offset) * 0.5;
                // Rotation lente
                cloud.rotation.y += 0.001;
            });
        }

        // Animer les objets (flèche du garage, etc.)
        if (this.animatedObjects) {
            const time = Date.now() * 0.001;
            this.animatedObjects.forEach(obj => {
                if (obj.userData.baseY !== undefined) {
                    // Pulse vertical
                    obj.position.y = obj.userData.baseY + Math.sin(time * obj.userData.speed + obj.userData.offset) * 0.5;
                }
            });
        }

        // Créer des effets selon la vitesse
        if (this.car && this.car.speed > 2) {
            this.createExhaustSmoke();
        }
        if (this.car && this.car.speed > 15) {
            this.createSpeedLines();
        }

        // Check si on entre dans le garage
        this.checkGarageProximity();

        // Update et check collectibles
        this.updateCollectibles(deltaTime);
        this.checkCollectibles();

        // Mise à jour UI
        this.updateUI();

        // Mise à jour caméra - suit la voiture automatiquement
        this.updateCamera();

        // Mise à jour son du moteur
        this.updateEngineSound();

        // Mise à jour mini-map
        this.updateMinimap();

        // Mise à jour du cycle jour/nuit
        if (this.dayNightCycle) {
            this.dayNightCycle.update();

            // Mettre à jour les lampadaires selon le cycle jour/nuit
            if (this.streetLamps.length > 0) {
                updateStreetLamps(this.streetLamps, this.dayNightCycle.timeOfDay);
            }
        }

        // Animation des lampadaires
        if (this.streetLamps.length > 0) {
            animateStreetLamps(this.streetLamps, deltaTime);
        }

        // Animation des cactus (oscillation au vent)
        if (this.cacti.length > 0) {
            animateCacti(this.cacti, deltaTime);
        }

        // Utiliser le post-processing si disponible, sinon render standard
        if (this.composer && this.postProcessingEnabled) {
            // Mettre à jour les effets selon la vitesse
            if (this.car) {
                updatePostProcessingBySpeed(this.composer, this.car.speed, this.car.maxSpeed);
            }
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Créer l'application
new Portfolio3D();
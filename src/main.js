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
import { PhotoMode } from './utils/photoMode.js';
import { WeatherSystem } from './utils/weatherSystem.js';

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

        // Photo Mode
        this.photoMode = null;

        // Weather System
        this.weatherSystem = null;

        // Drift system
        this.isDrifting = false;
        this.driftDirection = 0; // -1 = gauche, 1 = droite
        this.driftIntensity = 0;
        this.driftMarks = []; // Traces de drift
        this.driftJumpProgress = 0; // Animation du saut (0 à 1)
        this.driftTime = 0; // Temps de drift accumulé
        this.driftLevel = 0; // 0 = pas de boost, 1 = bleu, 2 = orange
        this.driftLevelStartTime = 0; // Quand le niveau actuel a commencé
        this.driftSparks = []; // Particules d'étincelles

        // Étincelles post-drift
        this.postDriftSparks = false; // Si les étincelles continuent après le drift
        this.postDriftSparksTime = 0; // Temps écoulé depuis la fin du drift
        this.postDriftSparksDuration = 0; // Durée totale (1.4s bleu, 3s orange)
        this.postDriftSparksLevel = 0; // Niveau des étincelles à afficher
        this.postDriftSparksDirection = 0; // Direction du drift (-1 ou 1)

        // Mini-turbo boost system
        this.miniTurboActive = false; // Si un mini-turbo est actif
        this.miniTurboTime = 0; // Temps écoulé depuis le début du boost
        this.miniTurboDuration = 0; // Durée totale du boost
        this.miniTurboSpeed = 0; // Vitesse supplémentaire du boost (en unités internes)

        // Driving Mode System (Normal / Sport)
        // Note: Les vitesses sont en unités internes (affichage = vitesse * 3.6 pour km/h)
        this.drivingMode = 'normal'; // 'normal' ou 'sport'
        this.drivingModes = {
            normal: {
                maxSpeed: 50 / 3.6,       // ~13.89 -> affiche 50 km/h
                boostMaxSpeed: 100 / 3.6  // ~27.78 -> affiche 100 km/h
            },
            sport: {
                maxSpeed: 100 / 3.6,      // ~27.78 -> affiche 100 km/h
                boostMaxSpeed: 150 / 3.6  // ~41.67 -> affiche 150 km/h
            }
        };

        // Skin System (Car Appearance)
        // Note: Échelle UNIFORME pour tous les véhicules (1.5)
        this.availableSkins = [
            {
                id: 'mcqueen',
                name: 'Lightning McQueen',
                path: '/skins/lightning_mcqueen_cars_3.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🏎️'
            },
            {
                id: 'mcqueen_rs',
                name: 'McQueen Classic',
                path: '/skins/radiator_springs_lightning_mcqueen.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '⚡'
            },
            {
                id: 'sally',
                name: 'Sally Carrera',
                path: '/skins/sally_carrera.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '💙'
            },
            {
                id: 'cruz',
                name: 'Cruz Ramirez',
                path: '/skins/cruz_ramirez.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🟡'
            },
            {
                id: 'chick',
                name: 'Chick Hicks',
                path: '/skins/chick_hicks.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '💚'
            },
            {
                id: 'francesco',
                name: 'Francesco Bernoulli',
                path: '/skins/francesco_bernoulli.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇮🇹'
            },
            {
                id: 'finn',
                name: 'Finn McMissile',
                path: '/skins/finn_mcmissle.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🕵️'
            },
            {
                id: 'holley',
                name: 'Holley Shiftwell',
                path: '/skins/holley_shiftwell.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '💜'
            },
            {
                id: 'jeff',
                name: 'Jeff Gorvette',
                path: '/skins/jeff_gorvette.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🏁'
            },
            {
                id: 'carla',
                name: 'Carla Veloso',
                path: '/skins/carla_veloso.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇧🇷'
            },
            {
                id: 'nigel',
                name: 'Nigel Gearsley',
                path: '/skins/nigel_gearsley.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇬🇧'
            },
            {
                id: 'raoul',
                name: 'Raoul Caroule',
                path: '/skins/raoul_caroule.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇫🇷'
            },
            {
                id: 'miguel',
                name: 'Miguel Camino',
                path: '/skins/miguel_camino.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇪🇸'
            },
            {
                id: 'max',
                name: 'Max Schnell',
                path: '/skins/max_schnell.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇩🇪'
            },
            {
                id: 'shu',
                name: 'Shu Todoroki',
                path: '/skins/shu_todoroki.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇯🇵'
            },
            {
                id: 'kabuto',
                name: 'Kabuto',
                path: '/skins/kabuto.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🎌'
            },
            {
                id: 'mater',
                name: 'Mater',
                path: '/skins/mater.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🚚'
            },
            {
                id: 'fillmore',
                name: 'Fillmore',
                path: '/skins/fillmore.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🌿'
            },
            {
                id: 'sarge',
                name: 'Sarge',
                path: '/skins/sarge.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🪖'
            },
            {
                id: 'sheriff',
                name: 'Sheriff',
                path: '/skins/sherrif.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '👮'
            },
            {
                id: 'flo',
                name: 'Flo',
                path: '/skins/flo.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🏪'
            },
            {
                id: 'luigi',
                name: 'Luigi',
                path: '/skins/luigi.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🇮🇹'
            },
            {
                id: 'guido',
                name: 'Guido',
                path: '/skins/guido.glb',
                scale: 1.5,
                yOffset: -0.75,
                thumbnail: '🔧'
            }
        ];
        this.currentSkinId = 'mcqueen';
        this.garageOpen = false;

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

            // Initialiser le HUD du mode de conduite
            this.updateDrivingModeHUD();

            // Track game start
            GameAnalytics.gameStart();

            // Initialize Photo Mode
            this.photoMode = new PhotoMode(this);
            console.log('📸 Photo Mode initialized - Press P to activate!');

            // Initialize Weather System
            this.weatherSystem = new WeatherSystem(this);
            console.log('🌧️ Weather System initialized - Press M to toggle rain!');

            console.log('🏎️ Drift System ready - Hold SPACE while turning to drift!');

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
        // Configuration d'origine - retour à ce qui fonctionnait
        const isLowEnd = window.devicePixelRatio < 2 ||
                        (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);

        this.renderer = new THREE.WebGLRenderer({
            antialias: !isLowEnd, // Seulement pour haut de gamme
            powerPreference: 'high-performance'
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Pixel ratio limité comme avant
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowEnd ? 1 : 1.5));

        // Ombres seulement sur haut de gamme
        this.renderer.shadowMap.enabled = !isLowEnd;
        if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
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

        // Charger le skin initial
        this.loadCarSkin(carGroup, this.currentSkinId);

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
            maxSpeed: this.drivingModes[this.drivingMode].maxSpeed,
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

            // Touche 'P' pour activer le Photo Mode
            if (event.code === 'KeyP' && this.photoMode) {
                this.photoMode.toggle();
            }

            // Touche 'M' pour activer/désactiver la pluie
            if (event.code === 'KeyM' && this.weatherSystem) {
                this.weatherSystem.toggle();
            }

            // Touche 'T' pour basculer le mode de conduite (Normal/Sport)
            if (event.code === 'KeyT') {
                this.toggleDrivingMode();
            }

            // Touche 'G' pour ouvrir/fermer le garage
            if (event.code === 'KeyG') {
                this.toggleGarage();
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

    /**
     * Crée une trace de drift au sol (comme dans Mario Kart)
     */
    createDriftMark() {
        if (!this.car) return;

        // Limiter la fréquence de création
        if (Math.random() > 0.3) return;

        const carPos = this.car.body.translation();
        const carQuat = this.car.body.rotation();

        // Créer des traces pour les roues arrières (gauche et droite)
        const wheelOffsets = [
            { x: -0.4, z: -1.0 }, // Roue arrière gauche
            { x: 0.4, z: -1.0 }   // Roue arrière droite
        ];

        wheelOffsets.forEach(offset => {
            const worldOffset = rotateVectorByQuaternion(offset, carQuat);

            // Géométrie de la trace (ligne fine)
            const markGeometry = new THREE.PlaneGeometry(0.15, 0.5);
            const markMaterial = new THREE.MeshBasicMaterial({
                color: 0x222222, // Noir foncé
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const mark = new THREE.Mesh(markGeometry, markMaterial);

            // Position au sol
            mark.position.set(
                carPos.x + worldOffset.x,
                0.05, // Légèrement au-dessus du sol pour éviter z-fighting
                carPos.z + worldOffset.z
            );

            // Rotation pour suivre la direction de la voiture
            mark.rotation.x = -Math.PI / 2; // À plat sur le sol
            mark.rotation.z = getYRotationFromQuaternion(carQuat);

            mark.userData = {
                life: 1.0,
                decay: 0.15, // Disparait lentement
                isRightWheel: offset.x > 0
            };

            this.driftMarks.push(mark);
            this.scene.add(mark);
        });

        // Limiter le nombre de traces
        const maxMarks = 200; // Maximum 200 traces à la fois
        while (this.driftMarks.length > maxMarks) {
            const oldMark = this.driftMarks.shift();
            this.scene.remove(oldMark);
            oldMark.geometry.dispose();
            oldMark.material.dispose();
        }
    }

    /**
     * Met à jour les traces de drift (fade out progressif)
     */
    updateDriftMarks(deltaTime) {
        for (let i = this.driftMarks.length - 1; i >= 0; i--) {
            const mark = this.driftMarks[i];
            const userData = mark.userData;

            // Diminuer la vie
            userData.life -= userData.decay * deltaTime;

            // Fade out progressif
            mark.material.opacity = userData.life * 0.7;

            // Supprimer si mort
            if (userData.life <= 0) {
                this.scene.remove(mark);
                mark.geometry.dispose();
                mark.material.dispose();
                this.driftMarks.splice(i, 1);
            }
        }
    }

    /**
     * Crée des étincelles de drift (bleues ou oranges selon le niveau)
     * @param {number} levelOverride - Niveau optionnel pour les étincelles post-drift
     * @param {number} directionOverride - Direction optionnelle pour les étincelles post-drift
     * @param {boolean} postDrift - Si true, augmente la fréquence pour post-drift
     */
    createDriftSparks(levelOverride = null, directionOverride = null, postDrift = false) {
        // Fréquence augmentée pour les étincelles post-drift
        const frequency = postDrift ? 0.5 : 0.2;
        if (!this.car || Math.random() > frequency) return;

        const carPos = this.car.body.translation();
        const carQuat = this.car.body.rotation();

        // Utiliser le niveau et la direction fournis ou les valeurs actuelles
        const level = levelOverride !== null ? levelOverride : this.driftLevel;
        const direction = directionOverride !== null ? directionOverride : this.driftDirection;

        // Couleur selon le niveau
        let sparkColor;
        if (level === 1) {
            sparkColor = 0x00bbff; // Bleu clair
        } else if (level === 2) {
            sparkColor = 0xff8800; // Orange
        } else {
            return; // Pas d'étincelles sans niveau
        }

        // Créer des étincelles du côté du drift
        // Plus d'étincelles pour post-drift
        const numSparks = postDrift ? 12 : 8;
        for (let i = 0; i < numSparks; i++) {
            // Créer une étincelle (petite ligne)
            const sparkLength = 0.2 + Math.random() * 0.15;
            const sparkGeometry = new THREE.BufferGeometry();

            const positions = new Float32Array([
                0, 0, 0,
                0, -sparkLength, 0
            ]);
            sparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const sparkMaterial = new THREE.LineBasicMaterial({
                color: sparkColor,
                transparent: true,
                opacity: 1.0,
                linewidth: 2
            });

            const spark = new THREE.Line(sparkGeometry, sparkMaterial);

            // Position du côté du drift au niveau des roues (INVERSÉ avec -)
            const offset = {
                x: -direction * (0.5 + Math.random() * 0.2), // Du côté du drift (INVERSÉ)
                y: -0.5, // Au niveau des roues (près du sol)
                z: -1.0 - Math.random() * 0.4
            };
            const worldOffset = rotateVectorByQuaternion(offset, carQuat);

            spark.position.set(
                carPos.x + worldOffset.x,
                carPos.y + worldOffset.y + 0.1, // Légèrement au-dessus du sol
                carPos.z + worldOffset.z
            );

            // Vélocité : vers le haut et légèrement en arrière
            const velocity = new THREE.Vector3(
                -this.driftDirection * (1 + Math.random() * 2), // Vers l'extérieur (INVERSÉ)
                2 + Math.random() * 3, // Vers le haut
                (Math.random() - 0.5) * 2 // Aléatoire avant/arrière
            );

            spark.userData = {
                velocity: velocity,
                life: 1.0,
                decay: 0.05 + Math.random() * 0.03,
                isSpark: true,
                sparkLevel: this.driftLevel,
                rotationSpeed: (Math.random() - 0.5) * 8 // Rotation aléatoire
            };

            this.driftSparks.push(spark);
            this.particles.push(spark);
            this.scene.add(spark);
        }

        // Limiter le nombre d'étincelles
        const maxSparks = 100; // Augmenté de 60 à 100
        while (this.driftSparks.length > maxSparks) {
            const oldSpark = this.driftSparks.shift();
            const particleIndex = this.particles.indexOf(oldSpark);
            if (particleIndex > -1) {
                this.particles.splice(particleIndex, 1);
            }
            this.scene.remove(oldSpark);
            oldSpark.geometry.dispose();
            oldSpark.material.dispose();
        }
    }

    /**
     * Active le mini-turbo après le drift
     */
    activateMiniTurbo(level) {
        if (!this.car) return;

        // Vitesse à ajouter selon le niveau (en unités internes)
        let speedBoostKmh, speedBoostUnits, duration;
        if (level === 1) {
            // Boost bleu : +30 km/h pendant 2 secondes
            speedBoostKmh = 30;
            speedBoostUnits = 30 / 3.6; // ~8.33 unités internes
            duration = 2.0; // secondes
            console.log('💎 MINI-TURBO BLUE! (+30 km/h for 2s)');
        } else if (level === 2) {
            // Boost orange : +50 km/h pendant 3 secondes
            speedBoostKmh = 50;
            speedBoostUnits = 50 / 3.6; // ~13.89 unités internes
            duration = 3.0; // secondes
            console.log('🔥 MINI-TURBO ORANGE! (+50 km/h for 3s)');
        } else {
            return;
        }

        // Activer le système de boost temporaire
        this.miniTurboActive = true;
        this.miniTurboTime = 0;
        this.miniTurboDuration = duration;
        this.miniTurboSpeed = speedBoostUnits;

        // Créer des étincelles de boost
        this.createMiniTurboSparks(level);
    }

    /**
     * Crée des étincelles pour le mini-turbo (explosion d'étincelles)
     */
    createMiniTurboSparks(level) {
        if (!this.car) return;

        const carPos = this.car.body.translation();
        const carQuat = this.car.body.rotation();

        const color = level === 1 ? 0x00bbff : 0xff8800;
        const count = 50; // Beaucoup d'étincelles pour l'explosion (augmenté de 30 à 50)

        for (let i = 0; i < count; i++) {
            // Créer une étincelle (petite ligne)
            const sparkLength = 0.3 + Math.random() * 0.2;
            const sparkGeometry = new THREE.BufferGeometry();

            const positions = new Float32Array([
                0, 0, 0,
                0, -sparkLength, 0
            ]);
            sparkGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const sparkMaterial = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1.0,
                linewidth: 2
            });

            const spark = new THREE.Line(sparkGeometry, sparkMaterial);

            // Position à l'arrière de la voiture au niveau des roues
            const offset = {
                x: (Math.random() - 0.5) * 1.5,
                y: -0.5, // Au niveau des roues
                z: -1.5 - Math.random() * 0.3
            };
            const worldOffset = rotateVectorByQuaternion(offset, carQuat);

            spark.position.set(
                carPos.x + worldOffset.x,
                carPos.y + worldOffset.y + 0.1, // Légèrement au-dessus du sol
                carPos.z + worldOffset.z
            );

            // Vélocité explosive dans toutes les directions
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                Math.random() * 6 + 2,
                (Math.random() - 0.5) * 8
            );

            spark.userData = {
                velocity: velocity,
                life: 1.0,
                decay: 0.04 + Math.random() * 0.02,
                isTurboSpark: true,
                rotationSpeed: (Math.random() - 0.5) * 10 // Rotation aléatoire
            };

            this.driftSparks.push(spark);
            this.particles.push(spark);
            this.scene.add(spark);
        }
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
        const maxParticles = 150; // Augmenté pour plus d'étincelles
        if (this.particles.length > maxParticles) {
            const toRemove = this.particles.length - maxParticles;
            for (let i = 0; i < toRemove; i++) {
                this.scene.remove(this.particles[i]);
                this.particles[i].geometry.dispose();
                this.particles[i].material.dispose();
            }
            this.particles.splice(0, toRemove);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            const userData = particle.userData;

            // Mise à jour position
            particle.position.add(userData.velocity.clone().multiplyScalar(deltaTime));

            // Rotation pour les étincelles (lignes)
            if (userData.rotationSpeed) {
                particle.rotation.x += userData.rotationSpeed * deltaTime;
                particle.rotation.y += userData.rotationSpeed * deltaTime * 0.7;
                particle.rotation.z += userData.rotationSpeed * deltaTime * 0.5;
            }

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

        // SYSTÈME DE DRIFT (Style Mario Kart)
        // Détecter si on est en train de drifter
        const isDriftInput = brake && turn !== 0 && currentSpeed > 5;

        if (isDriftInput && !this.isDrifting) {
            // Début du drift
            this.isDrifting = true;
            this.driftDirection = turn;
            this.driftJumpProgress = 0; // Réinitialiser l'animation de saut
            this.driftTime = 0; // Réinitialiser le temps de drift
            this.driftLevel = 0; // Réinitialiser le niveau
            this.driftLevelStartTime = 0; // Réinitialiser le timer
            console.log('💨 DRIFT START!');
        } else if (!isDriftInput && this.isDrifting) {
            // Fin du drift - déclencher le mini-turbo si niveau > 0
            const hadBoost = this.driftLevel > 0;
            const boostLevel = this.driftLevel;

            this.isDrifting = false;
            this.driftIntensity = 0;
            this.driftJumpProgress = 1; // Terminer le saut

            // Activer les étincelles post-drift si on avait un niveau
            if (hadBoost) {
                this.postDriftSparks = true;
                this.postDriftSparksTime = 0;
                this.postDriftSparksLevel = boostLevel;
                this.postDriftSparksDirection = this.driftDirection; // Stocker la direction
                // Durée selon le niveau : 1.4s pour bleu, 3s pour orange
                this.postDriftSparksDuration = boostLevel === 1 ? 1.4 : 3.0;
                console.log(`✨ Post-drift sparks started: Level ${boostLevel}, Duration ${this.postDriftSparksDuration}s`);

                this.activateMiniTurbo(boostLevel);
            }

            this.driftTime = 0;
            this.driftLevel = 0;
            this.driftLevelStartTime = 0;

            console.log('🏁 DRIFT END!');
        }

        // Mettre à jour l'animation du saut (rapide au début)
        if (this.driftJumpProgress < 1) {
            this.driftJumpProgress = Math.min(this.driftJumpProgress + deltaTime * 6, 1.0);
        }

        // Mettre à jour l'intensité du drift
        if (this.isDrifting) {
            this.driftIntensity = Math.min(this.driftIntensity + deltaTime * 2, 1.0);

            // Accumuler le temps de drift
            this.driftTime += deltaTime;

            // Déterminer le niveau de drift (Mario Kart style)
            if (this.driftTime >= 1.0 && this.driftLevel < 1) {
                // Niveau 1 : Étincelles BLEUES déclenchées
                this.driftLevel = 1;
                this.driftLevelStartTime = this.driftTime;
                console.log('💎 DRIFT LEVEL 1 - BLUE!');
            } else if (this.driftTime >= (this.driftLevelStartTime + 1.4) && this.driftLevel === 1) {
                // Niveau 2 : Étincelles ORANGE déclenchées après 1.4s de bleu
                this.driftLevel = 2;
                this.driftLevelStartTime = this.driftTime;
                console.log('🔥 DRIFT LEVEL 2 - ORANGE!');
            }

            // Créer des étincelles selon le niveau et la durée
            const timeSinceLevelStart = this.driftTime - this.driftLevelStartTime;

            if (this.driftLevel === 1 && timeSinceLevelStart <= 1.4) {
                // Étincelles bleues pendant 1.4 secondes
                this.createDriftSparks();
            } else if (this.driftLevel === 2 && timeSinceLevelStart <= 3.0) {
                // Étincelles orange pendant 3 secondes
                this.createDriftSparks();
            }
        } else {
            this.driftIntensity = Math.max(this.driftIntensity - deltaTime * 4, 0);
        }

        // Gérer les étincelles post-drift (après avoir relâché le drift)
        if (this.postDriftSparks) {
            this.postDriftSparksTime += deltaTime;

            if (this.postDriftSparksTime <= this.postDriftSparksDuration) {
                // Continuer à créer des étincelles avec le niveau et la direction stockés
                // postDrift=true pour plus d'étincelles
                this.createDriftSparks(this.postDriftSparksLevel, this.postDriftSparksDirection, true);
            } else {
                // Arrêter les étincelles
                this.postDriftSparks = false;
                console.log('🛑 Post-drift sparks ended');
            }
        }

        // DIRECTION - Tourner la voiture
        if (turn !== 0 && currentSpeed > 0.1) {
            // Facteur de vitesse plus progressif et adapté
            const speedFactor = Math.min(Math.sqrt(currentSpeed / 12), 1.2); // Racine carrée pour courbe plus douce

            // En drift, contrôle doux pour suivre les virages sans tourner en cercle
            let maxTurnRate;
            let lateralFriction; // Friction latérale

            if (this.isDrifting) {
                // Drift : rotation douce et contrôlée pour suivre les virages
                maxTurnRate = 1.2; // Réduit à 1.2 pour un contrôle progressif et fluide
                lateralFriction = 0.92; // Friction élevée pour suivre la trajectoire sans trop glisser
            } else {
                // Normal : virages standards
                maxTurnRate = 3.5; // Excellente réactivité
                lateralFriction = 0.93; // Friction haute pour bon grip
            }

            // Inverser si marche arrière
            const isReversing = signedSpeed < -0.1;
            const actualTurn = isReversing ? -turn : turn;

            // Appliquer la rotation directement
            const turnAmount = actualTurn * maxTurnRate * speedFactor * deltaTime;
            const newYRotation = yRotation + turnAmount;
            const newQuat = quaternionFromYRotation(newYRotation);
            carBody.setRotation(newQuat, true);

            // Appliquer friction latérale (glisse contrôlée en drift)
            if (currentSpeed > 2.5) { // Seuil abaissé pour activation plus précoce
                // Calculer la vélocité latérale
                const rightDirLocal = { x: 1, y: 0, z: 0 };
                const rightDir = rotateVectorByQuaternion(rightDirLocal, carQuat);

                const currentVelVec = { x: currentVel.x, y: 0, z: currentVel.z };
                const lateralDot = currentVelVec.x * rightDir.x + currentVelVec.z * rightDir.z;

                // Réduire la vélocité latérale selon la friction (plus progressif)
                const lateralReduction = lateralDot * (1 - lateralFriction);

                // Appliquer avec facteur de vitesse pour effet progressif
                const reductionFactor = Math.min(currentSpeed / 15, 1.0);

                carBody.setLinvel({
                    x: currentVel.x - rightDir.x * lateralReduction * reductionFactor,
                    y: currentVel.y,
                    z: currentVel.z - rightDir.z * lateralReduction * reductionFactor
                }, true);
            }

            // Créer des traces de drift si on drifte
            if (this.isDrifting && this.driftIntensity > 0.3) {
                this.createDriftMark();
            }
        }

        // MOUVEMENT - Accélération/Freinage (plus fluide et réactif)
        if (forward !== 0) {
            const baseAcceleration = this.boostActive ? 55 : 40; // Augmenté pour meilleure réactivité
            const currentModeSettings = this.drivingModes[this.drivingMode];
            const maxSpeed = this.boostActive ? currentModeSettings.boostMaxSpeed : currentModeSettings.maxSpeed;
            const maxReverseSpeed = maxSpeed * 0.65;

            // Créer des particules de boost
            if (this.boostActive && forward > 0) {
                this.createBoostParticles();
            }

            if (forward > 0) {
                // Avancer
                if (signedSpeed < 0) {
                    // Freiner si on recule (très rapide)
                    signedSpeed = Math.min(signedSpeed + baseAcceleration * 2.2 * deltaTime, 0);
                } else {
                    // Accélération avec courbe réaliste (rapide au début, ralentit près de la vitesse max)
                    const speedRatio = signedSpeed / maxSpeed;

                    // Courbe d'accélération : puissante au début (0-50% vitesse), puis progressive
                    let accelFactor;
                    if (speedRatio < 0.5) {
                        // Phase 1 : Accélération maximale (0-50% vitesse max)
                        accelFactor = 1.0;
                    } else if (speedRatio < 0.8) {
                        // Phase 2 : Accélération modérée (50-80% vitesse max)
                        accelFactor = 0.75;
                    } else {
                        // Phase 3 : Accélération réduite proche de la vitesse max (80-100%)
                        accelFactor = 0.4;
                    }

                    const acceleration = baseAcceleration * accelFactor;
                    signedSpeed = Math.min(signedSpeed + acceleration * deltaTime, maxSpeed);
                }
            } else {
                // Reculer
                if (signedSpeed > 0.3) {
                    // Freiner si on avance (très efficace)
                    signedSpeed = Math.max(signedSpeed - baseAcceleration * 3.0 * deltaTime, 0);
                } else {
                    // Marche arrière (accélération progressive)
                    const reverseAccelFactor = Math.min(Math.abs(signedSpeed) / maxReverseSpeed, 1.0);
                    const reverseAccel = baseAcceleration * (1.0 - reverseAccelFactor * 0.5);
                    signedSpeed = Math.max(signedSpeed - reverseAccel * 0.7 * deltaTime, -maxReverseSpeed);
                }
            }
        } else if (brake && !this.isDrifting) {
            // Frein à main simple (quand pas en drift) - plus efficace
            signedSpeed *= 0.65;
        } else if (this.isDrifting) {
            // En drift, conserver toute la vitesse pour suivre les virages en avançant (Mario Kart style)
            signedSpeed *= 0.99; // Presque aucune perte de vitesse pour un drift fluide
        } else {
            // Friction naturelle - décélération progressive selon vitesse
            const speedAbs = Math.abs(signedSpeed);
            let frictionFactor;

            if (speedAbs > 20) {
                // Haute vitesse : friction modérée (résistance de l'air)
                frictionFactor = 0.94;
            } else if (speedAbs > 10) {
                // Vitesse moyenne : friction légère
                frictionFactor = 0.96;
            } else {
                // Basse vitesse : friction minimale
                frictionFactor = 0.97;
            }

            signedSpeed *= frictionFactor;
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

        // MINI-TURBO BOOST - Appliquer le boost de vitesse temporaire
        if (this.miniTurboActive) {
            this.miniTurboTime += deltaTime;

            if (this.miniTurboTime <= this.miniTurboDuration) {
                // Ajouter la vitesse de boost dans la direction du mouvement
                const currentSpeed = Math.abs(signedSpeed);
                if (currentSpeed > 0.1) {
                    const dirX = forwardDir.x;
                    const dirZ = forwardDir.z;

                    // Ajouter le boost à la vitesse actuelle
                    const boostedVelocity = {
                        x: newVelocity.x + dirX * this.miniTurboSpeed,
                        y: newVelocity.y,
                        z: newVelocity.z + dirZ * this.miniTurboSpeed
                    };

                    carBody.setLinvel(boostedVelocity, true);

                    // Mettre à jour la vitesse affichée
                    const boostedSpeed = Math.sqrt(
                        boostedVelocity.x * boostedVelocity.x +
                        boostedVelocity.z * boostedVelocity.z
                    );
                    car.speed = boostedSpeed;
                }
            } else {
                // Désactiver le boost après la durée
                this.miniTurboActive = false;
                console.log('⚡ Mini-turbo ended');
            }
        }

        // Sauvegarder la vitesse signée pour le prochain frame
        this.car.currentSpeed = signedSpeed;
        if (!this.miniTurboActive) {
            car.speed = Math.abs(signedSpeed);
        }
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

    toggleDrivingMode() {
        // Basculer entre normal et sport
        this.drivingMode = this.drivingMode === 'normal' ? 'sport' : 'normal';

        // Mettre à jour la vitesse max de la voiture
        if (this.car) {
            this.car.maxSpeed = this.drivingModes[this.drivingMode].maxSpeed;
        }

        // Afficher un message
        const currentMode = this.drivingModes[this.drivingMode];
        const modeName = this.drivingMode === 'sport' ? 'SPORT 🏎️' : 'NORMAL 🚗';
        console.log(`🔧 Mode de conduite : ${modeName}`);
        console.log(`   Vitesse max : ${Math.round(currentMode.maxSpeed * 3.6)} km/h`);
        console.log(`   Boost max : ${Math.round(currentMode.boostMaxSpeed * 3.6)} km/h`);

        // Mettre à jour le HUD
        this.updateDrivingModeHUD();

        // Afficher un popup visuel
        this.showDrivingModePopup(modeName, currentMode);
    }

    updateDrivingModeHUD() {
        const currentMode = this.drivingModes[this.drivingMode];
        const isSport = this.drivingMode === 'sport';

        // Mettre à jour le texte (convertir en km/h pour l'affichage)
        const modeNameEl = document.getElementById('mode-name');
        const modeIconEl = document.getElementById('mode-icon');
        const modeMaxSpeedEl = document.getElementById('mode-max-speed');
        const modeBoostSpeedEl = document.getElementById('mode-boost-speed');
        const modePanelEl = document.getElementById('driving-mode-panel');

        if (modeNameEl) modeNameEl.textContent = isSport ? 'SPORT' : 'NORMAL';
        if (modeIconEl) modeIconEl.textContent = isSport ? '🏎️' : '🚗';
        if (modeMaxSpeedEl) modeMaxSpeedEl.textContent = Math.round(currentMode.maxSpeed * 3.6);
        if (modeBoostSpeedEl) modeBoostSpeedEl.textContent = Math.round(currentMode.boostMaxSpeed * 3.6);

        // Mettre à jour les couleurs du panneau
        if (modePanelEl) {
            if (isSport) {
                modePanelEl.style.background = 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(255, 68, 68, 0.1))';
                modePanelEl.style.borderColor = 'rgba(255, 68, 68, 0.3)';
                if (modeNameEl) modeNameEl.style.color = '#ff4444';
            } else {
                modePanelEl.style.background = 'linear-gradient(135deg, rgba(68, 255, 68, 0.2), rgba(68, 255, 68, 0.1))';
                modePanelEl.style.borderColor = 'rgba(68, 255, 68, 0.3)';
                if (modeNameEl) modeNameEl.style.color = '#44ff44';
            }
        }
    }

    showDrivingModePopup(modeName, modeSettings) {
        // Créer un popup temporaire
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.95));
            color: white;
            padding: 30px 50px;
            border-radius: 15px;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: bold;
            z-index: 10000;
            text-align: center;
            border: 3px solid ${this.drivingMode === 'sport' ? '#ff4444' : '#44ff44'};
            box-shadow: 0 0 30px ${this.drivingMode === 'sport' ? 'rgba(255,68,68,0.5)' : 'rgba(68,255,68,0.5)'};
            animation: popup-appear 0.3s ease-out;
        `;

        popup.innerHTML = `
            <div style="font-size: 32px; margin-bottom: 15px;">${modeName}</div>
            <div style="font-size: 18px; opacity: 0.8;">
                Vitesse max : ${Math.round(modeSettings.maxSpeed * 3.6)} km/h<br>
                Boost max : ${Math.round(modeSettings.boostMaxSpeed * 3.6)} km/h
            </div>
        `;

        // Ajouter l'animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes popup-appear {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.8);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(popup);

        // Retirer le popup après 2 secondes
        setTimeout(() => {
            popup.style.transition = 'opacity 0.3s ease-out';
            popup.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(popup);
                document.head.removeChild(style);
            }, 300);
        }, 2000);
    }

    loadCarSkin(carGroup, skinId) {
        const skin = this.availableSkins.find(s => s.id === skinId);
        if (!skin) {
            console.error(`❌ Skin not found: ${skinId}`);
            return;
        }

        console.log(`🎨 Loading skin: ${skin.name}`);

        const loader = new GLTFLoader();
        loader.load(
            skin.path,
            (gltf) => {
                console.log(`✅ ${skin.name} model loaded successfully!`);

                const model = gltf.scene;

                // ÉTAPE 1 : Calculer la bounding box AVANT scaling
                const bbox = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                bbox.getSize(size);

                // ÉTAPE 2 : Normaliser la taille - on veut que la longueur soit d'environ 4.5 unités
                const TARGET_LENGTH = 4.5; // Taille cible en unités (réduite pour véhicules plus petits)

                // Utiliser la plus grande dimension (longueur ou largeur) comme référence
                const maxDimension = Math.max(size.x, size.z);
                const normalizedScale = TARGET_LENGTH / maxDimension;

                console.log(`📏 ${skin.name} - Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
                console.log(`📏 ${skin.name} - Normalized scale: ${normalizedScale.toFixed(3)}`);

                // Appliquer l'échelle normalisée
                model.scale.set(normalizedScale, normalizedScale, normalizedScale);

                // ÉTAPE 3 : Recalculer la bounding box après scaling
                bbox.setFromObject(model);
                const center = new THREE.Vector3();
                bbox.getCenter(center);
                bbox.getSize(size);

                // ÉTAPE 4 : Centrer le modèle horizontalement (X et Z)
                model.position.set(-center.x, 0, -center.z);

                // ÉTAPE 5 : Aligner le bas du modèle avec le corps physique
                const yMin = bbox.min.y;
                model.position.y = -yMin + skin.yOffset;

                console.log(`📐 ${skin.name} - Final size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);

                // Améliorer les matériaux pour de beaux reflets
                model.traverse((child) => {
                    if (child.isMesh) {
                        // Activer les ombres
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // Améliorer le matériau pour les reflets
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];

                            materials.forEach(material => {
                                // S'assurer que c'est un MeshStandardMaterial ou MeshPhysicalMaterial
                                if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
                                    // Garder les valeurs par défaut du modèle
                                    material.needsUpdate = true;
                                }
                            });
                        }
                    }
                });

                // Optimiser les textures
                if (this.renderer) {
                    optimizeModel(model, this.renderer);
                }

                // Retirer l'ancien modèle s'il existe
                const oldModel = carGroup.children.find(child => child.userData.isSkin);
                if (oldModel) {
                    carGroup.remove(oldModel);
                }

                // Marquer le modèle comme skin
                model.userData.isSkin = true;

                // Ajouter le nouveau modèle au groupe
                carGroup.add(model);

                console.log(`🏎️ ${skin.name} added to car group`);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(0);
                console.log(`Loading ${skin.name}: ${percent}%`);
            },
            (error) => {
                console.error(`❌ Error loading ${skin.name} model:`, error);
            }
        );
    }

    changeCarSkin(skinId) {
        if (!this.car) return;

        const skin = this.availableSkins.find(s => s.id === skinId);
        if (!skin) {
            console.error(`❌ Skin not found: ${skinId}`);
            return;
        }

        this.currentSkinId = skinId;
        this.loadCarSkin(this.car.mesh, skinId);

        console.log(`✨ Changed to skin: ${skin.name}`);
    }

    toggleGarage() {
        this.garageOpen = !this.garageOpen;

        if (this.garageOpen) {
            this.openGarage();
        } else {
            this.closeGarage();
        }
    }

    openGarage() {
        console.log('🔧 Opening garage...');

        // Créer l'interface du garage avec scroll
        const garageUI = document.createElement('div');
        garageUI.id = 'garage-ui';
        garageUI.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        garageUI.innerHTML = `
            <!-- Header fixe -->
            <div style="
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95));
                border-bottom: 3px solid rgba(255, 170, 0, 0.5);
                padding: 30px;
                text-align: center;
                flex-shrink: 0;
            ">
                <h2 style="color: #ffaa00; font-size: 42px; margin: 0 0 10px 0; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 3px;">
                    🔧 Garage
                </h2>
                <p style="color: #888; font-size: 16px; margin: 0;">
                    Choisissez votre véhicule (${this.availableSkins.length} disponibles)
                </p>
            </div>

            <!-- Zone scrollable -->
            <div style="
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 40px;
            ">
                <div id="skin-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 25px;
                    max-width: 1400px;
                    margin: 0 auto;
                ">
                    ${this.availableSkins.map(skin => `
                        <div class="skin-card" data-skin-id="${skin.id}" style="
                            background: ${this.currentSkinId === skin.id ? 'linear-gradient(135deg, rgba(255, 170, 0, 0.3), rgba(255, 170, 0, 0.1))' : 'rgba(255, 255, 255, 0.05)'};
                            border: 3px solid ${this.currentSkinId === skin.id ? '#ffaa00' : 'rgba(255, 255, 255, 0.1)'};
                            border-radius: 15px;
                            padding: 25px;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            text-align: center;
                            position: relative;
                        ">
                            <div style="font-size: 64px; margin-bottom: 15px;">${skin.thumbnail}</div>
                            <div style="color: white; font-weight: bold; font-size: 15px; margin-bottom: 8px; line-height: 1.3;">
                                ${skin.name}
                            </div>
                            ${this.currentSkinId === skin.id ? `
                                <div style="
                                    background: linear-gradient(90deg, #ffaa00, #ff8800);
                                    color: #000;
                                    font-size: 11px;
                                    font-weight: bold;
                                    padding: 6px 12px;
                                    border-radius: 20px;
                                    margin-top: 10px;
                                ">
                                    ✓ ÉQUIPÉ
                                </div>
                            ` : `
                                <div style="
                                    color: #666;
                                    font-size: 11px;
                                    margin-top: 10px;
                                ">
                                    Cliquer pour équiper
                                </div>
                            `}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Footer fixe -->
            <div style="
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95));
                border-top: 3px solid rgba(255, 170, 0, 0.5);
                padding: 25px;
                text-align: center;
                flex-shrink: 0;
            ">
                <button id="close-garage-btn" style="
                    background: linear-gradient(135deg, #ff6b6b, #ff4444);
                    color: white;
                    border: none;
                    padding: 15px 50px;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);
                ">
                    FERMER (G)
                </button>
            </div>
        `;

        document.body.appendChild(garageUI);

        // Ajouter les événements de clic sur les skins
        document.querySelectorAll('.skin-card').forEach(card => {
            card.addEventListener('click', () => {
                const skinId = card.getAttribute('data-skin-id');
                this.changeCarSkin(skinId);
                this.closeGarage();
                setTimeout(() => this.openGarage(), 100);
            });

            // Effet hover
            card.addEventListener('mouseenter', () => {
                if (card.getAttribute('data-skin-id') !== this.currentSkinId) {
                    card.style.background = 'rgba(255, 255, 255, 0.1)';
                    card.style.borderColor = 'rgba(255, 170, 0, 0.5)';
                    card.style.transform = 'scale(1.05)';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (card.getAttribute('data-skin-id') !== this.currentSkinId) {
                    card.style.background = 'rgba(255, 255, 255, 0.05)';
                    card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    card.style.transform = 'scale(1)';
                }
            });
        });

        // Bouton fermer
        document.getElementById('close-garage-btn').addEventListener('click', () => {
            this.toggleGarage();
        });

        // Effet hover sur le bouton
        const closeBtn = document.getElementById('close-garage-btn');
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.transform = 'scale(1.05)';
            closeBtn.style.boxShadow = '0 0 20px rgba(255, 68, 68, 0.5)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.transform = 'scale(1)';
            closeBtn.style.boxShadow = 'none';
        });
    }

    closeGarage() {
        console.log('🔧 Closing garage...');
        const garageUI = document.getElementById('garage-ui');
        if (garageUI) {
            garageUI.remove();
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

        // Skip physics updates if Photo Mode is active
        const isPhotoModeActive = this.photoMode && this.photoMode.isActive;

        // Accumuler le temps
        this.timeAccumulator += deltaTime;

        // Mise à jour physique avec fixed timestep pour mouvement fluide
        const maxIterations = 5; // Limiter pour éviter les boucles infinies
        let iterations = 0;

        while (this.timeAccumulator >= this.fixedTimeStep && iterations < maxIterations && !isPhotoModeActive) {
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

            // Position avec mini-saut au début du drift
            let targetY = carPos.y;

            // Animation de saut au début du drift (courbe en cloche)
            if (this.isDrifting && this.driftJumpProgress < 0.5) {
                // Saut qui monte puis redescend (fonction sin)
                const jumpHeight = 0.4; // Hauteur du saut en mètres
                const jumpCurve = Math.sin(this.driftJumpProgress * Math.PI); // 0 → 1 → 0
                targetY += jumpHeight * jumpCurve;
            }

            this.car.mesh.position.lerp(
                new THREE.Vector3(carPos.x, targetY, carPos.z),
                0.3
            );

            // Rotation de base (du corps physique)
            const baseQuat = new THREE.Quaternion(carRot.x, carRot.y, carRot.z, carRot.w);

            // Ajouter l'inclinaison de drift (effet deux roues)
            if (this.isDrifting && this.driftIntensity > 0.1) {
                // Calculer l'angle d'inclinaison (roll) en fonction de l'intensité et de la direction
                const maxTiltAngle = Math.PI / 5; // 36 degrés maximum pour effet prononcé
                const tiltAngle = this.driftDirection * this.driftIntensity * maxTiltAngle; // INVERSÉ (retiré le -)

                // Convertir le quaternion de base en Euler pour modifier le roll
                const euler = new THREE.Euler();
                euler.setFromQuaternion(baseQuat, 'YXZ');

                // Ajouter l'inclinaison latérale (roll sur l'axe Z)
                euler.z = tiltAngle;

                // Reconvertir en quaternion
                baseQuat.setFromEuler(euler);
            }

            // Appliquer la rotation finale avec interpolation fluide
            this.car.mesh.quaternion.slerp(baseQuat, 0.15);
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

        // Mise à jour du système météo
        if (this.weatherSystem) {
            this.weatherSystem.update(deltaTime);
            this.weatherSystem.updateIndicator();
        }

        // Mise à jour des traces de drift
        this.updateDriftMarks(deltaTime);

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
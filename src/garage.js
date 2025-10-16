import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

console.log('Starting Garage 3D view...');

class GarageView {
    constructor() {
        this.clock = new THREE.Clock();
        this.car = null;
        this.carBody = null;
        this.carCabin = null;

        // Système de peinture
        this.paintMode = false;
        this.selectedColor = '#ff0000';
        this.selectedPart = 'body';
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Couleurs de la voiture (pour sauvegarde)
        this.carColors = {
            body: '#ff0000',
            cabin: '#cc0000',
            wheels: '#333333'
        };

        this.init();
    }

    init() {
        console.log('Initializing Garage...');

        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLights();
        this.createGarageEnvironment();
        this.loadCarColors(); // Charger les couleurs sauvegardées
        this.createCar();
        this.setupPaintEvents();

        this.animate();

        console.log('Garage initialized successfully!');
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x444444);
        this.scene.fog = new THREE.Fog(0x444444, 10, 50);
        console.log('Scene created');
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(8, 4, 8);
        this.camera.lookAt(0, 1, 0);
        console.log('Camera created');
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        const container = document.getElementById('canvas-container');
        container.appendChild(this.renderer.domElement);
        console.log('Renderer created');
    }

    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1, 0);
        this.controls.minDistance = 3;
        this.controls.maxDistance = 15;
        this.controls.maxPolarAngle = Math.PI / 2;
        console.log('Controls created');
    }

    createLights() {
        // Lumière ambiante forte pour bien éclairer la scène
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Lumière hémisphérique pour un éclairage naturel
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        hemisphereLight.position.set(0, 10, 0);
        this.scene.add(hemisphereLight);

        // Lumière directionnelle principale
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        // Lumière de remplissage
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // Point lights pour accentuer la voiture
        const pointLight1 = new THREE.PointLight(0xffffff, 2, 20);
        pointLight1.position.set(3, 3, 3);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xffffff, 2, 20);
        pointLight2.position.set(-3, 3, -3);
        this.scene.add(pointLight2);

        console.log('Lights created with improved brightness');
    }

    createGarageEnvironment() {
        // Sol réfléchissant
        const floorGeometry = new THREE.CircleGeometry(15, 64);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grille au sol
        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Murs du garage (cylindre)
        const wallGeometry = new THREE.CylinderGeometry(12, 12, 10, 32, 1, true);
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.BackSide
        });
        const walls = new THREE.Mesh(wallGeometry, wallMaterial);
        walls.position.y = 5;
        this.scene.add(walls);

        console.log('Garage environment created');
    }

    createCar() {
        console.log('Creating car...');

        const carGroup = new THREE.Group();

        // Corps de la voiture
        const bodyGeometry = new THREE.BoxGeometry(1.8, 0.8, 3);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.carColors.body),
            metalness: 0.6,
            roughness: 0.3
        });
        this.carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.carBody.position.y = 0.5;
        this.carBody.castShadow = true;
        this.carBody.name = 'carBody';
        carGroup.add(this.carBody);

        // Cabine
        const cabinGeometry = new THREE.BoxGeometry(1.6, 0.6, 1.8);
        const cabinMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.carColors.cabin),
            metalness: 0.6,
            roughness: 0.3
        });
        this.carCabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        this.carCabin.position.set(0, 1.1, -0.2);
        this.carCabin.castShadow = true;
        this.carCabin.name = 'carCabin';
        carGroup.add(this.carCabin);

        // Vitres
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 1,
            roughness: 0.05,
            transparent: true,
            opacity: 0.3
        });

        const frontWindowGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.1);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, 1.1, 0.7);
        carGroup.add(frontWindow);

        const backWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        backWindow.position.set(0, 1.1, -1.1);
        carGroup.add(backWindow);

        // Roues
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.carColors.wheels),
            metalness: 0.5,
            roughness: 0.5
        });

        const wheelPositions = [
            { x: -1.0, y: 0.4, z: 1.0 },
            { x: 1.0, y: 0.4, z: 1.0 },
            { x: -1.0, y: 0.4, z: -1.0 },
            { x: 1.0, y: 0.4, z: -1.0 }
        ];

        this.wheels = [];
        wheelPositions.forEach((pos, index) => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheel.name = `wheel${index}`;
            carGroup.add(wheel);
            this.wheels.push(wheel);
        });

        // Phares avant
        const lightGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            emissive: 0xffffaa,
            emissiveIntensity: 1,
            metalness: 0.8,
            roughness: 0.2
        });

        const leftLight = new THREE.Mesh(lightGeometry, lightMaterial);
        leftLight.position.set(-0.7, 0.6, 1.51);
        carGroup.add(leftLight);

        const rightLight = new THREE.Mesh(lightGeometry, lightMaterial);
        rightLight.position.set(0.7, 0.6, 1.51);
        carGroup.add(rightLight);

        // Feux arrière
        const tailLightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        });

        const leftTailLight = new THREE.Mesh(lightGeometry, tailLightMaterial);
        leftTailLight.position.set(-0.7, 0.6, -1.51);
        carGroup.add(leftTailLight);

        const rightTailLight = new THREE.Mesh(lightGeometry, tailLightMaterial);
        rightTailLight.position.set(0.7, 0.6, -1.51);
        carGroup.add(rightTailLight);

        carGroup.position.y = 0.1;
        this.scene.add(carGroup);

        this.car = carGroup;

        console.log('Car created successfully!');
    }

    changeCarColor(colorName) {
        if (!this.carBody || !this.carCabin) return;

        const colors = {
            red: { body: '#ff0000', cabin: '#cc0000' },
            blue: { body: '#0066ff', cabin: '#0044cc' },
            green: { body: '#00cc00', cabin: '#009900' },
            yellow: { body: '#ffdd00', cabin: '#ccaa00' },
            purple: { body: '#cc00ff', cabin: '#9900cc' },
            orange: { body: '#ff6600', cabin: '#cc5500' }
        };

        if (colors[colorName]) {
            const bodyColor = colors[colorName].body;
            const cabinColor = colors[colorName].cabin;

            this.carBody.material.color.set(new THREE.Color(bodyColor));
            this.carCabin.material.color.set(new THREE.Color(cabinColor));

            // Mettre à jour les couleurs sauvegardées
            this.carColors.body = bodyColor;
            this.carColors.cabin = cabinColor;

            // Sauvegarder
            this.saveCarColors();

            console.log(`Car color changed to ${colorName}`, this.carColors);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        // Rotation automatique lente de la voiture
        if (this.car) {
            this.car.rotation.y += 0.002;
        }

        // Rotation des roues
        if (this.wheels) {
            this.wheels.forEach(wheel => {
                wheel.rotation.x += 0.01;
            });
        }

        // Mise à jour des contrôles
        this.controls.update();

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Système de peinture
    setupPaintEvents() {
        // Événement de clic pour peindre
        this.renderer.domElement.addEventListener('click', (event) => {
            if (this.paintMode) {
                this.onPaintClick(event);
            }
        });

        // Événement de mouvement pour le curseur
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.updateMousePosition(event);
            if (this.paintMode) {
                this.checkHover();
            }
        });

        console.log('Paint events setup complete');
    }

    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const paintableObjects = [this.carBody, this.carCabin, ...this.wheels];
        const intersects = this.raycaster.intersectObjects(paintableObjects);

        if (intersects.length > 0) {
            this.renderer.domElement.style.cursor = 'crosshair';
        } else {
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    onPaintClick(event) {
        console.log('🎨 Paint click detected!');
        console.log('Paint mode:', this.paintMode);
        console.log('Selected color:', this.selectedColor);
        console.log('Selected part:', this.selectedPart);

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const paintableObjects = [this.carBody, this.carCabin, ...this.wheels];
        console.log('Paintable objects:', paintableObjects.length);

        const intersects = this.raycaster.intersectObjects(paintableObjects);
        console.log('Intersections found:', intersects.length);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            console.log('Clicked object name:', clickedObject.name);

            // Déterminer quelle partie a été cliquée
            let partType = '';
            if (clickedObject === this.carBody) {
                partType = 'body';
            } else if (clickedObject === this.carCabin) {
                partType = 'cabin';
            } else if (this.wheels.includes(clickedObject)) {
                partType = 'wheels';
            }

            console.log('Part type detected:', partType);

            // Appliquer la couleur selon la sélection
            if (this.selectedPart === 'all') {
                console.log('Painting all parts');
                this.paintCarPart('body', this.selectedColor);
                this.paintCarPart('cabin', this.selectedColor);
                this.paintCarPart('wheels', this.selectedColor);
            } else if (this.selectedPart === partType || this.selectedPart === 'all') {
                console.log(`Painting ${partType}`);
                this.paintCarPart(partType, this.selectedColor);
            } else {
                console.log(`Selected part (${this.selectedPart}) doesn't match clicked part (${partType})`);
            }

            console.log(`✅ Painted ${partType} with color ${this.selectedColor}`);
        } else {
            console.log('❌ No intersection found with car parts');
        }
    }

    paintCarPart(part, color) {
        console.log(`🎨 paintCarPart called: part=${part}, color=${color}`);
        const colorObj = new THREE.Color(color);

        switch(part) {
            case 'body':
                if (this.carBody) {
                    console.log('Painting body, old color:', this.carBody.material.color.getHexString());
                    this.carBody.material.color.set(colorObj);
                    this.carColors.body = color;
                    console.log('New body color:', this.carBody.material.color.getHexString());
                } else {
                    console.log('❌ carBody is null!');
                }
                break;
            case 'cabin':
                if (this.carCabin) {
                    console.log('Painting cabin, old color:', this.carCabin.material.color.getHexString());
                    this.carCabin.material.color.set(colorObj);
                    this.carColors.cabin = color;
                    console.log('New cabin color:', this.carCabin.material.color.getHexString());
                } else {
                    console.log('❌ carCabin is null!');
                }
                break;
            case 'wheels':
                if (this.wheels && this.wheels.length > 0) {
                    console.log(`Painting ${this.wheels.length} wheels`);
                    this.wheels.forEach((wheel, index) => {
                        console.log(`Wheel ${index} old color:`, wheel.material.color.getHexString());
                        wheel.material.color.set(colorObj);
                        console.log(`Wheel ${index} new color:`, wheel.material.color.getHexString());
                    });
                    this.carColors.wheels = color;
                } else {
                    console.log('❌ wheels array is empty or null!');
                }
                break;
            default:
                console.log('❌ Unknown part:', part);
        }

        // Sauvegarder automatiquement après chaque changement
        this.saveCarColors();
    }

    // Méthodes appelées depuis le HTML
    setPaintMode(active) {
        this.paintMode = active;
        console.log(`Paint mode: ${active ? 'ON' : 'OFF'}`);

        if (!active) {
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    setSelectedColor(color) {
        this.selectedColor = color;
        console.log(`Selected color: ${color}`);
    }

    setSelectedPart(part) {
        this.selectedPart = part;
        console.log(`Selected part: ${part}`);
    }

    // Système de sauvegarde
    saveCarColors() {
        try {
            localStorage.setItem('carCustomization', JSON.stringify(this.carColors));
            console.log('💾 Car colors saved:', this.carColors);
        } catch (error) {
            console.error('❌ Error saving car colors:', error);
        }
    }

    loadCarColors() {
        try {
            const saved = localStorage.getItem('carCustomization');
            if (saved) {
                const loadedColors = JSON.parse(saved);
                this.carColors = {
                    body: loadedColors.body || '#ff0000',
                    cabin: loadedColors.cabin || '#cc0000',
                    wheels: loadedColors.wheels || '#333333'
                };
                console.log('📂 Car colors loaded:', this.carColors);
            } else {
                console.log('No saved car colors found, using defaults');
            }
        } catch (error) {
            console.error('❌ Error loading car colors:', error);
        }
    }
}

// Créer l'application et la rendre accessible globalement
window.garageApp = new GarageView();

// Gérer le redimensionnement
window.addEventListener('resize', () => {
    if (window.garageApp) {
        window.garageApp.onWindowResize();
    }
});

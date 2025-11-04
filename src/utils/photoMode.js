/**
 * Photo Mode - Mode Photo Professionnel
 * Permet de prendre des screenshots avec contrôles avancés
 * Inspiré des photo modes de jeux AAA (Gran Turismo, Forza Horizon)
 */

import * as THREE from 'three';

export class PhotoMode {
    constructor(app) {
        this.app = app;
        this.isActive = false;
        this.originalCameraState = null;
        this.freezeFrame = null;

        // UI Elements
        this.overlay = null;
        this.panel = null;

        // Photo settings
        this.settings = {
            filter: 'none',
            dofEnabled: false,
            dofStrength: 3.0,
            dofFocus: 10.0,
            vignette: 0.5,
            brightness: 0,
            contrast: 1,
            saturation: 1,
            frameStyle: 'none',
            showUI: true,
            timestamp: true,
            watermark: true
        };

        // Filters presets
        this.filters = {
            none: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            cinematic: { brightness: -0.05, contrast: 1.3, saturation: 0.9, hue: 0 },
            bw: { brightness: 0.05, contrast: 1.2, saturation: 0, hue: 0 },
            vintage: { brightness: 0.1, contrast: 0.9, saturation: 0.7, hue: 0.05 },
            vibrant: { brightness: 0.05, contrast: 1.1, saturation: 1.4, hue: 0 },
            sunset: { brightness: 0, contrast: 1, saturation: 1.1, hue: 0.03 },
            neon: { brightness: 0.1, contrast: 1.3, saturation: 1.5, hue: 0.5 }
        };

        this.createUI();
    }

    /**
     * Active/Désactive le Photo Mode
     */
    toggle() {
        if (this.isActive) {
            this.exit();
        } else {
            this.enter();
        }
    }

    /**
     * Entre en Photo Mode
     */
    enter() {
        console.log('📸 Entering Photo Mode...');

        this.isActive = true;

        // Sauvegarder l'état de la caméra
        this.originalCameraState = {
            position: this.app.camera.position.clone(),
            rotation: this.app.camera.rotation.clone(),
            fov: this.app.camera.fov,
            manualControl: this.app.cameraManualControl
        };

        // Freeze le jeu (sauvegarder vitesse de la voiture)
        if (this.app.car) {
            this.freezeFrame = {
                carSpeed: this.app.car.speed,
                carVelocity: this.app.car.body.linvel()
            };
            // Arrêter la voiture
            this.app.car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
            this.app.car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
            this.app.car.speed = 0;
        }

        // Activer les contrôles manuels de la caméra
        this.app.enableManualCamera();
        this.app.controls.enabled = true;

        // Réinitialiser le timer d'auto-retour pour qu'il ne se déclenche pas
        if (this.app.cameraAutoTimeout) {
            clearTimeout(this.app.cameraAutoTimeout);
            this.app.cameraAutoTimeout = null;
        }

        // Afficher l'UI du Photo Mode
        this.showUI();

        console.log('✅ Photo Mode active - Use mouse to position camera');
    }

    /**
     * Quitte le Photo Mode
     */
    exit() {
        console.log('📸 Exiting Photo Mode...');

        this.isActive = false;

        // Restaurer la caméra
        if (this.originalCameraState) {
            this.app.disableManualCamera();
        }

        // Restaurer la vitesse de la voiture
        if (this.freezeFrame && this.app.car) {
            this.app.car.body.setLinvel(this.freezeFrame.carVelocity, true);
            this.app.car.speed = this.freezeFrame.carSpeed;
            this.freezeFrame = null;
        }

        // Masquer l'UI
        this.hideUI();

        // Réinitialiser les filtres
        this.resetFilters();

        console.log('✅ Photo Mode exited');
    }

    /**
     * Crée l'interface utilisateur
     */
    createUI() {
        // Overlay semi-transparent
        this.overlay = document.createElement('div');
        this.overlay.id = 'photo-mode-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.3);
            z-index: 5000;
            display: none;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);

        // Panel de contrôles
        this.panel = document.createElement('div');
        this.panel.id = 'photo-mode-panel';
        this.panel.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 5001;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 20, 40, 0.9));
            backdrop-filter: blur(20px);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 25px 35px;
            color: white;
            display: none;
            min-width: 700px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            font-family: 'Segoe UI', sans-serif;
            pointer-events: auto;
        `;

        this.panel.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 24px; font-weight: bold; background: linear-gradient(90deg, #4ecdc4, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 5px;">
                    📸 PHOTO MODE
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                    Drag to rotate camera • Scroll to zoom • Click buttons to adjust
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <!-- Filtres -->
                <div>
                    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                        🎨 Filters
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="photo-filter-btn" data-filter="none">None</button>
                        <button class="photo-filter-btn" data-filter="cinematic">Cinematic</button>
                        <button class="photo-filter-btn" data-filter="bw">B&W</button>
                        <button class="photo-filter-btn" data-filter="vintage">Vintage</button>
                        <button class="photo-filter-btn" data-filter="vibrant">Vibrant</button>
                        <button class="photo-filter-btn" data-filter="sunset">Sunset</button>
                        <button class="photo-filter-btn" data-filter="neon">Neon</button>
                    </div>
                </div>

                <!-- Options -->
                <div>
                    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                        ⚙️ Options
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="photo-dof" style="cursor: pointer;">
                            <span>Depth of Field (Blur Background)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="photo-ui" checked style="cursor: pointer;">
                            <span>Hide UI in Screenshot</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="photo-watermark" checked style="cursor: pointer;">
                            <span>Add Watermark</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 15px; margin-top: 25px; justify-content: center;">
                <button id="photo-capture-btn" style="
                    background: linear-gradient(135deg, #4ecdc4, #44b3aa);
                    border: none;
                    padding: 15px 40px;
                    border-radius: 12px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 16px;
                    box-shadow: 0 4px 15px rgba(78, 205, 196, 0.4);
                    transition: all 0.3s;
                ">
                    📷 CAPTURE
                </button>
                <button id="photo-reset-btn" style="
                    background: linear-gradient(135deg, #ff6b6b, #ee5555);
                    border: none;
                    padding: 15px 30px;
                    border-radius: 12px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                    box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
                    transition: all 0.3s;
                ">
                    🔄 RESET
                </button>
                <button id="photo-exit-btn" style="
                    background: linear-gradient(135deg, #555, #333);
                    border: none;
                    padding: 15px 30px;
                    border-radius: 12px;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s;
                ">
                    ✕ EXIT
                </button>
            </div>

            <!-- Hint -->
            <div style="text-align: center; margin-top: 15px; font-size: 11px; opacity: 0.5; font-style: italic;">
                💡 Tip: Position your car in a cool spot before entering Photo Mode!
            </div>
        `;

        document.body.appendChild(this.panel);

        // Ajouter les styles CSS pour les boutons
        this.addStyles();

        // Attacher les événements
        this.attachEvents();
    }

    /**
     * Ajoute les styles CSS
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .photo-filter-btn {
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s;
                font-weight: 500;
            }

            .photo-filter-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            }

            .photo-filter-btn.active {
                background: linear-gradient(135deg, #4ecdc4, #44b3aa);
                border-color: #4ecdc4;
                box-shadow: 0 0 15px rgba(78, 205, 196, 0.5);
            }

            #photo-capture-btn:hover,
            #photo-reset-btn:hover,
            #photo-exit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            }

            #photo-capture-btn:active,
            #photo-reset-btn:active,
            #photo-exit-btn:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Attache les événements aux boutons
     */
    attachEvents() {
        // Filtres
        const filterBtns = this.panel.querySelectorAll('.photo-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.applyFilter(filter);

                // Update active state
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Options
        document.getElementById('photo-dof').addEventListener('change', (e) => {
            this.settings.dofEnabled = e.target.checked;
            this.updateEffects();
        });

        document.getElementById('photo-ui').addEventListener('change', (e) => {
            this.settings.showUI = !e.target.checked;
        });

        document.getElementById('photo-watermark').addEventListener('change', (e) => {
            this.settings.watermark = e.target.checked;
        });

        // Actions
        document.getElementById('photo-capture-btn').addEventListener('click', () => {
            this.captureScreenshot();
        });

        document.getElementById('photo-reset-btn').addEventListener('click', () => {
            this.resetCamera();
        });

        document.getElementById('photo-exit-btn').addEventListener('click', () => {
            this.exit();
        });
    }

    /**
     * Affiche l'UI
     */
    showUI() {
        this.overlay.style.display = 'block';
        this.panel.style.display = 'block';

        // Marquer le premier filtre comme actif
        const firstBtn = this.panel.querySelector('.photo-filter-btn[data-filter="none"]');
        if (firstBtn) firstBtn.classList.add('active');
    }

    /**
     * Masque l'UI
     */
    hideUI() {
        this.overlay.style.display = 'none';
        this.panel.style.display = 'none';
    }

    /**
     * Applique un filtre
     */
    applyFilter(filterName) {
        console.log(`Applying filter: ${filterName}`);
        this.settings.filter = filterName;

        const filter = this.filters[filterName];
        if (!filter) return;

        // Appliquer via le post-processing
        if (this.app.composer && this.app.composer.passes) {
            const colorGradingPass = this.app.composer.passes.find(
                pass => pass.uniforms && pass.uniforms.brightness
            );

            if (colorGradingPass) {
                colorGradingPass.uniforms.brightness.value = filter.brightness;
                colorGradingPass.uniforms.contrast.value = filter.contrast;
                colorGradingPass.uniforms.saturation.value = filter.saturation;
            }
        }
    }

    /**
     * Met à jour les effets (DOF, etc.)
     */
    updateEffects() {
        // Pour le moment, juste un log
        // Le DOF nécessiterait un BokehPass ou DepthOfFieldPass
        console.log('DOF:', this.settings.dofEnabled);
    }

    /**
     * Réinitialise les filtres
     */
    resetFilters() {
        this.applyFilter('none');
    }

    /**
     * Réinitialise la caméra à sa position originale
     */
    resetCamera() {
        if (this.originalCameraState) {
            this.app.camera.position.copy(this.originalCameraState.position);
            this.app.camera.rotation.copy(this.originalCameraState.rotation);
            this.app.camera.fov = this.originalCameraState.fov;
            this.app.camera.updateProjectionMatrix();

            console.log('🔄 Camera reset to original position');
        }
    }

    /**
     * Capture un screenshot haute qualité
     */
    captureScreenshot() {
        console.log('📸 Capturing screenshot...');

        // Masquer temporairement l'UI si demandé
        const hideUI = this.settings.showUI;
        if (hideUI) {
            this.overlay.style.display = 'none';
            this.panel.style.display = 'none';

            // Masquer également les HUD du jeu
            document.querySelectorAll('.hud-top-left, .controls, .zone-indicator, div[style*="minimap"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Attendre un frame pour que le DOM se mette à jour
        setTimeout(() => {
            // Capturer l'image
            const canvas = this.app.renderer.domElement;

            // Créer un canvas temporaire pour ajouter le watermark
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const ctx = tempCanvas.getContext('2d');

            // Dessiner l'image capturée
            ctx.drawImage(canvas, 0, 0);

            // Ajouter le watermark si activé
            if (this.settings.watermark) {
                this.addWatermark(ctx, tempCanvas.width, tempCanvas.height);
            }

            // Convertir en image et télécharger
            tempCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                link.download = `portfolio-3d-photo-${timestamp}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);

                console.log('✅ Screenshot saved!');
                this.showCaptureFlash();
            });

            // Restaurer l'UI
            if (hideUI) {
                this.overlay.style.display = 'block';
                this.panel.style.display = 'block';
                document.querySelectorAll('.hud-top-left, .controls, .zone-indicator, div[style*="minimap"]').forEach(el => {
                    el.style.display = '';
                });
            }
        }, 50);
    }

    /**
     * Ajoute un watermark sur le canvas
     */
    addWatermark(ctx, width, height) {
        // Semi-transparent overlay en bas
        const gradient = ctx.createLinearGradient(0, height - 100, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 100, width, 100);

        // Texte
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px "Segoe UI"';
        ctx.fillText('📸 Portfolio 3D', 30, height - 55);

        ctx.font = '16px "Segoe UI"';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const date = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        ctx.fillText(`${date} • Photo Mode`, 30, height - 30);

        // Logo en haut à droite
        ctx.font = '40px "Segoe UI"';
        ctx.fillText('🏎️', width - 80, 60);
    }

    /**
     * Affiche un flash de capture
     */
    showCaptureFlash() {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: white;
            z-index: 10000;
            opacity: 1;
            pointer-events: none;
            animation: flashFade 0.3s ease-out;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes flashFade {
                0% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(flash);

        setTimeout(() => {
            document.body.removeChild(flash);
            document.head.removeChild(style);
        }, 300);
    }

    /**
     * Nettoie les ressources
     */
    dispose() {
        if (this.overlay) document.body.removeChild(this.overlay);
        if (this.panel) document.body.removeChild(this.panel);
    }
}

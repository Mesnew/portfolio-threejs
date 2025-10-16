/**
 * Loading Manager - Gère le chargement des assets et met à jour l'UI
 */

export class LoadingManager {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingPercentage = document.getElementById('loading-percentage');
        this.loadingRoad = document.getElementById('loading-road');
        this.loadingStatus = document.getElementById('loading-status');
        this.loadingTip = document.getElementById('loading-tip');

        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.currentProgress = 0;

        // Tips de chargement thématiques Cars
        this.tips = [
            "💡 Astuce : Maintenez SHIFT pour activer le mode turbo !",
            "🏁 Le boost recharge automatiquement quand vous ne l'utilisez pas",
            "🎨 Visitez le garage pour personnaliser votre voiture",
            "⭐ Collectez des étoiles en roulant dans Radiator Springs",
            "🚗 Utilisez ESPACE pour le frein à main et drifter",
            "🏆 Débloquez des achievements en explorant le monde",
            "🌙 Appuyez sur N pour basculer entre jour et nuit",
            "📷 Clic droit pour contrôler manuellement la caméra",
            "🎯 Explorez toutes les zones pour l'achievement Explorer",
            "💨 Les particules de drift apparaissent à haute vitesse",
            "🔧 Appuyez sur V pour visualiser les colliders (debug)",
            "🎮 Cliquez sur les objets pour les faire sauter !",
            "⚡ Le turbo augmente votre vitesse max de 2.5x",
            "🏜️ Radiator Springs cache plusieurs secrets à découvrir",
            "🌟 La physique utilise Rapier3D pour un réalisme maximal"
        ];

        this.currentTipIndex = 0;
        this.tipInterval = null;

        // Statuts de chargement
        this.statuses = {
            init: "Initialisation du moteur physique...",
            rapier: "Chargement de Rapier3D Physics...",
            world: "Création du monde 3D de Radiator Springs...",
            car: "Préparation de Lightning McQueen...",
            lamps: "Installation des lampadaires...",
            cacti: "Plantation des cactus du désert...",
            lights: "Configuration de l'éclairage...",
            postfx: "Activation des effets visuels...",
            complete: "Prêt à rouler ! 🏁"
        };

        this.init();
    }

    init() {
        console.log('🎬 LoadingManager initialized');
        this.startTipRotation();
    }

    /**
     * Met à jour la progression du chargement
     * @param {number} progress - Progression entre 0 et 1
     * @param {string} statusKey - Clé du statut à afficher
     */
    updateProgress(progress, statusKey = '') {
        this.currentProgress = Math.min(progress * 100, 100);

        // Mettre à jour le pourcentage
        if (this.loadingPercentage) {
            this.loadingPercentage.textContent = `${Math.round(this.currentProgress)}%`;
        }

        // Mettre à jour la barre de progression (route)
        if (this.loadingRoad) {
            this.loadingRoad.style.width = `${this.currentProgress}%`;
        }

        // Mettre à jour le statut
        if (statusKey && this.loadingStatus && this.statuses[statusKey]) {
            this.loadingStatus.textContent = this.statuses[statusKey];
        }

        console.log(`📦 Loading: ${Math.round(this.currentProgress)}% - ${statusKey}`);
    }

    /**
     * Met à jour le statut de chargement
     * @param {string} statusKey - Clé du statut
     */
    setStatus(statusKey) {
        if (this.loadingStatus && this.statuses[statusKey]) {
            this.loadingStatus.textContent = this.statuses[statusKey];
        }
    }

    /**
     * Rotation automatique des tips
     */
    startTipRotation() {
        // Afficher le premier tip
        this.showRandomTip();

        // Changer de tip toutes les 4 secondes
        this.tipInterval = setInterval(() => {
            this.showRandomTip();
        }, 4000);
    }

    /**
     * Affiche un tip aléatoire
     */
    showRandomTip() {
        if (!this.loadingTip) return;

        // Fade out
        this.loadingTip.style.opacity = '0';

        setTimeout(() => {
            // Choisir un nouveau tip (éviter de répéter le même)
            let newIndex;
            do {
                newIndex = Math.floor(Math.random() * this.tips.length);
            } while (newIndex === this.currentTipIndex && this.tips.length > 1);

            this.currentTipIndex = newIndex;
            this.loadingTip.textContent = this.tips[this.currentTipIndex];

            // Fade in
            this.loadingTip.style.opacity = '1';
        }, 300);
    }

    /**
     * Cache le loading screen avec animation
     */
    hide() {
        console.log('✅ Loading complete! Hiding loading screen...');

        // Arrêter la rotation des tips
        if (this.tipInterval) {
            clearInterval(this.tipInterval);
        }

        // Mettre à jour pour 100%
        this.updateProgress(1, 'complete');

        // Attendre 500ms pour que l'utilisateur voie 100%
        setTimeout(() => {
            if (this.loadingScreen) {
                this.loadingScreen.classList.add('hidden');

                // Supprimer complètement après l'animation
                setTimeout(() => {
                    if (this.loadingScreen) {
                        this.loadingScreen.remove();
                    }
                }, 800);
            }
        }, 500);
    }

    /**
     * Affiche une erreur dans le loading screen
     * @param {string} errorMessage
     */
    showError(errorMessage) {
        console.error('❌ Loading error:', errorMessage);

        if (this.loadingStatus) {
            this.loadingStatus.textContent = `❌ Erreur : ${errorMessage}`;
            this.loadingStatus.style.color = '#ff4444';
        }

        if (this.loadingTip) {
            this.loadingTip.textContent = '🔄 Rechargez la page pour réessayer';
        }
    }

    /**
     * Crée un THREE.LoadingManager pour tracker les assets Three.js
     */
    createThreeLoadingManager() {
        const THREE = window.THREE || (typeof THREE !== 'undefined' ? THREE : null);
        if (!THREE) {
            console.warn('THREE.js not available yet for LoadingManager');
            return null;
        }

        const manager = new THREE.LoadingManager();

        manager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`📦 Started loading: ${url}`);
            this.totalAssets = itemsTotal;
        };

        manager.onLoad = () => {
            console.log('✅ All assets loaded!');
        };

        manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            console.log(`📦 Loading: ${itemsLoaded}/${itemsTotal} - ${url}`);
            this.loadedAssets = itemsLoaded;
            this.totalAssets = itemsTotal;

            // Calculer la progression (50% pour les assets Three.js)
            const assetProgress = itemsLoaded / itemsTotal;
            this.updateProgress(assetProgress * 0.5);
        };

        manager.onError = (url) => {
            console.error(`❌ Error loading: ${url}`);
            this.showError(`Impossible de charger ${url}`);
        };

        return manager;
    }
}

// Créer une instance globale
export const loadingManager = new LoadingManager();

# Loading Screen & Maintenance Banner - Documentation

## Vue d'ensemble

Le nouveau système de chargement thématique **Cars** offre une expérience utilisateur améliorée avec :
- 🏎️ Design inspiré de l'univers Cars
- 📊 Progression en temps réel avec pourcentage
- 💡 Tips rotatifs pendant le chargement
- ⚠️ Banner de maintenance optionnel
- ✨ Animations fluides et transitions smooth

---

## Composants du Loading Screen

### 1. Écran de Chargement Principal

**Fichier**: `index.html` (lignes 612-639)

```html
<div class="loading-screen" id="loading-screen">
    <div class="tire-marks"></div>
    <div class="loading-logo">🏎️</div>
    <div class="loading-title">Radiator Springs</div>
    <div class="loading-subtitle">Get ready to race...</div>

    <!-- Speedometer avec pourcentage -->
    <div class="loading-speedometer">
        <div class="loading-percentage" id="loading-percentage">0%</div>
        <div class="loading-percentage-label">Loading</div>
    </div>

    <!-- Barre de progression route -->
    <div class="loading-road-container">
        <div class="loading-road" id="loading-road"></div>
    </div>

    <!-- Statut -->
    <div class="loading-status" id="loading-status">Initialisation...</div>

    <!-- Tips aléatoires -->
    <div class="loading-tip" id="loading-tip">
        💡 Astuce : Maintenez SHIFT pour activer le mode turbo !
    </div>
</div>
```

**Éléments visuels** :
- **Tire Marks** : Marques de pneus animées en fond
- **Logo** : Emoji voiture 🏎️ avec animation bounce
- **Titre** : "Radiator Springs" avec gradient animé
- **Speedometer** : Compteur de vitesse circulaire avec pourcentage
- **Road Bar** : Barre de progression style route avec lignes blanches animées
- **Status** : Message de ce qui est en train de charger
- **Tip** : Astuces rotatives toutes les 4 secondes

---

## Banner de Maintenance

### Activation / Désactivation

**Fichier**: `index.html` (lignes 606-610)

#### ✅ Pour ACTIVER le banner :

Gardez le code tel quel :

```html
<!-- Maintenance Banner (optionnel - commenter pour désactiver) -->
<div class="maintenance-banner" id="maintenance-banner">
    <span class="maintenance-banner-icon">⚠️</span>
    Site en maintenance - Certaines fonctionnalités peuvent être limitées
    <span class="maintenance-banner-icon">⚠️</span>
</div>
```

#### ❌ Pour DÉSACTIVER le banner :

Commentez simplement le bloc entier :

```html
<!-- Maintenance Banner (optionnel - commenter pour désactiver)
<div class="maintenance-banner" id="maintenance-banner">
    <span class="maintenance-banner-icon">⚠️</span>
    Site en maintenance - Certaines fonctionnalités peuvent être limitées
    <span class="maintenance-banner-icon">⚠️</span>
</div>
-->
```

#### 🎨 Personnaliser le message :

```html
<div class="maintenance-banner" id="maintenance-banner">
    <span class="maintenance-banner-icon">🚧</span>
    Mise à jour en cours - Retour prévu à 14h00
    <span class="maintenance-banner-icon">🚧</span>
</div>
```

**Icônes suggérées** :
- ⚠️ Avertissement général
- 🚧 Travaux en cours
- 🔧 Maintenance technique
- 🚀 Nouveautés à venir
- 🎉 Beta testing

---

## Système de Progression

### Loading Manager

**Fichier**: `src/utils/loadingManager.js`

Le `LoadingManager` gère automatiquement :

#### Méthodes principales :

```javascript
// Mettre à jour la progression (0 à 1) + statut
loadingManager.updateProgress(0.5, 'world');

// Changer juste le statut
loadingManager.setStatus('car');

// Cacher le loading screen (avec animation)
loadingManager.hide();

// Afficher une erreur
loadingManager.showError('Impossible de charger le modèle');
```

#### Statuts disponibles :

```javascript
statuses = {
    init: "Initialisation du moteur physique...",
    rapier: "Chargement de Rapier3D Physics...",
    world: "Création du monde 3D de Radiator Springs...",
    car: "Préparation de Lightning McQueen...",
    lamps: "Installation des lampadaires...",
    cacti: "Plantation des cactus du désert...",
    lights: "Configuration de l'éclairage...",
    postfx: "Activation des effets visuels...",
    complete: "Prêt à rouler ! 🏁"
}
```

#### Ajouter un nouveau statut :

Dans `loadingManager.js` :

```javascript
this.statuses = {
    // ... statuts existants
    customAsset: "Chargement de vos assets personnalisés...",
};
```

Puis dans `main.js` :

```javascript
loadingManager.updateProgress(0.85, 'customAsset');
await loadMyCustomAsset();
```

---

## Tips de Chargement

### Modification des Tips

**Fichier**: `src/utils/loadingManager.js` (lignes 23-39)

```javascript
this.tips = [
    "💡 Astuce : Maintenez SHIFT pour activer le mode turbo !",
    "🏁 Le boost recharge automatiquement quand vous ne l'utilisez pas",
    // ... ajoutez vos propres tips ici
];
```

### Ajouter vos tips :

```javascript
this.tips = [
    // Tips existants...
    "🎯 Nouveau : Explorez la zone secrète derrière le garage !",
    "🔥 Pro-tip : Combinez drift + boost pour des figures incroyables",
    "💎 Collectez les gemmes cachées pour débloquer des skins exclusifs"
];
```

### Changer la fréquence de rotation :

Dans `loadingManager.js` ligne 104 :

```javascript
// Par défaut : 4000ms (4 secondes)
this.tipInterval = setInterval(() => {
    this.showRandomTip();
}, 4000); // Modifier cette valeur
```

---

## Personnalisation Visuelle

### Couleurs du thème

**Fichier**: `index.html` (styles CSS)

```css
/* Titre gradient */
.loading-title {
    background: linear-gradient(90deg,
        #ff0000, /* Rouge */
        #ff6600, /* Orange */
        #ffaa00, /* Jaune */
        #ff6600, /* Orange */
        #ff0000  /* Rouge */
    );
}

/* Barre de progression */
.loading-road {
    background: linear-gradient(90deg, #ff0000, #ff6600, #ffaa00);
}

/* Compteur */
.loading-percentage {
    color: #ff6600;
    text-shadow: 0 0 20px rgba(255, 102, 0, 0.8);
}
```

### Changer les couleurs :

Pour un thème **bleu** :

```css
.loading-title {
    background: linear-gradient(90deg, #0066ff, #00aaff, #00ffff, #00aaff, #0066ff);
}

.loading-road {
    background: linear-gradient(90deg, #0066ff, #00aaff, #00ffff);
}

.loading-percentage {
    color: #00aaff;
    text-shadow: 0 0 20px rgba(0, 170, 255, 0.8);
}
```

### Modifier les animations :

**Vitesse de rotation du compteur** :

```css
@keyframes rotate {
    to { transform: rotate(360deg); }
}

/* Changer 2s pour modifier la vitesse */
.loading-speedometer::before {
    animation: rotate 2s linear infinite; /* Plus rapide : 1s, Plus lent : 3s */
}
```

**Animation de la route** :

```css
@keyframes roadMove {
    0% { transform: translateX(0) translateY(-50%); }
    100% { transform: translateX(-40px) translateY(-50%); }
}

/* Modifier la durée pour changer la vitesse */
.loading-road::after {
    animation: roadMove 1s linear infinite; /* Plus rapide : 0.5s */
}
```

---

## Intégration dans le Code

### Timeline de chargement actuelle :

```javascript
// main.js - init()

loadingManager.setStatus('init');              // 0% - Initialisation
loadingManager.updateProgress(0.05, 'rapier'); // 5% - Rapier3D
loadingManager.updateProgress(0.10, 'init');   // 10% - Scene setup
loadingManager.updateProgress(0.20, 'world');  // 20% - Début chargement monde
// Chargement GLB Radiator Springs (automatique)
loadingManager.updateProgress(0.60, 'car');    // 60% - Création voiture
loadingManager.updateProgress(0.70, 'postfx'); // 70% - Post-processing
loadingManager.updateProgress(0.80, 'lamps');  // 80% - Lampadaires
loadingManager.updateProgress(0.90, 'cacti');  // 90% - Cactus
loadingManager.updateProgress(1.0, 'complete');// 100% - Terminé
loadingManager.hide();                         // Masquer avec animation
```

### Ajouter une nouvelle étape :

```javascript
// Après les cactus
loadingManager.updateProgress(0.95, 'customAsset');
await loadCustomAsset();
```

---

## Gestion d'Erreurs

### Afficher une erreur :

```javascript
try {
    await loadImportantAsset();
} catch (error) {
    loadingManager.showError(error.message);
    // Le loading screen reste visible avec l'erreur
    // L'utilisateur peut recharger la page
}
```

### Personnaliser le message d'erreur :

Dans `loadingManager.js` méthode `showError()` :

```javascript
showError(errorMessage) {
    console.error('❌ Loading error:', errorMessage);

    if (this.loadingStatus) {
        this.loadingStatus.textContent = `❌ Erreur : ${errorMessage}`;
        this.loadingStatus.style.color = '#ff4444';
    }

    if (this.loadingTip) {
        this.loadingTip.textContent = '🔄 Rechargez la page pour réessayer';
        // Ou offrir un bouton de retry :
        this.loadingTip.innerHTML = `
            <button onclick="location.reload()" style="...">
                🔄 Réessayer
            </button>
        `;
    }
}
```

---

## Performance & Optimisations

### Animations GPU

Toutes les animations utilisent `transform` et `opacity` pour performance maximale (GPU-accelerated) :

```css
/* ✅ BON - Utilise GPU */
.loading-screen {
    transition: opacity 0.8s ease, transform 0.8s ease;
}

/* ❌ MAUVAIS - Pas GPU accelerated */
.loading-screen {
    transition: width 0.8s ease, height 0.8s ease;
}
```

### Lazy Loading des Assets

Si votre loading prend trop de temps, considérez le lazy loading :

```javascript
// Charger d'abord les assets critiques
loadingManager.updateProgress(0.3, 'car');
await loadCriticalAssets();

// Cacher le loading screen
loadingManager.hide();

// Puis charger les assets secondaires en arrière-plan
loadSecondaryAssets(); // Sans await
```

---

## Responsive Design

Le loading screen s'adapte automatiquement aux petits écrans :

```css
.loading-road-container {
    width: 500px;
    max-width: 80vw; /* S'adapte aux mobiles */
}

.loading-tip {
    max-width: 400px;
    /* Se rétrécit sur petits écrans */
}
```

### Tester sur mobile :

1. Ouvrir DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Sélectionner iPhone/Android
4. Recharger la page

---

## Troubleshooting

### Le loading screen ne disparaît pas

**Cause** : Erreur JavaScript empêche `loadingManager.hide()`

**Solution** : Vérifier la console (F12) pour les erreurs

```javascript
// Ajouter un fallback timeout
setTimeout(() => {
    if (document.getElementById('loading-screen')) {
        console.warn('Force hiding loading screen');
        loadingManager.hide();
    }
}, 15000); // 15 secondes max
```

### La progression saute des étapes

**Cause** : Asset se charge plus vite que prévu

**Solution** : Normal ! Le pourcentage reflète l'état réel

### Les tips ne changent pas

**Cause** : `tipInterval` ne démarre pas

**Solution** : Vérifier que `startTipRotation()` est appelé dans le constructeur

### Banner de maintenance cache le contenu

**Cause** : `z-index` trop élevé

**Solution** : Ajuster dans `index.html` :

```css
.maintenance-banner {
    z-index: 10000; /* Plus petit que loading-screen (9999) */
}
```

---

## Exemples d'Usage

### Loading Screen Minimal

```html
<!-- Sans tips ni animations complexes -->
<div class="loading-screen-simple">
    <h1>Chargement...</h1>
    <div class="progress-bar">
        <div id="progress" style="width: 0%"></div>
    </div>
</div>
```

```javascript
document.getElementById('progress').style.width = percent + '%';
```

### Loading Screen avec Estimation de Temps

```javascript
let startTime = Date.now();
let estimatedTime = 10000; // 10 secondes estimées

function updateTime() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, estimatedTime - elapsed);
    const seconds = Math.floor(remaining / 1000);
    loadingManager.loadingTip.textContent =
        `⏱️ Temps restant estimé : ${seconds}s`;
}

setInterval(updateTime, 1000);
```

---

## Changelog

### v1.0.0 (16 Oct 2025)
- ✨ Initial release du système de loading Cars
- 🎨 Design thématique Radiator Springs
- 📊 Progression en temps réel
- 💡 15 tips rotatifs
- ⚠️ Banner de maintenance configurable
- ✅ Animations smooth GPU-accelerated

---

## Références

- **Inspiration** : Portfolio de Bruno Simon
- **Thème** : Cars (Pixar)
- **Framework** : Vanilla JS (pas de dépendance)
- **Performance** : 60 FPS, GPU-accelerated animations

Pour plus d'informations, consultez :
- `index.html` - Structure HTML et styles CSS
- `src/utils/loadingManager.js` - Logique de gestion
- `src/main.js` - Intégration dans l'application

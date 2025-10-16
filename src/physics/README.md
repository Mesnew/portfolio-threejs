# Système de Physique - ColliderHelper

Un système modulaire pour créer automatiquement des colliders physiques à partir de modèles 3D Three.js.

## 📦 Installation

Aucune installation nécessaire - tout est inclus dans le projet.

## 🚀 Utilisation de base

### 1. Créer des colliders automatiquement depuis un modèle

```javascript
import { ColliderHelper } from './physics/ColliderHelper.js';

// Charger votre modèle 3D
const loader = new GLTFLoader();
loader.load('/model.glb', (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // Créer automatiquement les colliders
    const stats = ColliderHelper.createCollidersFromModel(model, world, {
        autoDetect: true,     // Détection automatique du type
        verbose: true         // Afficher les logs
    });

    console.log('Colliders créés:', stats);
});
```

### 2. Filtrer par type de collider

```javascript
// Créer uniquement des colliders pour le sol
ColliderHelper.createCollidersFromModel(model, world, {
    filterType: ColliderHelper.ColliderType.GROUND,
    verbose: true
});

// Créer uniquement des colliders pour les murs
ColliderHelper.createCollidersFromModel(model, world, {
    filterType: ColliderHelper.ColliderType.WALL,
    verbose: true
});
```

### 3. Créer un sol de sécurité

```javascript
// Sol de sécurité simple
ColliderHelper.createSafetyFloor(world, {
    y: -0.25,        // Position Y
    width: 1000,     // Largeur
    depth: 1000,     // Profondeur
    height: 0.5,     // Hauteur
    friction: 0.8    // Friction
});
```

## 🎯 Types de colliders disponibles

Le système détecte automatiquement 4 types de colliders :

| Type | Description | Critères de détection | Crée un collider ? |
|------|-------------|----------------------|-------------------|
| **GROUND** | Sol/Route | Plat (hauteur < 2), proche du sol (Y < 10), large (≥50 triangles) | ✅ Oui |
| **WALL** | Murs/Barrières | Moyennement haut (2-10), proche du sol | ✅ Oui |
| **BUILDING** | Bâtiments | Très haut (>10) ou éloigné du sol (Y > 15) | ❌ Non |
| **DECORATION** | Décorations | Petit (<50 triangles) ou trop haut (>3) | ❌ Non |

## ⚙️ Configuration par type

Chaque type a sa propre configuration physique :

```javascript
ColliderHelper.DefaultConfig = {
    ground: {
        friction: 0.8,           // Haute friction pour adhérence
        restitution: 0.0,        // Pas de rebond
        minTriangles: 50,        // Taille minimale
        maxHeight: 2.0,          // Hauteur max
        maxCenterY: 10           // Y max du centre
    },
    wall: {
        friction: 0.5,
        restitution: 0.1,
        minTriangles: 20,
        maxHeight: 50,
        maxCenterY: 50
    }
};
```

## 🔧 Détection personnalisée

Vous pouvez créer votre propre logique de détection :

```javascript
// Désactiver la détection auto et spécifier le type
ColliderHelper.createCollidersFromModel(model, world, {
    autoDetect: false,
    filterType: ColliderHelper.ColliderType.GROUND
});
```

## 📊 Statistiques retournées

La méthode `createCollidersFromModel()` retourne des statistiques :

```javascript
{
    total: 81,           // Nombre total de meshes analysés
    created: 34,         // Nombre de colliders créés
    skipped: 47,         // Nombre de meshes ignorés
    vertices: 76433,     // Total de vertices
    triangles: 51313,    // Total de triangles
    types: {             // Répartition par type
        ground: 34
    }
}
```

## 🎮 Système de composants physiques (Avancé)

Pour gérer des objets physiques dynamiques :

```javascript
import { PhysicsComponentSystem } from './physics/ColliderHelper.js';

// Créer le système
const physicsSystem = new PhysicsComponentSystem(world);

// Ajouter un composant à un objet
const carComponent = physicsSystem.addComponent(carMesh, {
    dynamic: true,
    shape: 'box',
    size: { x: 2, y: 1, z: 3 },
    position: { x: 0, y: 2, z: 0 }
});

// Dans la boucle d'animation
function animate() {
    physicsSystem.update();  // Synchronise les objets avec la physique
}
```

## 🎨 Exemples complets

### Exemple 1 : Scene complète avec route

```javascript
import { ColliderHelper } from './physics/ColliderHelper.js';

async function loadScene() {
    const loader = new GLTFLoader();

    // Charger le modèle
    const gltf = await loader.loadAsync('/radiator_springs.glb');
    const model = gltf.scene;
    scene.add(model);

    // Créer colliders pour le sol seulement
    const stats = ColliderHelper.createCollidersFromModel(model, world, {
        autoDetect: true,
        filterType: ColliderHelper.ColliderType.GROUND,
        verbose: true
    });

    // Sol de sécurité
    ColliderHelper.createSafetyFloor(world, {
        y: -0.25,
        width: 1000,
        depth: 1000
    });

    console.log(`${stats.created} colliders créés!`);
}
```

### Exemple 2 : Mélange de types

```javascript
// D'abord créer les colliders de sol
ColliderHelper.createCollidersFromModel(model, world, {
    filterType: ColliderHelper.ColliderType.GROUND
});

// Puis ajouter les murs
ColliderHelper.createCollidersFromModel(model, world, {
    filterType: ColliderHelper.ColliderType.WALL
});
```

## 🐛 Debug

Pour débugger, activez les logs détaillés :

```javascript
const stats = ColliderHelper.createCollidersFromModel(model, world, {
    autoDetect: true,
    verbose: true  // ✅ Active les logs pour chaque mesh
});
```

Les logs montrent :
- ✅ Meshes acceptés avec leur type
- ⏭️ Meshes ignorés avec la raison
- 📊 Statistiques finales

## 💡 Conseils d'optimisation

1. **Filtrer par type** : Ne créez que les colliders nécessaires
2. **Seuil de triangles** : Ajustez `minTriangles` pour ignorer les petits détails
3. **Sol de sécurité** : Toujours créer un sol de secours pour éviter les chutes infinies
4. **Détection auto** : Fonctionne bien pour 90% des cas, ajustez manuellement si nécessaire

## 📝 Notes

- Les colliders Trimesh sont automatiquement positionnés selon les transformations du modèle
- Les vertices sont transformés en coordonnées mondiales
- Les propriétés physiques (friction, restitution) sont définies par type
- Le système est totalement modulaire et réutilisable

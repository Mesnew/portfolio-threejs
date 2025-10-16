# Portfolio 3D - Radiator Springs

Un portfolio interactif en 3D inspiré de Bruno Simon, utilisant Three.js et la physique Cannon.js. Explorez un monde 3D basé sur Radiator Springs (Cars) en conduisant une voiture personnalisable.

![Portfolio 3D](https://img.shields.io/badge/Three.js-v0.180.0-brightgreen)
![Cannon.js](https://img.shields.io/badge/Cannon--es-v0.20.0-blue)
![Vite](https://img.shields.io/badge/Vite-v7.1.7-purple)

## ✨ Fonctionnalités

- 🚗 **Voiture pilotable** avec physique réaliste
- 🏜️ **Monde 3D** basé sur le modèle Radiator Springs
- 🎨 **Garage de personnalisation** avec système de peinture interactif
- 🚀 **Système de boost** avec gestion d'énergie
- 🏆 **Achievements** gamifiés
- 🗺️ **Mini-map** en temps réel
- 💨 **Effets visuels** (particules, trainées, fumée)
- 🎵 **Audio** généré (moteur de voiture)
- 📱 **Responsive** et optimisé

## 🎮 Contrôles

### Déplacement
- `W / ↑` : Accélérer
- `S / ↓` : Freiner / Reculer
- `A / ←` : Tourner à gauche
- `D / →` : Tourner à droite
- `ESPACE` : Frein à main
- `SHIFT` : Mode Turbo 🚀

### Interactions
- `Clic gauche` : Faire sauter des objets
- `Entrée` : Fermer les zones d'information

### Garage (garage.html)
- `Clic gauche + glisser` : Rotation caméra
- `Molette` : Zoom
- `Clic droit + glisser` : Déplacer la vue

## 🚀 Installation

```bash
# Cloner le projet
git clone <votre-repo>
cd portfolio-threejs

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Ouvrir http://localhost:3000
```

## 🏗️ Build pour production

```bash
# Créer une version optimisée
npm run build

# Prévisualiser le build
npm run preview
```

## 📁 Structure du projet

```
portfolio-threejs/
├── public/                              # Assets statiques
│   ├── lightning_mcqueen_cars_3.glb    # Modèle 3D voiture
│   └── xbox360_cars_..._radiator_springs.glb  # Modèle 3D monde
├── src/
│   ├── main.js                         # Point d'entrée principal
│   ├── garage.js                       # Mode garage
│   ├── radiatorSpringsNew.js           # Chargement du monde 3D
│   ├── radiatorSpringsLayout.js        # Layout des zones
│   ├── radiatorSpringsBuilder.js       # Construction des bâtiments
│   └── utils/
│       └── logger.js                   # Système de logging
├── index.html                          # Page principale
├── garage.html                         # Page garage
├── package.json
└── README.md
```

## 🛠️ Technologies utilisées

- **[Three.js](https://threejs.org/)** v0.180.0 - Rendu 3D WebGL
- **[Cannon-es](https://pmndrs.github.io/cannon-es/)** v0.20.0 - Moteur physique
- **[Vite](https://vitejs.dev/)** v7.1.7 - Build tool rapide
- **Vanilla JavaScript** - Pas de framework, code pur

## 🎨 Personnalisation

### Mode Garage

Le mode garage permet de personnaliser votre voiture :
1. Ouvrir `garage.html`
2. Activer le mode peinture 🎨
3. Sélectionner une couleur
4. Choisir une partie (carrosserie, cabine, roues)
5. Cliquer sur la voiture pour appliquer

Les couleurs sont sauvegardées automatiquement dans le localStorage.

## 📊 Performances

- **Modèles 3D** : ~24 MB (considérer la compression)
- **Collisions** : Trimesh pour le terrain
- **Particules** : Système optimisé avec pooling
- **FPS cible** : 60 FPS

## 🐛 Problèmes connus

- Les modèles GLB sont lourds (20+ MB) - compression recommandée
- Mode debug des collisions activé (désactiver en production)
- Console logs nombreux (utiliser le nouveau système logger.js)

## 📝 TODO

- [ ] Compresser les modèles GLB avec gltf-pipeline
- [ ] Migrer tous les console.log vers logger.js
- [ ] Ajouter des tests unitaires
- [ ] Implémenter le LOD (Level of Detail)
- [ ] Optimiser les performances Trimesh
- [ ] Ajouter TypeScript pour meilleure maintenabilité

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier LICENSE pour plus de détails.

## 🙏 Crédits

- Inspiré par le portfolio de [Bruno Simon](https://bruno-simon.com/)
- Modèles 3D : Cars (Radiator Springs)
- Three.js et Cannon.js communities

## 📧 Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue !

---

**Fait avec ❤️ et Three.js**

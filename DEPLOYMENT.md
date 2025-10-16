# 🚀 Guide de Déploiement & Sécurité

Guide complet pour déployer votre Portfolio 3D en production de manière sécurisée.

---

## 📋 Table des Matières

1. [Pré-requis](#pré-requis)
2. [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
3. [Déploiement sur Vercel](#déploiement-sur-vercel)
4. [Sécurité & Headers HTTP](#sécurité--headers-http)
5. [Monitoring & Analytics](#monitoring--analytics)
6. [Tracking des Visiteurs](#tracking-des-visiteurs)
7. [Dashboard de Monitoring](#dashboard-de-monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Pré-requis

### Comptes à Créer

1. **GitHub** (si pas déjà fait)
   - Créer un repository pour votre projet
   - Push votre code

2. **Vercel** (Gratuit) - https://vercel.com
   - Créer un compte (avec GitHub)
   - Plateforme de déploiement

3. **Sentry** (Gratuit jusqu'à 5k erreurs/mois) - https://sentry.io
   - Monitoring des erreurs
   - Performance tracking

4. **Plausible** (Payant ~9€/mois) ou alternatives gratuites :
   - Analytics RGPD-compliant
   - **Alternative gratuite** : Google Analytics 4 (moins respectueux RGPD)
   - **Alternative gratuite** : Umami (self-hosted)

---

## Configuration des Variables d'Environnement

### 1. Créer le fichier `.env`

```bash
cp .env.example .env
```

### 2. Remplir les variables

Éditez `.env` :

```bash
# Sentry Error Monitoring
VITE_SENTRY_DSN=https://votre-dsn@sentry.io/votre-project-id

# Analytics
VITE_PLAUSIBLE_DOMAIN=votre-domain.com

# App Version
VITE_APP_VERSION=1.0.0
```

### 3. Obtenir le DSN Sentry

1. Aller sur https://sentry.io/
2. Créer un nouveau projet → Sélectionner "Browser JavaScript"
3. Copier le DSN qui ressemble à : `https://xxxxx@o123456.ingest.sentry.io/789012`
4. Coller dans `.env`

### 4. Configurer Plausible (Optionnel)

**Option A : Utiliser Plausible (payant)**
1. Aller sur https://plausible.io/
2. Créer un compte
3. Ajouter votre site (ex: `portfolio.com`)
4. Coller le domain dans `.env`

**Option B : Alternative Gratuite (Google Analytics 4)**

Décommenter dans `src/utils/analytics.js` :

```javascript
// Décommenter cette section pour GA4
export function initGA4() {
    const GA4_ID = import.meta.env.VITE_GA4_ID || '';
    // ...
}
```

Ajouter dans `.env` :
```bash
VITE_GA4_ID=G-XXXXXXXXXX
```

---

## Déploiement sur Vercel

### Méthode Automatique (Recommandée)

#### Étape 1 : Lier GitHub à Vercel

1. Aller sur https://vercel.com/
2. Se connecter avec GitHub
3. Cliquer "New Project"
4. Importer votre repository GitHub

#### Étape 2 : Configuration Build

Vercel détecte automatiquement Vite. Vérifiez :

- **Framework Preset** : Vite
- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Install Command** : `npm install`

#### Étape 3 : Variables d'Environnement

Dans Vercel Dashboard → Settings → Environment Variables :

```
VITE_SENTRY_DSN = https://votre-dsn@sentry.io/project-id
VITE_PLAUSIBLE_DOMAIN = votre-domain.com
VITE_APP_VERSION = 1.0.0
```

**Important** : Ces variables doivent commencer par `VITE_` pour être accessibles côté client.

#### Étape 4 : Déployer

1. Cliquer "Deploy"
2. Attendre 2-3 minutes
3. Votre site est en ligne ! 🎉

URL : `https://votre-projet.vercel.app`

#### Étape 5 : Domain Personnalisé (Optionnel)

1. Dans Vercel Dashboard → Settings → Domains
2. Ajouter votre domaine (ex: `portfolio.com`)
3. Configurer les DNS chez votre registrar

---

### Méthode Manuelle (CLI)

```bash
# Installer Vercel CLI
npm install -g vercel

# Login
vercel login

# Déployer
vercel

# Déployer en production
vercel --prod
```

---

## Sécurité & Headers HTTP

### Headers Configurés Automatiquement

Le fichier `vercel.json` configure automatiquement :

#### 1. **Content Security Policy (CSP)**
Protège contre XSS et injections de code malveillant.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://*.sentry.io https://plausible.io;
```

#### 2. **Strict-Transport-Security (HSTS)**
Force HTTPS pour toutes les requêtes.

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

#### 3. **X-Frame-Options**
Empêche votre site d'être chargé dans une iframe (protection clickjacking).

```
X-Frame-Options: DENY
```

#### 4. **X-Content-Type-Options**
Empêche le browser de "deviner" le type MIME.

```
X-Content-Type-Options: nosniff
```

#### 5. **Permissions-Policy**
Désactive les fonctionnalités sensibles (caméra, micro, géolocalisation).

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Vérifier les Headers

Après déploiement, testez sur :
- https://securityheaders.com/
- https://observatory.mozilla.org/

**Score attendu** : A+ ou S

---

## Monitoring & Analytics

### 1. Dashboard Sentry

**Accès** : https://sentry.io/organizations/your-org/issues/

**Fonctionnalités** :
- 🐛 Erreurs JavaScript en temps réel
- 📊 Stack traces détaillées
- 👤 Infos utilisateur (anonymisées)
- 📈 Performance monitoring
- 🔔 Alertes email/Slack

**Événements trackés automatiquement** :
- Toutes les erreurs JavaScript
- Erreurs de chargement d'assets
- Erreurs réseau
- Performance < 30 FPS

### 2. Analytics Plausible

**Accès** : https://plausible.io/your-domain.com

**Métriques disponibles** :
- 👥 Visiteurs uniques
- 📄 Pages vues
- 🌍 Localisation géographique
- 📱 Appareils (desktop/mobile/tablet)
- 🌐 Navigateurs & OS
- 📊 Sources de trafic

**Événements personnalisés trackés** :
- ✅ Game Start
- 🚀 Boost Used
- 🏆 Achievement Unlocked
- ⭐ Collectible Picked
- 🚗 Garage Entered
- 🎨 Car Customized
- ⚡ Max Speed Reached
- ⚠️ Performance Issues

### 3. Custom Visitor Tracking

**Console Browser** : Ouvrir DevTools (F12) → Console

```javascript
// Afficher les stats de la session
VisitorTracking.getStats()

// Exporter toutes les données
VisitorTracking.exportData()
```

**Données collectées** :
- 🆔 ID session & visiteur (anonyme)
- 📱 Type d'appareil (desktop/mobile/tablet)
- 🖥️ Résolution écran & viewport
- 🌐 Navigateur, OS, langue
- 📡 Type de connexion (4G, WiFi, etc.)
- 🕐 Temps passé sur le site
- 👆 Actions utilisateur (clicks, keypresses, scroll)
- 🏎️ Position de la voiture (heatmap)
- 📊 Performance (FPS, vitesse voiture)

**Respect RGPD** :
- ✅ Pas de cookies tiers
- ✅ Pas de données personnelles identifiables
- ✅ IDs anonymes générés côté client
- ✅ Pas de partage avec tiers

---

## Tracking des Visiteurs

### Dashboard Custom (À implémenter)

Pour visualiser les données du visitor tracking, vous pouvez :

**Option A : Export Local (Dev)**

Dans la console browser :

```javascript
// Récupérer toutes les données
const data = VisitorTracking.exportData();

// Télécharger en JSON
const json = JSON.stringify(data, null, 2);
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'visitor-tracking.json';
a.click();
```

**Option B : Backend + Dashboard (Production)**

Pour une solution complète, vous devriez :

1. **Créer un backend** (Node.js + Express)
2. **Base de données** (MongoDB ou PostgreSQL)
3. **API pour recevoir les données** :

```javascript
// Dans visitorTracking.js, envoyer les données
async function sendToBackend(data) {
    await fetch('https://votre-api.com/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}
```

4. **Dashboard de visualisation** :
   - Charts.js pour les graphiques
   - Heatmap.js pour la heatmap des positions
   - Tables pour les sessions

### Exemple de Dashboard (À créer)

```
┌─────────────────────────────────────┐
│  📊 Dashboard Analytics              │
├─────────────────────────────────────┤
│                                     │
│  Visiteurs aujourd'hui : 127        │
│  Sessions actives : 5               │
│  Temps moyen : 4m 32s               │
│  FPS moyen : 58                     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Heatmap Positions Voiture  │   │
│  │  (zones les plus visitées)  │   │
│  └─────────────────────────────┘   │
│                                     │
│  Top Achievements Débloqués :       │
│  1. Speed Demon (78%)               │
│  2. Customizer (65%)                │
│  3. Boost Master (42%)              │
│                                     │
└─────────────────────────────────────┘
```

---

## Dashboard de Monitoring

### Métriques Importantes à Surveiller

#### 1. Performance
- **FPS moyen** : Doit rester > 50
- **FPS minimum** : Ne doit pas descendre sous 30
- **Temps de chargement** : < 5 secondes
- **Taille des assets** : Modèles GLB < 5 MB chacun

#### 2. Erreurs
- **Taux d'erreur** : < 1%
- **Erreurs de chargement** : 0
- **Erreurs JavaScript** : < 10/jour

#### 3. Engagement
- **Temps moyen** : > 3 minutes
- **Taux de rebond** : < 70%
- **Actions par session** : > 20

#### 4. Achievements
- **Speed Demon** : ~30% des joueurs
- **Customizer** : ~50% des joueurs
- **Explorer** : ~20% des joueurs

---

## Troubleshooting

### Le site ne charge pas après déploiement

**Vérifier** :
1. Build réussi dans Vercel Dashboard ?
2. Variables d'environnement configurées ?
3. Erreurs dans Sentry ?

**Solution** :
```bash
# Tester le build localement
npm run build
npm run preview

# Vérifier les logs Vercel
vercel logs
```

### Les analytics ne fonctionnent pas

**Vérifier** :
1. Script Plausible chargé ? (Onglet Network dans DevTools)
2. Domain correct dans `.env` ?
3. Bloqueur de pub désactivé ?

**Solution** :
```javascript
// Dans la console browser
console.log('Plausible loaded:', !!window.plausible);
console.log('Domain:', import.meta.env.VITE_PLAUSIBLE_DOMAIN);
```

### Sentry ne reçoit pas les erreurs

**Vérifier** :
1. DSN correct dans `.env` ?
2. En mode production ? (Sentry désactivé en dev)
3. CSP bloque Sentry ? (Vérifier console)

**Solution** :
```javascript
// Forcer une erreur de test
throw new Error('Test Sentry');
```

### Headers de sécurité manquants

**Vérifier** :
1. Fichier `vercel.json` présent ?
2. Déployé sur Vercel ? (pas en local)
3. Cache browser vidé ?

**Solution** :
```bash
# Tester avec curl
curl -I https://votre-site.vercel.app
```

### Performance médiocre (< 30 FPS)

**Causes possibles** :
1. Appareil bas de gamme
2. Assets GLB trop lourds (> 20 MB)
3. Trop de particules (> 100)

**Solutions** :
- Compresser les GLB avec Draco
- Réduire qualité graphique sur bas de gamme
- Limiter nombre de particules

---

## Commandes Utiles

```bash
# Dev local
npm run dev

# Build production
npm run build

# Preview du build
npm run preview

# Deploy Vercel
vercel --prod

# Logs Vercel
vercel logs

# Voir les variables d'env
vercel env ls

# Ajouter une variable d'env
vercel env add VITE_SENTRY_DSN
```

---

## Checklist de Déploiement

Avant de déployer en production :

- [ ] ✅ Code pushé sur GitHub
- [ ] ✅ Variables d'environnement configurées
- [ ] ✅ Sentry configuré et testé
- [ ] ✅ Analytics configuré (Plausible ou GA4)
- [ ] ✅ Build local réussi (`npm run build`)
- [ ] ✅ Headers de sécurité configurés (`vercel.json`)
- [ ] ✅ Assets GLB compressés (optionnel mais recommandé)
- [ ] ✅ Maintenance banner désactivé (si pas besoin)
- [ ] ✅ Tests sur mobile/desktop
- [ ] ✅ Lighthouse score > 80

---

## Ressources Supplémentaires

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Sentry](https://docs.sentry.io/)
- [Documentation Plausible](https://plausible.io/docs)
- [CSP Generator](https://report-uri.com/home/generate)
- [Security Headers Checker](https://securityheaders.com/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

## Support

Si vous rencontrez des problèmes :

1. **Vérifier les logs** : Vercel Dashboard → Deployments → Logs
2. **Vérifier Sentry** : https://sentry.io → Issues
3. **Tester localement** : `npm run build && npm run preview`
4. **Consulter la doc** : Ce fichier + docs officielles

---

**Bon déploiement ! 🚀**

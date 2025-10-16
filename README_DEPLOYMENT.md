# 📚 Documentation de Déploiement - Portfolio 3D

Ce dossier contient tous les fichiers et guides nécessaires pour déployer votre portfolio 3D sur différentes plateformes.

---

## 🎯 Guides Disponibles

### Pour VPS OVH (testing.mesnew.fr)

| Fichier | Description | Quand l'utiliser |
|---------|-------------|------------------|
| **VPS_QUICKSTART.txt** | Guide ultra-rapide format ASCII | Vous voulez un aperçu rapide des étapes |
| **SETUP_ON_VPS.md** | Guide complet étape par étape | Première installation sur le VPS |
| **DEPLOYMENT_VPS.md** | Guide détaillé avec troubleshooting | Documentation complète et résolution de problèmes |
| **setup-vps.sh** | Script d'installation automatique | Installation automatisée en une commande |
| **update-vps.sh** | Script de mise à jour | Déployer rapidement les changements |

### Pour Vercel (Alternative)

| Fichier | Description |
|---------|-------------|
| **DEPLOYMENT.md** | Guide complet pour déployer sur Vercel |
| **deploy.sh** | Script de déploiement depuis votre machine locale |

---

## 🚀 Déploiement sur VPS - Méthode Rapide

Votre repo est cloné sur le VPS ? Parfait !

### Méthode Automatique (Recommandée)

```bash
# Sur votre VPS
cd /chemin/vers/portfolio-threejs
chmod +x setup-vps.sh
./setup-vps.sh
```

Le script va :
1. ✅ Vérifier et installer Node.js si nécessaire
2. ✅ Installer les dépendances npm
3. ✅ Configurer .env
4. ✅ Builder le projet
5. ✅ Déployer dans /var/www/testing.mesnew.fr
6. ✅ Configurer Nginx
7. ✅ Configurer HTTPS avec Let's Encrypt

### Méthode Manuelle

Consultez **SETUP_ON_VPS.md** pour les instructions détaillées.

---

## 🔄 Mettre à Jour le Site

Après avoir modifié le code :

```bash
# Sur votre VPS
cd /chemin/vers/portfolio-threejs
./update-vps.sh
```

Ou manuellement :

```bash
git pull
npm run build
sudo cp -r dist/* /var/www/testing.mesnew.fr/
```

---

## 📁 Fichiers de Configuration

| Fichier | Description |
|---------|-------------|
| **nginx-config.conf** | Configuration Nginx avec headers de sécurité |
| **vercel.json** | Configuration Vercel (si vous utilisez Vercel) |
| **vite.config.js** | Configuration de build Vite |
| **.env.example** | Template des variables d'environnement |
| **.gitignore** | Fichiers à ignorer par Git |

---

## 🔐 Variables d'Environnement

Créez un fichier `.env` à la racine :

```bash
# Sentry Error Monitoring
VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Analytics
VITE_PLAUSIBLE_DOMAIN=testing.mesnew.fr

# Version
VITE_APP_VERSION=1.0.0
```

**Important** : Ces variables doivent être configurées **AVANT** le build.

---

## 🛠️ Outils et Monitoring

### Sentry (Monitoring des erreurs)
- Créer un compte : https://sentry.io
- Créer un projet "Browser JavaScript"
- Copier le DSN dans `.env`

### Plausible Analytics (Analytics RGPD-compliant)
- Créer un compte : https://plausible.io
- Ajouter le domaine : `testing.mesnew.fr`
- Copier le domain dans `.env`

### Alternative : Google Analytics 4
Si vous préférez GA4 (gratuit mais moins privacy-friendly) :
- Décommenter le code GA4 dans `src/utils/analytics.js`
- Ajouter `VITE_GA4_ID=G-XXXXXXXXXX` dans `.env`

---

## 🔍 Vérifications Post-Déploiement

### 1. Vérifier que le site fonctionne

```bash
curl -I https://testing.mesnew.fr
# Doit retourner HTTP/2 200
```

### 2. Vérifier les headers de sécurité

Visitez : https://securityheaders.com/?q=testing.mesnew.fr

**Score attendu** : A ou A+

### 3. Vérifier SSL

Visitez : https://www.ssllabs.com/ssltest/analyze.html?d=testing.mesnew.fr

**Score attendu** : A ou A+

### 4. Dans le navigateur

1. Visiter https://testing.mesnew.fr
2. Ouvrir DevTools (F12)
3. Vérifier qu'il n'y a pas d'erreurs dans la console
4. Vérifier que les assets chargent (onglet Network)

---

## 📊 Logs et Monitoring

### Voir les logs Nginx en temps réel

```bash
# Logs d'accès (visiteurs)
sudo tail -f /var/log/nginx/testing.mesnew.fr.access.log

# Logs d'erreur
sudo tail -f /var/log/nginx/testing.mesnew.fr.error.log
```

### Vérifier l'espace disque

```bash
df -h
```

### Nettoyer les anciens builds

```bash
# Sur le VPS, dans le dossier du projet
rm -rf dist node_modules
npm install
npm run build
```

---

## 🐛 Problèmes Courants

### Le site affiche "502 Bad Gateway"

```bash
sudo systemctl restart nginx
```

### Le site affiche "403 Forbidden"

```bash
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr
```

### DNS ne résout pas

```bash
dig testing.mesnew.fr
# Attendre 10-15 minutes pour la propagation
```

### HTTPS ne fonctionne pas

```bash
sudo certbot --nginx -d testing.mesnew.fr
```

### Les modèles 3D ne chargent pas

Vérifier que les fichiers GLB sont bien copiés :

```bash
ls -lh /var/www/testing.mesnew.fr/models/
```

---

## 📋 Checklist Complète

Avant de considérer le déploiement terminé :

- [ ] ✅ DNS configuré (testing.mesnew.fr → IP VPS)
- [ ] ✅ Node.js installé (v18+)
- [ ] ✅ Dépendances installées (`npm install`)
- [ ] ✅ `.env` configuré avec les clés API
- [ ] ✅ Build réussi (`npm run build`)
- [ ] ✅ Fichiers copiés dans `/var/www/testing.mesnew.fr`
- [ ] ✅ Nginx configuré et actif
- [ ] ✅ HTTPS configuré avec Let's Encrypt
- [ ] ✅ Headers de sécurité présents
- [ ] ✅ Site accessible sur https://testing.mesnew.fr
- [ ] ✅ Pas d'erreurs dans la console browser
- [ ] ✅ Sentry reçoit les événements (si configuré)
- [ ] ✅ Analytics trackent les visiteurs (si configuré)
- [ ] ✅ Score A ou A+ sur securityheaders.com

---

## 📞 Support et Documentation

### Guides Complets
- **SETUP_ON_VPS.md** - Installation détaillée
- **DEPLOYMENT_VPS.md** - Troubleshooting avancé
- **DEPLOYMENT.md** - Déploiement Vercel

### Scripts
- **setup-vps.sh** - Installation automatique
- **update-vps.sh** - Mise à jour automatique
- **deploy.sh** - Déploiement depuis machine locale

### Configuration
- **nginx-config.conf** - Config Nginx complète
- **VPS_QUICKSTART.txt** - Guide visuel rapide

---

## 🌐 URLs Importantes

- **Site de production** : https://testing.mesnew.fr
- **Site actuel** : https://portfolio.mesnew.fr
- **Manager OVH** : https://www.ovh.com/manager/
- **Sentry Dashboard** : https://sentry.io
- **Plausible Analytics** : https://plausible.io

---

## 🔧 Commandes Utiles

```bash
# Build et deploy (sur VPS)
./update-vps.sh

# Vérifier Nginx
sudo nginx -t
sudo systemctl status nginx

# Recharger Nginx
sudo systemctl reload nginx

# Voir les logs
sudo tail -f /var/log/nginx/testing.mesnew.fr.access.log

# Vérifier l'espace disque
df -h

# Nettoyer les backups anciens
cd /var/www/testing.mesnew.fr
ls -t backup-*.tar.gz | tail -n +11 | xargs rm -f
```

---

**Bon déploiement ! 🚀**

Si vous rencontrez des problèmes, consultez **DEPLOYMENT_VPS.md** section Troubleshooting.

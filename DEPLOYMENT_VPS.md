# 🚀 Guide de Déploiement VPS OVH

Guide complet pour déployer votre Portfolio 3D sur votre VPS OVH sous `testing.mesnew.fr`.

---

## 📋 Table des Matières

1. [Architecture](#architecture)
2. [Pré-requis](#pré-requis)
3. [Configuration DNS](#configuration-dns)
4. [Build du Projet](#build-du-projet)
5. [Configuration Nginx](#configuration-nginx)
6. [Déploiement des Fichiers](#déploiement-des-fichiers)
7. [HTTPS avec Let's Encrypt](#https-avec-lets-encrypt)
8. [Variables d'Environnement](#variables-denvironnement)
9. [Script de Déploiement Automatique](#script-de-déploiement-automatique)
10. [Vérifications](#vérifications)
11. [Maintenance](#maintenance)

---

## Architecture

```
portfolio.mesnew.fr (VPS OVH)
├── portfolio.mesnew.fr    → Portfolio actuel
└── testing.mesnew.fr      → Nouveau portfolio 3D (Three.js)
```

**Stack** :
- Serveur web : **Nginx**
- SSL : **Let's Encrypt (Certbot)**
- Node.js : **Pour le build uniquement** (pas de serveur Node en production)
- Fichiers : **Statiques dans `/var/www/testing.mesnew.fr`**

---

## Pré-requis

### Sur votre VPS OVH

1. **Nginx installé**
   ```bash
   sudo apt update
   sudo apt install nginx
   sudo systemctl status nginx
   ```

2. **Certbot pour HTTPS**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

3. **Node.js (pour le build local ou sur le VPS)**
   ```bash
   # Si vous buildez sur le VPS
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version  # Doit être >= 18
   ```

4. **Git (optionnel, pour cloner le repo)**
   ```bash
   sudo apt install git
   ```

---

## Configuration DNS

### 1. Ajouter le sous-domaine dans l'interface OVH

1. Aller sur https://www.ovh.com/manager/
2. Section **Web Cloud** → **Noms de domaine** → `mesnew.fr`
3. Onglet **Zone DNS**
4. Cliquer **Ajouter une entrée**
5. Type : **A**
   - Sous-domaine : `testing`
   - Cible : `IP_DE_VOTRE_VPS`
   - TTL : `3600` (1 heure)

### 2. Vérifier la propagation DNS

Attendre 5-10 minutes puis vérifier :

```bash
dig testing.mesnew.fr

# Ou depuis votre machine locale
nslookup testing.mesnew.fr
```

Vous devriez voir votre IP VPS dans la réponse.

---

## Build du Projet

### Option A : Build en Local (Recommandé)

Sur votre machine de développement :

```bash
# 1. Configurer les variables d'environnement
cp .env.example .env
nano .env

# Remplir :
# VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
# VITE_PLAUSIBLE_DOMAIN=testing.mesnew.fr
# VITE_APP_VERSION=1.0.0

# 2. Build
npm run build

# 3. Le dossier dist/ contient tous les fichiers statiques à déployer
ls -lh dist/
```

### Option B : Build sur le VPS

Si vous préférez builder directement sur le VPS :

```bash
# Sur le VPS
cd /tmp
git clone https://github.com/votre-repo/portfolio-threejs.git
cd portfolio-threejs

# Configurer .env
cp .env.example .env
nano .env

# Installer et build
npm install
npm run build

# Les fichiers sont dans dist/
```

---

## Configuration Nginx

### 1. Créer le fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/testing.mesnew.fr
```

Coller cette configuration :

```nginx
# Portfolio 3D - testing.mesnew.fr
server {
    listen 80;
    listen [::]:80;
    server_name testing.mesnew.fr;

    # Redirection HTTP → HTTPS (sera configuré après Let's Encrypt)
    # return 301 https://$server_name$request_uri;

    root /var/www/testing.mesnew.fr;
    index index.html;

    # Logs
    access_log /var/log/nginx/testing.mesnew.fr.access.log;
    error_log /var/log/nginx/testing.mesnew.fr.error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/x-javascript
               application/xml+rss application/json
               application/wasm;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.sentry.io https://plausible.io; worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # Cache statique (assets avec hash)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|glb|gltf|bin)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Cache HTML (courte durée)
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # SPA routing - toutes les routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bloquer accès aux fichiers cachés
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Bloquer accès aux fichiers sensibles
    location ~ \.(env|md|json)$ {
        deny all;
    }
}
```

### 2. Activer le site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/testing.mesnew.fr /etc/nginx/sites-enabled/

# Vérifier la configuration
sudo nginx -t

# Si OK, recharger Nginx
sudo systemctl reload nginx
```

---

## Déploiement des Fichiers

### 1. Créer le répertoire web

```bash
sudo mkdir -p /var/www/testing.mesnew.fr
sudo chown -R $USER:$USER /var/www/testing.mesnew.fr
```

### 2. Upload des fichiers

**Méthode A : SCP (depuis votre machine locale)**

```bash
# Depuis le dossier de votre projet local
scp -r dist/* user@IP_VPS:/var/www/testing.mesnew.fr/

# Exemple :
# scp -r dist/* root@51.210.123.45:/var/www/testing.mesnew.fr/
```

**Méthode B : Rsync (plus rapide, recommandé)**

```bash
# Depuis le dossier de votre projet local
rsync -avz --delete dist/ user@IP_VPS:/var/www/testing.mesnew.fr/

# --delete supprime les anciens fichiers sur le serveur
# -a : archive mode (préserve permissions)
# -v : verbose
# -z : compression
```

**Méthode C : Git (si build sur le VPS)**

```bash
# Sur le VPS
cd /tmp/portfolio-threejs
cp -r dist/* /var/www/testing.mesnew.fr/
```

### 3. Permissions

```bash
# Sur le VPS
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr
```

---

## HTTPS avec Let's Encrypt

### 1. Obtenir le certificat SSL

```bash
sudo certbot --nginx -d testing.mesnew.fr
```

Répondre aux questions :
- Email : `votre-email@example.com`
- Accepter les conditions
- Partager email (optionnel) : Votre choix
- Redirection HTTPS : **Oui** (option 2)

Certbot va :
- Générer le certificat SSL
- Modifier automatiquement votre config Nginx
- Ajouter la redirection HTTP → HTTPS

### 2. Vérifier le renouvellement automatique

```bash
# Certbot renouvelle automatiquement tous les 60 jours
sudo certbot renew --dry-run
```

Si aucune erreur : le renouvellement automatique est OK !

### 3. Tester HTTPS

```bash
curl -I https://testing.mesnew.fr
```

Vous devriez voir :
```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-frame-options: DENY
...
```

---

## Variables d'Environnement

### Pour Vite (Build Time)

Les variables `VITE_*` sont injectées **pendant le build** dans le code JavaScript.

**Créer `.env` AVANT de build** :

```bash
# .env
VITE_SENTRY_DSN=https://xxxxx@o123456.ingest.sentry.io/789012
VITE_PLAUSIBLE_DOMAIN=testing.mesnew.fr
VITE_APP_VERSION=1.0.0
```

Ensuite :
```bash
npm run build
```

Les variables sont **hard-codées** dans les fichiers JS du build.

**Important** :
- ⚠️ NE PAS committer le fichier `.env`
- ✅ Utiliser `.env.example` comme template
- ✅ Reconstruire (`npm run build`) si vous changez une variable

---

## Script de Déploiement Automatique

Créer un script `deploy.sh` pour automatiser le déploiement :

```bash
#!/bin/bash

# Configuration
VPS_USER="root"
VPS_IP="51.210.XXX.XXX"
VPS_PATH="/var/www/testing.mesnew.fr"
BUILD_DIR="dist"

echo "🚀 Starting deployment to testing.mesnew.fr..."

# 1. Build
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# 2. Backup distant (optionnel)
echo "💾 Creating backup on VPS..."
ssh $VPS_USER@$VPS_IP "cd $VPS_PATH && tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz * && ls -lht backup-*.tar.gz | head -5"

# 3. Upload avec rsync
echo "📤 Uploading files..."
rsync -avz --delete $BUILD_DIR/ $VPS_USER@$VPS_IP:$VPS_PATH/

if [ $? -ne 0 ]; then
    echo "❌ Upload failed!"
    exit 1
fi

# 4. Permissions
echo "🔐 Setting permissions..."
ssh $VPS_USER@$VPS_IP "chown -R www-data:www-data $VPS_PATH && chmod -R 755 $VPS_PATH"

# 5. Recharger Nginx (si config modifiée)
# ssh $VPS_USER@$VPS_IP "nginx -t && systemctl reload nginx"

echo "✅ Deployment complete!"
echo "🌐 Visit: https://testing.mesnew.fr"
```

### Utilisation

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Vérifications

### 1. Vérifier que le site fonctionne

```bash
curl https://testing.mesnew.fr
```

Vous devriez voir le HTML de votre page.

### 2. Vérifier les headers de sécurité

```bash
curl -I https://testing.mesnew.fr
```

Vérifier la présence de :
- `strict-transport-security`
- `x-frame-options: DENY`
- `x-content-type-options: nosniff`
- `content-security-policy`

Ou tester sur :
- https://securityheaders.com/?q=testing.mesnew.fr
- https://observatory.mozilla.org/

**Score attendu** : A ou A+

### 3. Vérifier SSL

https://www.ssllabs.com/ssltest/analyze.html?d=testing.mesnew.fr

**Score attendu** : A ou A+

### 4. Vérifier les logs

```bash
# Logs d'accès
sudo tail -f /var/log/nginx/testing.mesnew.fr.access.log

# Logs d'erreur
sudo tail -f /var/log/nginx/testing.mesnew.fr.error.log
```

### 5. Vérifier dans le navigateur

1. Ouvrir https://testing.mesnew.fr
2. Ouvrir DevTools (F12) → Console
3. Vérifier :
   - Aucune erreur de chargement
   - Sentry initialisé
   - Analytics initialisé
   - Visitor tracking initialisé

---

## Maintenance

### Mise à jour du site

```bash
# Méthode simple
./deploy.sh

# Ou manuellement
npm run build
rsync -avz --delete dist/ user@IP_VPS:/var/www/testing.mesnew.fr/
```

### Restaurer un backup

```bash
# Sur le VPS
cd /var/www/testing.mesnew.fr
tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
```

### Nettoyer les anciens backups

```bash
# Garder seulement les 10 derniers
ssh user@IP_VPS "cd /var/www/testing.mesnew.fr && ls -t backup-*.tar.gz | tail -n +11 | xargs rm -f"
```

### Vérifier l'espace disque

```bash
ssh user@IP_VPS "df -h"
```

### Renouveler SSL manuellement

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Troubleshooting

### Le site affiche 403 Forbidden

**Cause** : Permissions incorrectes

**Solution** :
```bash
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr
```

### Le site affiche 502 Bad Gateway

**Cause** : Nginx mal configuré ou ne tourne pas

**Solution** :
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Les routes ne fonctionnent pas (404)

**Cause** : Manque `try_files` pour SPA

**Solution** : Vérifier dans `/etc/nginx/sites-available/testing.mesnew.fr` :
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### HTTPS ne fonctionne pas

**Cause** : Certificat non généré ou expiré

**Solution** :
```bash
sudo certbot --nginx -d testing.mesnew.fr
```

### Les fichiers GLB ne se chargent pas

**Cause** : Taille limite Nginx dépassée

**Solution** : Ajouter dans le server block Nginx :
```nginx
client_max_body_size 100M;
```

Puis :
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Analytics/Sentry ne fonctionnent pas

**Cause** : CSP bloque les requêtes

**Solution** : Vérifier que le CSP inclut bien :
```nginx
connect-src 'self' https://*.sentry.io https://plausible.io;
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io;
```

---

## Checklist de Déploiement

Avant de déployer :

- [ ] ✅ DNS configuré (testing.mesnew.fr → IP VPS)
- [ ] ✅ `.env` configuré avec les bonnes variables
- [ ] ✅ Build réussi (`npm run build`)
- [ ] ✅ Nginx configuré (`/etc/nginx/sites-available/testing.mesnew.fr`)
- [ ] ✅ Répertoire créé (`/var/www/testing.mesnew.fr`)
- [ ] ✅ Fichiers uploadés (rsync/scp)
- [ ] ✅ Permissions correctes (www-data:www-data)
- [ ] ✅ HTTPS configuré (Let's Encrypt)
- [ ] ✅ Headers de sécurité vérifiés
- [ ] ✅ Site accessible sur https://testing.mesnew.fr
- [ ] ✅ Sentry reçoit les événements
- [ ] ✅ Analytics trackent les visites
- [ ] ✅ Pas d'erreurs dans la console browser

---

## Ressources

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot](https://certbot.eff.org/)
- [CSP Generator](https://report-uri.com/home/generate)
- [Security Headers Checker](https://securityheaders.com/)
- [SSL Test](https://www.ssllabs.com/ssltest/)

---

**Bon déploiement ! 🚀**

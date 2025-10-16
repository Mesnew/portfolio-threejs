# 🚀 Setup Direct sur VPS - testing.mesnew.fr

Guide pour configurer et héberger le portfolio 3D directement depuis le repo cloné sur votre VPS.

**Prérequis** :
- ✅ Repo cloné sur le VPS
- ✅ DNS `testing.mesnew.fr` pointant vers l'IP du VPS

---

## 📍 Étape 1 : Se Connecter au VPS et Localiser le Projet

```bash
# Depuis votre machine locale
ssh root@VOTRE_IP_VPS

# Trouver où est le repo cloné
cd /chemin/vers/portfolio-threejs
# Exemple : cd /root/portfolio-threejs ou cd /home/mesnew/portfolio-threejs

# Vérifier qu'on est au bon endroit
ls -la
# Vous devriez voir : package.json, vite.config.js, src/, etc.
```

---

## 📍 Étape 2 : Installer Node.js (si pas déjà installé)

```bash
# Vérifier si Node.js est installé
node --version
npm --version

# Si pas installé ou version < 18, installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version  # Doit afficher v20.x.x
npm --version   # Doit afficher 10.x.x
```

---

## 📍 Étape 3 : Installer les Dépendances

```bash
# Dans le dossier du projet
npm install

# Cela va prendre 2-3 minutes
# Attendre que "added XXX packages" s'affiche
```

---

## 📍 Étape 4 : Configurer les Variables d'Environnement

```bash
# Créer le fichier .env
cp .env.example .env
nano .env
```

Remplir avec vos clés :

```bash
# Sentry Error Monitoring (optionnel pour le test)
VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Analytics (optionnel pour le test)
VITE_PLAUSIBLE_DOMAIN=testing.mesnew.fr

# Version
VITE_APP_VERSION=1.0.0
```

**Note** : Si vous n'avez pas encore Sentry/Plausible, laissez vide ou commentez les lignes. Vous pourrez les ajouter plus tard.

**Sauvegarder** : `Ctrl+X`, puis `Y`, puis `Entrée`

---

## 📍 Étape 5 : Builder le Projet

```bash
# Dans le dossier du projet
npm run build

# Cela va créer un dossier dist/ avec tous les fichiers statiques
# Attendre 30-60 secondes

# Vérifier que le build a réussi
ls -lh dist/
# Vous devriez voir : index.html, assets/, models/, etc.
```

---

## 📍 Étape 6 : Créer le Répertoire Web

```bash
# Créer le dossier qui contiendra le site
sudo mkdir -p /var/www/testing.mesnew.fr

# Copier les fichiers buildés
sudo cp -r dist/* /var/www/testing.mesnew.fr/

# Vérifier que les fichiers sont bien copiés
ls -la /var/www/testing.mesnew.fr/
# Vous devriez voir : index.html, assets/, models/, etc.

# Configurer les permissions
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr
```

---

## 📍 Étape 7 : Configurer Nginx

### 7.1 Créer le fichier de configuration

```bash
sudo nano /etc/nginx/sites-available/testing.mesnew.fr
```

Copier-coller cette configuration :

```nginx
# Portfolio 3D - testing.mesnew.fr
server {
    listen 80;
    listen [::]:80;
    server_name testing.mesnew.fr;

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
               application/wasm image/svg+xml;

    # Security Headers (seront améliorés après HTTPS)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Limite de taille upload
    client_max_body_size 100M;

    # Cache statique
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|glb|gltf|bin)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bloquer fichiers cachés
    location ~ /\. {
        deny all;
    }

    # Bloquer fichiers sensibles
    location ~* \.(env|md|json|yml|log|bak)$ {
        deny all;
    }
}
```

**Sauvegarder** : `Ctrl+X`, puis `Y`, puis `Entrée`

### 7.2 Activer le site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/testing.mesnew.fr /etc/nginx/sites-enabled/

# Vérifier la configuration Nginx
sudo nginx -t

# Si "test is successful", recharger Nginx
sudo systemctl reload nginx

# Vérifier que Nginx tourne
sudo systemctl status nginx
```

---

## 📍 Étape 8 : Tester en HTTP

```bash
# Vérifier que le site est accessible en HTTP
curl -I http://testing.mesnew.fr

# Vous devriez voir : HTTP/1.1 200 OK
```

Depuis votre navigateur, visitez : **http://testing.mesnew.fr** (sans HTTPS pour l'instant)

Si ça fonctionne, passez à l'étape suivante pour configurer HTTPS !

---

## 📍 Étape 9 : Configurer HTTPS avec Let's Encrypt

```bash
# Installer Certbot si pas déjà fait
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Obtenir le certificat SSL
sudo certbot --nginx -d testing.mesnew.fr

# Répondre aux questions :
# - Email : votre-email@example.com
# - Accepter les conditions : Y
# - Partager email (optionnel) : N ou Y, à votre choix
# - Redirection HTTPS : 2 (Oui, rediriger HTTP vers HTTPS)
```

**Certbot va automatiquement** :
1. Générer le certificat SSL
2. Modifier la config Nginx
3. Ajouter la redirection HTTP → HTTPS
4. Recharger Nginx

### Vérifier le certificat

```bash
# Tester HTTPS
curl -I https://testing.mesnew.fr

# Vous devriez voir : HTTP/2 200
```

---

## 📍 Étape 10 : Ajouter les Headers de Sécurité Complets

Maintenant que HTTPS est configuré, ajoutons tous les headers de sécurité :

```bash
sudo nano /etc/nginx/sites-available/testing.mesnew.fr
```

Trouver le bloc `server` avec `listen 443 ssl` (ajouté par Certbot) et ajouter ces headers après la ligne `ssl_certificate_key` :

```nginx
    # Security Headers Complets
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.sentry.io https://plausible.io; worker-src 'self' blob:; child-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

**Sauvegarder** : `Ctrl+X`, puis `Y`, puis `Entrée`

Recharger Nginx :

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📍 Étape 11 : Vérifications Finales

### 11.1 Tester le site

```bash
# Vérifier HTTPS
curl -I https://testing.mesnew.fr

# Vérifier les headers de sécurité
curl -I https://testing.mesnew.fr | grep -i "strict-transport"
curl -I https://testing.mesnew.fr | grep -i "x-frame"
```

### 11.2 Dans le navigateur

Visitez : **https://testing.mesnew.fr**

1. ✅ Le site charge
2. ✅ Cadenas vert (HTTPS)
3. ✅ Ouvrir DevTools (F12) → Onglet **Console**
   - Pas d'erreurs rouges
4. ✅ Onglet **Network**
   - Vérifier que les assets chargent (modèles GLB, textures, etc.)

### 11.3 Tester les headers de sécurité

Visitez : https://securityheaders.com/?q=testing.mesnew.fr

**Score attendu** : A ou A+

---

## 📍 Étape 12 : Voir les Logs en Temps Réel

```bash
# Logs d'accès (visiteurs)
sudo tail -f /var/log/nginx/testing.mesnew.fr.access.log

# Logs d'erreur
sudo tail -f /var/log/nginx/testing.mesnew.fr.error.log

# Ctrl+C pour arrêter
```

---

## 🔄 Pour Mettre à Jour le Site Plus Tard

Quand vous modifiez le code :

```bash
# Sur le VPS, dans le dossier du projet
cd /chemin/vers/portfolio-threejs

# Pull les dernières modifications (si vous avez pushé sur GitHub)
git pull

# Ou modifier directement les fichiers
# nano src/main.js

# Rebuild
npm run build

# Copier les nouveaux fichiers
sudo cp -r dist/* /var/www/testing.mesnew.fr/

# Recharger le cache du navigateur avec Ctrl+Shift+R
```

---

## 🐛 Problèmes Courants

### Le site affiche "502 Bad Gateway"

```bash
# Vérifier que Nginx tourne
sudo systemctl status nginx

# Redémarrer Nginx
sudo systemctl restart nginx
```

### Le site affiche "403 Forbidden"

```bash
# Vérifier les permissions
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr
```

### "ERR_NAME_NOT_RESOLVED"

```bash
# Vérifier la propagation DNS
dig testing.mesnew.fr

# Attendre 10-15 minutes si le DNS vient d'être créé
```

### Certbot échoue

```bash
# Vérifier que le port 80 est ouvert
sudo ufw status

# Si le firewall bloque, autoriser HTTP et HTTPS
sudo ufw allow 'Nginx Full'
```

### Les modèles 3D ne chargent pas

```bash
# Vérifier que les fichiers GLB sont bien copiés
ls -lh /var/www/testing.mesnew.fr/models/

# Vérifier les logs d'erreur
sudo tail -f /var/log/nginx/testing.mesnew.fr.error.log
```

---

## ✅ Checklist Finale

- [ ] ✅ Node.js installé (v18+)
- [ ] ✅ Dépendances installées (`npm install`)
- [ ] ✅ `.env` configuré
- [ ] ✅ Build réussi (`npm run build`)
- [ ] ✅ Fichiers copiés dans `/var/www/testing.mesnew.fr`
- [ ] ✅ Nginx configuré et actif
- [ ] ✅ HTTPS configuré avec Let's Encrypt
- [ ] ✅ Headers de sécurité ajoutés
- [ ] ✅ Site accessible sur https://testing.mesnew.fr
- [ ] ✅ Pas d'erreurs dans la console browser
- [ ] ✅ Score A ou A+ sur securityheaders.com

---

## 📚 Commandes Récapitulatives

```bash
# Build + Deploy en une ligne (après la première installation)
cd /chemin/vers/portfolio-threejs && \
npm run build && \
sudo cp -r dist/* /var/www/testing.mesnew.fr/ && \
echo "✅ Déployé avec succès!"

# Voir les logs
sudo tail -f /var/log/nginx/testing.mesnew.fr.access.log

# Recharger Nginx après modification config
sudo nginx -t && sudo systemctl reload nginx

# Vérifier l'espace disque
df -h

# Nettoyer node_modules si besoin d'espace
rm -rf node_modules
```

---

**Votre site est maintenant en ligne ! 🚀**

Visitez : **https://testing.mesnew.fr**

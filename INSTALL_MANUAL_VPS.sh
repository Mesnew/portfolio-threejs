#!/bin/bash

# ============================================================================
# Installation Manuelle Directe sur VPS Ubuntu
# Copiez-collez ces commandes une par une dans votre terminal SSH
# ============================================================================

# 1. Se placer dans le dossier du projet
cd /chemin/vers/portfolio-threejs  # MODIFIER CE CHEMIN

# 2. Installer Node.js 20 si nécessaire
node --version || {
    echo "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
}

# 3. Installer les dépendances
npm install

# 4. Configurer .env
cp .env.example .env
echo "IMPORTANT : Éditez .env maintenant avec nano .env"
echo "Appuyez sur Entrée pour continuer..."
read
nano .env

# 5. Builder le projet
npm run build

# 6. Créer le répertoire web et copier les fichiers
sudo mkdir -p /var/www/testing.mesnew.fr
sudo cp -r dist/* /var/www/testing.mesnew.fr/
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr

# 7. Installer Nginx et Certbot si nécessaire
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 8. Créer la configuration Nginx
sudo tee /etc/nginx/sites-available/testing.mesnew.fr > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name testing.mesnew.fr;

    root /var/www/testing.mesnew.fr;
    index index.html;

    access_log /var/log/nginx/testing.mesnew.fr.access.log;
    error_log /var/log/nginx/testing.mesnew.fr.error.log;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/xml+rss application/json
               application/wasm image/svg+xml;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    client_max_body_size 100M;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|glb|gltf|bin)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }

    location ~* \.(env|md|json|yml|log|bak)$ {
        deny all;
    }
}
EOF

# 9. Activer le site
sudo ln -sf /etc/nginx/sites-available/testing.mesnew.fr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 10. Configurer HTTPS
echo "Configuration de HTTPS avec Let's Encrypt..."
sudo certbot --nginx -d testing.mesnew.fr

echo ""
echo "✅ Installation terminée !"
echo "🌐 Visitez : https://testing.mesnew.fr"

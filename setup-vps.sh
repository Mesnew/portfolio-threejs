#!/bin/bash

#################################################################################
# Script de Setup et Déploiement sur VPS
# À exécuter DIRECTEMENT sur le VPS depuis le dossier du projet cloné
# Usage: ./setup-vps.sh
#################################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WEB_DIR="/var/www/testing.mesnew.fr"
DOMAIN="testing.mesnew.fr"
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"

# ============================================================================
# FONCTIONS
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

check_command() {
    if command -v $1 &> /dev/null; then
        log_success "$1 est installé"
        return 0
    else
        log_warning "$1 n'est pas installé"
        return 1
    fi
}

# ============================================================================
# DÉBUT DU SCRIPT
# ============================================================================

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🚀 Setup Portfolio 3D sur VPS - testing.mesnew.fr${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ]; then
    log_error "package.json introuvable !"
    log_warning "Exécutez ce script depuis le dossier racine du projet"
    exit 1
fi

log_success "Dossier du projet détecté"
echo ""

# ============================================================================
# ÉTAPE 1 : VÉRIFIER LES PRÉREQUIS
# ============================================================================

log_info "📋 Vérification des prérequis..."
echo ""

# Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    log_info "Version Node.js : $NODE_VERSION"
else
    log_error "Node.js n'est pas installé !"
    log_info "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    log_success "Node.js installé"
fi

# npm
check_command npm || { log_error "npm manquant !"; exit 1; }

# nginx
if ! check_command nginx; then
    log_warning "Nginx n'est pas installé"
    log_info "Installation de Nginx..."
    sudo apt update
    sudo apt install -y nginx
    log_success "Nginx installé"
fi

# certbot
if ! check_command certbot; then
    log_warning "Certbot n'est pas installé"
    log_info "Installation de Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    log_success "Certbot installé"
fi

echo ""

# ============================================================================
# ÉTAPE 2 : INSTALLER LES DÉPENDANCES
# ============================================================================

log_info "📦 Installation des dépendances npm..."
echo ""

if [ ! -d "node_modules" ]; then
    npm install
    log_success "Dépendances installées"
else
    log_warning "node_modules existe déjà"
    read -p "Réinstaller les dépendances ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf node_modules package-lock.json
        npm install
        log_success "Dépendances réinstallées"
    else
        log_info "Installation ignorée"
    fi
fi

echo ""

# ============================================================================
# ÉTAPE 3 : CONFIGURER .ENV
# ============================================================================

log_info "🔧 Configuration des variables d'environnement..."
echo ""

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_warning ".env créé depuis .env.example"
        log_info "IMPORTANT : Éditez le fichier .env pour ajouter vos clés API"
        log_info "nano .env"
        echo ""
        read -p "Voulez-vous éditer .env maintenant ? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            nano .env
        fi
    else
        log_error ".env.example introuvable !"
        exit 1
    fi
else
    log_success ".env existe déjà"
fi

echo ""

# ============================================================================
# ÉTAPE 4 : BUILD DU PROJET
# ============================================================================

log_info "🏗️ Build du projet..."
echo ""

# Supprimer l'ancien build
if [ -d "dist" ]; then
    rm -rf dist
    log_info "Ancien build supprimé"
fi

# Build
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    log_error "Le build a échoué ou dist/ est vide !"
    exit 1
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
log_success "Build réussi ! Taille : $BUILD_SIZE"

echo ""

# ============================================================================
# ÉTAPE 5 : CRÉER LE RÉPERTOIRE WEB
# ============================================================================

log_info "📁 Configuration du répertoire web..."
echo ""

# Créer le répertoire
if [ ! -d "$WEB_DIR" ]; then
    sudo mkdir -p $WEB_DIR
    log_success "Répertoire créé : $WEB_DIR"
else
    log_warning "Répertoire existe déjà : $WEB_DIR"
fi

# Copier les fichiers
log_info "Copie des fichiers buildés..."
sudo cp -r dist/* $WEB_DIR/

# Permissions
sudo chown -R www-data:www-data $WEB_DIR
sudo chmod -R 755 $WEB_DIR

log_success "Fichiers déployés et permissions configurées"

echo ""

# ============================================================================
# ÉTAPE 6 : CONFIGURER NGINX
# ============================================================================

log_info "⚙️ Configuration Nginx..."
echo ""

if [ -f "$NGINX_CONFIG" ]; then
    log_warning "Config Nginx existe déjà : $NGINX_CONFIG"
    read -p "Écraser la configuration ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Configuration Nginx ignorée"
        SKIP_NGINX=true
    fi
fi

if [ "$SKIP_NGINX" != true ]; then
    # Copier la config depuis nginx-config.conf si elle existe
    if [ -f "nginx-config.conf" ]; then
        sudo cp nginx-config.conf $NGINX_CONFIG
        log_success "Configuration Nginx copiée depuis nginx-config.conf"
    else
        # Créer une config basique
        sudo tee $NGINX_CONFIG > /dev/null <<'EOF'
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
               application/javascript application/xml+rss application/json;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

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
}
EOF
        log_success "Configuration Nginx basique créée"
    fi

    # Activer le site
    if [ ! -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
        sudo ln -s $NGINX_CONFIG /etc/nginx/sites-enabled/
        log_success "Site activé dans Nginx"
    fi

    # Tester la config
    if sudo nginx -t; then
        log_success "Configuration Nginx valide"
        sudo systemctl reload nginx
        log_success "Nginx rechargé"
    else
        log_error "Configuration Nginx invalide !"
        exit 1
    fi
fi

echo ""

# ============================================================================
# ÉTAPE 7 : TESTER HTTP
# ============================================================================

log_info "🌐 Test de connexion HTTP..."
echo ""

sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200"; then
    log_success "Site accessible en HTTP : http://$DOMAIN"
else
    log_warning "Site non accessible en HTTP (peut-être un problème DNS)"
fi

echo ""

# ============================================================================
# ÉTAPE 8 : CONFIGURER HTTPS
# ============================================================================

log_info "🔒 Configuration HTTPS avec Let's Encrypt..."
echo ""

read -p "Configurer HTTPS maintenant ? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    log_info "Lancement de Certbot..."
    echo ""

    sudo certbot --nginx -d $DOMAIN

    if [ $? -eq 0 ]; then
        log_success "HTTPS configuré avec succès !"

        # Ajouter les security headers complets
        log_info "Ajout des headers de sécurité..."

        # On va ajouter les headers dans le bloc HTTPS (listen 443)
        # C'est un peu complexe avec sed, donc on informe l'utilisateur
        log_warning "Pour ajouter tous les headers de sécurité :"
        log_info "1. sudo nano $NGINX_CONFIG"
        log_info "2. Dans le bloc 'listen 443 ssl', ajoutez les headers du fichier nginx-config.conf"
        log_info "3. sudo nginx -t && sudo systemctl reload nginx"
    else
        log_error "Échec de la configuration HTTPS"
        log_warning "Vérifiez que le DNS pointe bien vers ce serveur"
    fi
else
    log_info "HTTPS ignoré (vous pourrez le configurer plus tard avec : sudo certbot --nginx -d $DOMAIN)"
fi

echo ""

# ============================================================================
# RÉSUMÉ FINAL
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "🎉 Installation terminée !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "Votre site est accessible sur :"
echo -e "  ${GREEN}→ http://$DOMAIN${NC}"
if sudo certbot certificates 2>&1 | grep -q $DOMAIN; then
    echo -e "  ${GREEN}→ https://$DOMAIN${NC}"
fi
echo ""
log_info "Commandes utiles :"
echo "  • Voir les logs : sudo tail -f /var/log/nginx/$DOMAIN.access.log"
echo "  • Mettre à jour : ./update-vps.sh (ou rebuild + cp manuellement)"
echo "  • Vérifier sécurité : https://securityheaders.com/?q=$DOMAIN"
echo ""
log_info "Prochaines étapes :"
echo "  1. Visitez votre site dans un navigateur"
echo "  2. Ouvrez DevTools (F12) pour vérifier les erreurs"
echo "  3. Configurez Sentry et Analytics dans .env si pas encore fait"
echo "  4. Testez les headers de sécurité sur securityheaders.com"
echo ""

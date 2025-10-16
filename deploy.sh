#!/bin/bash

#################################################################################
# Script de déploiement automatique pour testing.mesnew.fr
# Usage: ./deploy.sh
#################################################################################

set -e  # Arrêter le script en cas d'erreur

# ============================================================================
# CONFIGURATION - MODIFIER SELON VOTRE VPS
# ============================================================================

VPS_USER="root"                              # Utilisateur SSH
VPS_IP="VOTRE_IP_VPS"                        # IP de votre VPS OVH
VPS_PATH="/var/www/testing.mesnew.fr"        # Chemin distant
BUILD_DIR="dist"                              # Dossier de build local
BACKUP_ENABLED=true                           # Créer un backup avant déploiement
KEEP_BACKUPS=10                               # Nombre de backups à conserver

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# ============================================================================
# VÉRIFICATIONS PRÉALABLES
# ============================================================================

log_info "Starting deployment to testing.mesnew.fr..."
echo ""

# Vérifier que l'IP VPS est configurée
if [ "$VPS_IP" = "VOTRE_IP_VPS" ]; then
    log_error "Veuillez configurer VPS_IP dans le script !"
    log_warning "Éditez deploy.sh et remplacez VOTRE_IP_VPS par l'IP de votre VPS"
    exit 1
fi

# Vérifier que .env existe
if [ ! -f ".env" ]; then
    log_error "Fichier .env manquant !"
    log_warning "Créez le fichier .env avec vos variables d'environnement"
    log_info "Exemple : cp .env.example .env && nano .env"
    exit 1
fi

# Vérifier que node_modules existe
if [ ! -d "node_modules" ]; then
    log_warning "node_modules manquant. Installation des dépendances..."
    npm install
fi

# ============================================================================
# ÉTAPE 1 : BUILD DU PROJET
# ============================================================================

echo ""
log_info "📦 Building project..."

# Supprimer l'ancien build
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
fi

# Build
npm run build

if [ $? -ne 0 ]; then
    log_error "Build failed!"
    exit 1
fi

# Vérifier que le build a créé des fichiers
if [ ! -d "$BUILD_DIR" ] || [ -z "$(ls -A $BUILD_DIR)" ]; then
    log_error "Build directory is empty!"
    exit 1
fi

log_success "Build completed successfully"

# Afficher la taille du build
BUILD_SIZE=$(du -sh $BUILD_DIR | cut -f1)
log_info "Build size: $BUILD_SIZE"

# ============================================================================
# ÉTAPE 2 : BACKUP DISTANT (OPTIONNEL)
# ============================================================================

if [ "$BACKUP_ENABLED" = true ]; then
    echo ""
    log_info "💾 Creating backup on VPS..."

    ssh $VPS_USER@$VPS_IP "cd $VPS_PATH 2>/dev/null && \
        if [ -f index.html ]; then \
            tar -czf backup-\$(date +%Y%m%d-%H%M%S).tar.gz * 2>/dev/null; \
            echo 'Backup created'; \
        else \
            echo 'No existing files to backup'; \
        fi"

    if [ $? -eq 0 ]; then
        log_success "Backup created (if files existed)"
    else
        log_warning "Backup skipped or failed (not critical)"
    fi

    # Nettoyer les anciens backups
    log_info "Cleaning old backups (keeping last $KEEP_BACKUPS)..."
    ssh $VPS_USER@$VPS_IP "cd $VPS_PATH && \
        ls -t backup-*.tar.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f 2>/dev/null; \
        echo 'Old backups cleaned'"
fi

# ============================================================================
# ÉTAPE 3 : UPLOAD DES FICHIERS
# ============================================================================

echo ""
log_info "📤 Uploading files to VPS..."

# Vérifier que rsync est installé
if ! command -v rsync &> /dev/null; then
    log_error "rsync n'est pas installé !"
    log_warning "Installez-le avec : sudo apt install rsync (Linux) ou brew install rsync (Mac)"
    exit 1
fi

# Upload avec rsync
rsync -avz --delete --progress $BUILD_DIR/ $VPS_USER@$VPS_IP:$VPS_PATH/

if [ $? -ne 0 ]; then
    log_error "Upload failed!"
    log_warning "Vérifiez :"
    log_info "  1. Connexion SSH : ssh $VPS_USER@$VPS_IP"
    log_info "  2. Le répertoire existe : $VPS_PATH"
    log_info "  3. Les permissions sont correctes"
    exit 1
fi

log_success "Files uploaded successfully"

# ============================================================================
# ÉTAPE 4 : PERMISSIONS
# ============================================================================

echo ""
log_info "🔐 Setting correct permissions..."

ssh $VPS_USER@$VPS_IP "chown -R www-data:www-data $VPS_PATH && chmod -R 755 $VPS_PATH"

if [ $? -ne 0 ]; then
    log_error "Failed to set permissions!"
    exit 1
fi

log_success "Permissions set successfully"

# ============================================================================
# ÉTAPE 5 : VÉRIFICATIONS
# ============================================================================

echo ""
log_info "🔍 Running checks..."

# Vérifier que index.html existe
ssh $VPS_USER@$VPS_IP "test -f $VPS_PATH/index.html"
if [ $? -eq 0 ]; then
    log_success "index.html found"
else
    log_error "index.html not found!"
    exit 1
fi

# Vérifier Nginx
log_info "Checking Nginx configuration..."
ssh $VPS_USER@$VPS_IP "nginx -t" 2>&1 | grep -q "successful"
if [ $? -eq 0 ]; then
    log_success "Nginx configuration is valid"
else
    log_warning "Nginx configuration might have issues"
    log_info "Run manually: ssh $VPS_USER@$VPS_IP 'nginx -t'"
fi

# ============================================================================
# ÉTAPE 6 : RELOAD NGINX (OPTIONNEL)
# ============================================================================

# Décommenter si vous modifiez souvent la config Nginx
# echo ""
# log_info "🔄 Reloading Nginx..."
# ssh $VPS_USER@$VPS_IP "systemctl reload nginx"
# if [ $? -eq 0 ]; then
#     log_success "Nginx reloaded"
# else
#     log_warning "Nginx reload failed"
# fi

# ============================================================================
# RÉSUMÉ
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Deployment completed successfully! 🚀"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "🌐 Your site is now live at: ${GREEN}https://testing.mesnew.fr${NC}"
echo ""
log_info "Next steps:"
echo "  1. Visit https://testing.mesnew.fr"
echo "  2. Open DevTools (F12) to check for errors"
echo "  3. Check Sentry dashboard for errors"
echo "  4. Check Plausible/Analytics for visitor tracking"
echo ""
log_info "Useful commands:"
echo "  • View logs: ssh $VPS_USER@$VPS_IP 'tail -f /var/log/nginx/testing.mesnew.fr.access.log'"
echo "  • Restore backup: ssh $VPS_USER@$VPS_IP 'cd $VPS_PATH && tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz'"
echo ""

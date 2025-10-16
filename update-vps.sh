#!/bin/bash

#################################################################################
# Script de Mise à Jour Rapide sur VPS
# À exécuter sur le VPS depuis le dossier du projet
# Usage: ./update-vps.sh
#################################################################################

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
WEB_DIR="/var/www/testing.mesnew.fr"
DOMAIN="testing.mesnew.fr"

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
# DÉBUT
# ============================================================================

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🔄 Mise à Jour du Site - testing.mesnew.fr${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ]; then
    log_error "package.json introuvable ! Exécutez ce script depuis le dossier du projet."
    exit 1
fi

# ============================================================================
# ÉTAPE 1 : GIT PULL (OPTIONNEL)
# ============================================================================

if [ -d ".git" ]; then
    log_info "Dépôt Git détecté"
    read -p "Faire un git pull pour récupérer les dernières modifications ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Git pull..."
        git pull
        log_success "Code mis à jour depuis Git"
    else
        log_info "Git pull ignoré"
    fi
    echo ""
fi

# ============================================================================
# ÉTAPE 2 : INSTALLER/METTRE À JOUR LES DÉPENDANCES
# ============================================================================

log_info "Vérification des dépendances..."
read -p "Mettre à jour les dépendances npm ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install
    log_success "Dépendances mises à jour"
else
    log_info "Dépendances ignorées"
fi

echo ""

# ============================================================================
# ÉTAPE 3 : BACKUP (OPTIONNEL)
# ============================================================================

read -p "Créer un backup avant la mise à jour ? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    log_info "Création du backup..."
    BACKUP_FILE="$WEB_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    sudo tar -czf $BACKUP_FILE -C $WEB_DIR . 2>/dev/null || true

    if [ -f "$BACKUP_FILE" ]; then
        log_success "Backup créé : $BACKUP_FILE"
    else
        log_warning "Backup échoué (pas grave)"
    fi
fi

echo ""

# ============================================================================
# ÉTAPE 4 : BUILD
# ============================================================================

log_info "📦 Build du projet..."

# Supprimer l'ancien build
rm -rf dist

# Build
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    log_error "Le build a échoué !"
    exit 1
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
log_success "Build réussi ! Taille : $BUILD_SIZE"

echo ""

# ============================================================================
# ÉTAPE 5 : DÉPLOIEMENT
# ============================================================================

log_info "📤 Déploiement des fichiers..."

# Copier les fichiers
sudo cp -r dist/* $WEB_DIR/

# Permissions
sudo chown -R www-data:www-data $WEB_DIR
sudo chmod -R 755 $WEB_DIR

log_success "Fichiers déployés avec succès"

echo ""

# ============================================================================
# ÉTAPE 6 : VÉRIFICATIONS
# ============================================================================

log_info "🔍 Vérifications..."

# Vérifier que index.html existe
if [ -f "$WEB_DIR/index.html" ]; then
    log_success "index.html présent"
else
    log_error "index.html manquant !"
    exit 1
fi

# Tester la connexion
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200\|301\|302"; then
    log_success "Site accessible : https://$DOMAIN"
else
    log_warning "Site peut-être inaccessible (vérifiez manuellement)"
fi

# ============================================================================
# NETTOYAGE (OPTIONNEL)
# ============================================================================

echo ""
read -p "Nettoyer les anciens backups ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Nettoyage des backups (garde les 10 derniers)..."
    sudo bash -c "cd $WEB_DIR && ls -t backup-*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null" || true
    log_success "Anciens backups supprimés"
fi

# ============================================================================
# RÉSUMÉ
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "✅ Mise à jour terminée !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "🌐 Visitez votre site : ${GREEN}https://$DOMAIN${NC}"
log_warning "Pensez à vider le cache du navigateur (Ctrl+Shift+R)"
echo ""
log_info "Commandes utiles :"
echo "  • Logs temps réel : sudo tail -f /var/log/nginx/$DOMAIN.access.log"
echo "  • Restaurer backup : sudo tar -xzf $WEB_DIR/backup-YYYYMMDD-HHMMSS.tar.gz -C $WEB_DIR"
echo ""

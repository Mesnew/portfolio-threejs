#!/bin/bash

# ============================================================================
# Script de déploiement automatique vers VPS
# Usage: ./deploy-to-vps.sh
# ============================================================================

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration VPS
VPS_USER="root"
VPS_HOST="VOTRE_IP_VPS"  # À MODIFIER avec votre IP VPS
VPS_PROJECT_PATH="/root/portfolio-threejs"
VPS_WEB_PATH="/var/www/testing.mesnew.fr"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}║   🚀 Déploiement automatique vers testing.mesnew.fr             ║${NC}"
echo -e "${BLUE}║                                                                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Étape 1 : Vérifier que le VPS_HOST est configuré
if [ "$VPS_HOST" = "VOTRE_IP_VPS" ]; then
    echo -e "${RED}❌ Erreur: Vous devez modifier VPS_HOST dans le script !${NC}"
    echo -e "${YELLOW}Ouvrez deploy-to-vps.sh et remplacez VOTRE_IP_VPS par l'IP de votre VPS${NC}"
    exit 1
fi

# Étape 2 : Commit et push les modifications locales (optionnel)
echo -e "${YELLOW}📝 Voulez-vous commit et push vos modifications locales ? (y/n)${NC}"
read -r COMMIT_CHOICE

if [ "$COMMIT_CHOICE" = "y" ] || [ "$COMMIT_CHOICE" = "Y" ]; then
    echo -e "${BLUE}→ Ajout des fichiers modifiés...${NC}"
    git add .

    echo -e "${YELLOW}💬 Message de commit :${NC}"
    read -r COMMIT_MSG

    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update $(date +%Y-%m-%d\ %H:%M)"
    fi

    echo -e "${BLUE}→ Commit en cours...${NC}"
    git commit -m "$COMMIT_MSG"

    echo -e "${BLUE}→ Push vers le repository...${NC}"
    git push

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Push réussi !${NC}"
    else
        echo -e "${RED}❌ Erreur lors du push${NC}"
        exit 1
    fi
fi

# Étape 3 : Connexion au VPS et déploiement
echo ""
echo -e "${BLUE}→ Connexion au VPS ${VPS_HOST}...${NC}"
echo ""

ssh -t ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    # Couleurs dans SSH
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'

    echo -e "${BLUE}→ Navigation vers le projet...${NC}"
    cd /root/portfolio-threejs || exit 1

    echo -e "${BLUE}→ Récupération des dernières modifications (git pull)...${NC}"
    git pull

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors du git pull${NC}"
        exit 1
    fi

    echo -e "${BLUE}→ Installation des dépendances (npm install)...${NC}"
    npm install --silent

    echo -e "${BLUE}→ Build du projet (npm run build)...${NC}"
    npm run build

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors du build${NC}"
        exit 1
    fi

    echo -e "${BLUE}→ Vérification du dossier dist...${NC}"
    if [ ! -d "dist" ]; then
        echo -e "${RED}❌ Le dossier dist n'existe pas !${NC}"
        exit 1
    fi

    echo -e "${BLUE}→ Copie des fichiers vers /var/www/testing.mesnew.fr...${NC}"
    sudo cp -r dist/* /var/www/testing.mesnew.fr/

    echo -e "${BLUE}→ Application des permissions...${NC}"
    sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
    sudo chmod -R 755 /var/www/testing.mesnew.fr

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║   ✅ Déploiement terminé avec succès !                          ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║   🌐 Site accessible sur: https://testing.mesnew.fr            ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}║   💡 N'oubliez pas de vider le cache : Ctrl+Shift+R            ║${NC}"
    echo -e "${GREEN}║                                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Script de déploiement terminé !${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Une erreur s'est produite pendant le déploiement${NC}"
    echo ""
    exit 1
fi

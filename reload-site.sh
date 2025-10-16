#!/bin/bash

# ============================================================================
# Script de relancement du site (à placer sur le VPS)
# Usage: ./reload-site.sh
# ============================================================================

echo "🔄 Relancement du site testing.mesnew.fr..."
echo ""

# Build du projet
echo "📦 Build en cours..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

# Copie vers le répertoire web
echo "📂 Copie des fichiers..."
sudo cp -r dist/* /var/www/testing.mesnew.fr/

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la copie"
    exit 1
fi

# Application des permissions
sudo chown -R www-data:www-data /var/www/testing.mesnew.fr
sudo chmod -R 755 /var/www/testing.mesnew.fr

echo ""
echo "✅ Site relancé avec succès !"
echo "🌐 https://testing.mesnew.fr"
echo ""
echo "💡 N'oubliez pas de vider le cache du navigateur (Ctrl+Shift+R)"
echo ""

#!/bin/bash

# Script simple pour relancer le site sur le VPS
# Usage: ./reload.sh

VPS_HOST="VOTRE_IP_VPS"  # À MODIFIER avec votre IP VPS

echo "🔄 Relancement du site sur testing.mesnew.fr..."
echo ""

ssh ${VPS_HOST} << 'EOF'
cd /root/portfolio-threejs
npm run build
sudo cp -r dist/* /var/www/testing.mesnew.fr/
echo ""
echo "✅ Site relancé !"
echo "🌐 https://testing.mesnew.fr"
echo "💡 Faites Ctrl+Shift+R pour vider le cache"
EOF

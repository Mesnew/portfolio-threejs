# 🚀 Déploiement Rapide VPS - testing.mesnew.fr

Guide condensé pour déployer rapidement votre portfolio 3D sur votre VPS OVH.

Pour le guide détaillé complet, voir `DEPLOYMENT_VPS.md`.

---

## ⚡ Checklist 5 Minutes

### 1. Configuration Locale (2 min)

```bash
# Configurer les variables d'environnement
cp .env.example .env
nano .env

# Remplir :
# VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
# VITE_PLAUSIBLE_DOMAIN=testing.mesnew.fr
# VITE_APP_VERSION=1.0.0

# Configurer le script de déploiement
nano deploy.sh

# Modifier la ligne :
VPS_IP="VOTRE_IP_VPS"  # Remplacer par l'IP de votre VPS
```

### 2. Sur le VPS (2 min)

```bash
# Se connecter au VPS
ssh root@VOTRE_IP_VPS

# Créer le répertoire web
sudo mkdir -p /var/www/testing.mesnew.fr
sudo chown -R $USER:$USER /var/www/testing.mesnew.fr

# Copier la config Nginx
sudo nano /etc/nginx/sites-available/testing.mesnew.fr
# Copier-coller le contenu du fichier nginx-config.conf

# Activer le site
sudo ln -s /etc/nginx/sites-available/testing.mesnew.fr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Configurer HTTPS
sudo certbot --nginx -d testing.mesnew.fr
```

### 3. DNS OVH (1 min)

1. Aller sur https://www.ovh.com/manager/
2. Domaine `mesnew.fr` → **Zone DNS** → **Ajouter une entrée**
3. Type **A** :
   - Sous-domaine : `testing`
   - Cible : `IP_DE_VOTRE_VPS`
   - TTL : `3600`

Attendre 5-10 minutes pour la propagation.

### 4. Déploiement (30 secondes)

```bash
# Depuis votre machine locale
./deploy.sh
```

✅ **Terminé !** Visitez https://testing.mesnew.fr

---

## 📁 Fichiers Créés

- `DEPLOYMENT_VPS.md` - Guide complet détaillé
- `nginx-config.conf` - Configuration Nginx prête à l'emploi
- `deploy.sh` - Script de déploiement automatique
- `.env.example` - Template variables d'environnement

---

## 🔧 Commandes Utiles

```bash
# Build et déploiement automatique
./deploy.sh

# Voir les logs en temps réel
ssh root@IP_VPS "tail -f /var/log/nginx/testing.mesnew.fr.access.log"

# Vérifier que le site fonctionne
curl -I https://testing.mesnew.fr

# Recharger Nginx
ssh root@IP_VPS "nginx -t && systemctl reload nginx"
```

---

## 🐛 Problèmes Courants

### Le site affiche 403 Forbidden

```bash
ssh root@IP_VPS "chown -R www-data:www-data /var/www/testing.mesnew.fr && chmod -R 755 /var/www/testing.mesnew.fr"
```

### HTTPS ne fonctionne pas

```bash
ssh root@IP_VPS "certbot --nginx -d testing.mesnew.fr"
```

### Le DNS ne résout pas

```bash
# Vérifier la propagation DNS
dig testing.mesnew.fr
# Ou
nslookup testing.mesnew.fr
```

Attendre 10-15 minutes pour la propagation complète.

---

## ✅ Vérifications Post-Déploiement

1. **Site accessible** : https://testing.mesnew.fr ✅
2. **HTTPS fonctionne** : Cadenas vert dans le navigateur ✅
3. **Pas d'erreurs console** : F12 → Console ✅
4. **Headers sécurité** : https://securityheaders.com/?q=testing.mesnew.fr ✅
5. **Sentry reçoit events** : https://sentry.io ✅
6. **Analytics trackent** : Plausible ou GA4 ✅

---

## 📚 Pour Aller Plus Loin

Consultez `DEPLOYMENT_VPS.md` pour :
- Configuration avancée Nginx
- Optimisations de performance
- Monitoring et logs
- Backups et restauration
- Troubleshooting détaillé

---

**Besoin d'aide ?** Consultez le guide complet dans `DEPLOYMENT_VPS.md`

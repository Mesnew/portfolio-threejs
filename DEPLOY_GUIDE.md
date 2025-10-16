# 🚀 Guide de déploiement automatique

## Configuration initiale (à faire une seule fois)

### 1. Modifier l'IP du VPS dans le script

Ouvrez `deploy-to-vps.sh` et remplacez la ligne :
```bash
VPS_HOST="VOTRE_IP_VPS"
```

Par votre IP VPS, par exemple :
```bash
VPS_HOST="51.210.xxx.xxx"
```

### 2. Configurer l'accès SSH sans mot de passe (optionnel mais recommandé)

Sur votre machine locale :

```bash
# Générer une clé SSH si vous n'en avez pas
ssh-keygen -t ed25519 -C "votre-email@example.com"

# Copier la clé sur le VPS
ssh-copy-id root@VOTRE_IP_VPS

# Tester la connexion (ne devrait plus demander de mot de passe)
ssh root@VOTRE_IP_VPS
```

## Utilisation

### Déployer après des modifications

1. **Depuis votre machine locale** (dans le dossier du projet) :

```bash
./deploy-to-vps.sh
```

2. Le script va :
   - ✅ Proposer de commit et push vos modifications
   - ✅ Se connecter au VPS
   - ✅ Faire un `git pull`
   - ✅ Installer les dépendances
   - ✅ Builder le projet
   - ✅ Copier les fichiers vers `/var/www/testing.mesnew.fr`
   - ✅ Appliquer les bonnes permissions

3. **Vérifier le résultat** :
   - Ouvrir https://testing.mesnew.fr
   - Faire **Ctrl+Shift+R** (ou Cmd+Shift+R sur Mac) pour vider le cache

## Workflow recommandé

```bash
# 1. Faire vos modifications en local
# ... éditer les fichiers ...

# 2. Tester en local (optionnel)
npm run dev

# 3. Déployer automatiquement
./deploy-to-vps.sh
```

## Créer un alias pour aller encore plus vite

Ajoutez dans votre `~/.bashrc` ou `~/.zshrc` :

```bash
alias deploy='./deploy-to-vps.sh'
```

Puis rechargez :
```bash
source ~/.bashrc  # ou source ~/.zshrc
```

Maintenant vous pouvez juste taper :
```bash
deploy
```

## Dépannage

### Erreur "Permission denied"
```bash
chmod +x deploy-to-vps.sh
```

### Erreur SSH "Connection refused"
- Vérifiez que l'IP du VPS est correcte dans le script
- Vérifiez que le VPS est accessible : `ping VOTRE_IP_VPS`
- Vérifiez que SSH fonctionne : `ssh root@VOTRE_IP_VPS`

### Erreur "git pull failed"
Sur le VPS, vérifiez l'état du repo :
```bash
ssh root@VOTRE_IP_VPS
cd /root/portfolio-threejs
git status
```

### Le site ne se met pas à jour
- Videz le cache du navigateur : **Ctrl+Shift+R**
- Vérifiez que les fichiers ont bien été copiés :
```bash
ssh root@VOTRE_IP_VPS
ls -la /var/www/testing.mesnew.fr/
```

## Logs et debug

Si le déploiement échoue, vous verrez les erreurs directement dans le terminal.

Pour voir les logs Nginx :
```bash
ssh root@VOTRE_IP_VPS
sudo tail -f /var/log/nginx/testing.mesnew.fr.error.log
```

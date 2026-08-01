# Guide de Configuration de Sécurité - FireArena

## 🔒 Points Critiques Corrigés

### 1. Configuration Robot de Service
**Problème :** Le robot de service n'était pas configuré, rendant les règles Firestore inefficaces.

**Solution :**
- Ajout des variables `FIREBASE_ROBOT_EMAIL` et `FIREBASE_ROBOT_PASSWORD` dans `.env`
- Mise à jour de `firebase.ts` pour lire ces variables
- Configuration de `vite.config.ts` pour exposer ces variables au serveur

### 2. Admin UIDs Hardcodés
**Problème :** Les UIDs admin étaient en dur dans plusieurs fichiers, exposés dans le code client.

**Solution :**
- Création de `src/lib/admin-config.ts` pour centraliser la configuration
- Chargement des UIDs depuis la variable d'environnement `ADMIN_UIDS`
- Mise à jour de tous les fichiers pour utiliser cette configuration centralisée

### 3. Secret URL Admin
**Problème :** Le secret admin était codé en dur dans le code.

**Solution :**
- Déplacement du secret vers la variable `ADMIN_SECRET_KEY`
- Utilisation de `admin-config.ts` pour la gestion centralisée

### 4. Protection .gitignore
**Problème :** Le fichier `.env` pouvait être commité accidentellement.

**Solution :**
- Ajout explicite de `.env`, `.env.local`, `.env.production` au `.gitignore`
- Création de `.env.example` comme template

## 📋 Étapes de Configuration Obligatoires

### 1. Créer le Compte Robot Firebase

```bash
# Via Firebase Console ou CLI:
firebase login
firebase projects:addfirestorerules --project=mon-shop-70e50
```

**Dans Firebase Console:**
1. Allez dans Authentication → Users
2. Cliquez sur "Add user"
3. Email: `robotfirearena@gmail.com` (ou celui configuré dans .env)
4. Mot de passe: Utilisez un mot de passe fort (même que dans .env)
5. Vérifiez l'email

### 2. Configurer les Variables d'Environnement

```bash
# Copiez le template
cp .env.example .env

# Éditez .env avec vos valeurs réelles
nano .env
```

**Variables critiques à configurer:**
```bash
FIREBASE_ROBOT_EMAIL="robotfirearena@gmail.com"
FIREBASE_ROBOT_PASSWORD="votre_mot_de_passe_complexe"
ADMIN_UIDS="votre_uid_admin_1,votre_uid_admin_2"
ADMIN_SECRET_KEY="votre_secret_url_admin"
```

### 3. Mettre à Jour les Règles Firestore

**Éditez `firestore.rules` si nécessaire:**
```javascript
// Si vous changez l'email du robot, mettez à jour cette ligne:
function isRobot() {
  return request.auth != null && request.auth.token.email == 'votre_robot_email@gmail.com';
}

// Si vous ajoutez des admins, mettez à jour cette liste:
function isAdmin() {
  return request.auth != null && request.auth.uid in [
    'uid_admin_1',
    'uid_admin_2'
  ];
}
```

**Déployez les règles:**
```bash
firebase deploy --only firestore:rules
```

### 4. Vérifier la Configuration

**Test local:**
```bash
npm run dev
```

**Vérifiez dans la console:**
- `[firebase] Serveur authentifié en tant que robot de service ✓` (doit apparaître)
- Si vous voyez un avertissement, le robot n'est pas correctement configuré

## 🚨 Points d'Attention

### Avant le Déploiement en Production

1. **Changez le mot de passe du robot** - N'utilisez jamais "CHANGEZ_CE_MOT_DE_PASSE"
2. **Changez le secret admin** - Utilisez un secret complexe et unique
3. **Vérifiez les UIDs admin** - Assurez-vous qu'ils correspondent aux vrais comptes
4. **Testez les transactions PXP** - Vérifiez que les transferts fonctionnent
5. **Déployez les règles Firestore** - Sans cela, la sécurité ne fonctionne pas

### Surveillance

**Logs à surveiller:**
- `[firebase] Compte robot non configuré` → Configuration incorrecte
- Erreurs de permission Firestore → Règles non déployées
- Transactions PXP qui échouent → Robot non authentifié

## 🔐 Architecture de Sécurité

### Flux de Transaction PXP

```
Client (Frontend)
    ↓ (idToken)
Fonction Serveur (verifyIdToken)
    ↓ (robot authentifié)
Firestore (règles: isRobot())
    ↓ (transaction atomique)
Écriture PXP + Logging
```

### Protection en Couches

1. **Couche Client:** Validation basique (UI)
2. **Couche Serveur:** Validation stricte + ID token
3. **Couche Firestore:** Règles de sécurité (robot uniquement)
4. **Couche Transaction:** Atomicité + Rollback automatique

## 📝 Checklist de Déploiement

- [ ] Compte robot Firebase créé
- [ ] Variables .env configurées
- [ ] Mot de passe robot changé
- [ ] UIDs admin vérifiés
- [ ] Secret admin changé
- [ ] Règles Firestore mises à jour
- [ ] Règles Firestore déployées
- [ ] .gitignore vérifié (.env non commité)
- [ ] Transactions PXP testées
- [ ] Logs serveur vérifiés

## 🆘 Dépannage

### Problème: "Compte robot non configuré"
**Solution:** Vérifiez que `FIREBASE_ROBOT_EMAIL` et `FIREBASE_ROBOT_PASSWORD` sont dans `.env`

### Problème: "Permission denied" sur Firestore
**Solution:** Déployez les règles Firestore: `firebase deploy --only firestore:rules`

### Problème: Transactions PXP échouent
**Solution:** Vérifiez que le robot est authentifié (logs serveur)

### Problème: Accès admin refusé
**Solution:** Vérifiez que votre UID est dans `ADMIN_UIDS` dans `.env`

## 📚 Documentation Additionnelle

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [TanStack Start Server Functions](https://tanstack.com/start/latest)
- [Environment Variables Best Practices](https://12factor.net/config)

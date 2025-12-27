# AmmoCommand v2.3 🎯

Application de gestion de commandes groupées de munitions pour club de tir.

## 🚀 Fonctionnalités

### Espace Tireur
- **Commande Facile** : Sélection intuitive des quantités (24g / 28g).
- **Historique** : Suivi des commandes passées et de leur statut (Payé, Livré).
- **Profil** : Gestion automatique des informations licenciés.
- **Sécurité** : Authentification email/mot de passe.

### Espace Admin
- **Tableau de Bord** : Vue d'ensemble du Chiffre d'Affaires et des volumes.
- **Suivi des Paiements** : Gestion des acomptes et des soldes (Espèces, Chèque, Virement).
- **Logistique** : Marquage des commandes comme "Livrées".
- **Configuration** : Modification dynamique des tarifs via l'interface.

## 🛠 Installation

1. Cloner le projet :
   ```bash
   git clone https://github.com/VOTRE_USER/AmmoCommand.git
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configuration :
   Créez un fichier `.env` à la racine (basé sur `.env.example` si disponible) avec vos clés Firebase :
   ```env
   VITE_FIREBASE_API_KEY=votre_api_key
   VITE_FIREBASE_AUTH_DOMAIN=...
   ...
   ```

4. Lancer le projet :
   ```bash
   npm run dev
   ```

## 🔒 Sécurité

Ce projet utilise `firebase/auth` pour l'authentification et `firebase/firestore` pour les données.
Les clés API ne sont **JAMAIS** stockées dans le code source mais chargées via des variables d'environnement.

## 📝 Auteur

Développé pour la gestion interne de club de tir.
Version 2.3
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase via Variables d'Environnement
// IMPORTANT : Ne jamais mettre les clés en dur ici pour GitHub

// Cast import.meta to any to avoid TypeScript error "Property 'env' does not exist on type 'ImportMeta'"
// Fallback to empty object if import.meta.env is undefined
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// Vérification de sécurité pour le développement
if (!firebaseConfig.apiKey) {
  console.error("ERREUR CRITIQUE: Les clés Firebase sont manquantes. Vérifiez votre fichier .env ou la configuration Vercel.");
}

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Initialisation des services
export const auth = getAuth(app);
export const db = getFirestore(app);
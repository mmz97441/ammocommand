import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase
// Les valeurs sont chargées depuis le fichier .env (ex: .env.local ou .env.production)
// Assurez-vous que les variables commencent par VITE_

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
};

// Vérification de sécurité pour le développement
if (!firebaseConfig.apiKey) {
  console.error("ERREUR CRITIQUE: Les clés Firebase sont manquantes. Vérifiez votre fichier .env");
}

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Initialisation des services
export const auth = getAuth(app);
export const db = getFirestore(app);
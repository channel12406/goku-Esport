import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, inMemoryPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDJCHm6KetdTztLULSXoXomXDDPRfrurYg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mon-shop-70e50.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mon-shop-70e50",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mon-shop-70e50.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "482743719018",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:482743719018:web:2a954ccd8eec9c94c82613",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const serverDb: Firestore = getFirestore(app);

// ─── Robot de service ─────────────────────────────────────────────────────────
// Le serveur se connecte à Firestore avec un compte "robot" privilégié
// (variables FIREBASE_ROBOT_EMAIL / FIREBASE_ROBOT_PASSWORD). Les règles
// Firestore n'autorisent alors que ce robot à écrire sur les collections
// sensibles (PXP, profils, tournois…), ce qui bloque toute fraude client.
// Sans configuration, le serveur fonctionne comme avant (mode ouvert).

const ROBOT_EMAIL = import.meta.env.FIREBASE_ROBOT_EMAIL || process.env.FIREBASE_ROBOT_EMAIL;
const ROBOT_PASSWORD =
  import.meta.env.FIREBASE_ROBOT_PASSWORD || process.env.FIREBASE_ROBOT_PASSWORD;

let robotReadyPromise: Promise<void> | null = null;

async function signInRobot(): Promise<void> {
  if (!ROBOT_EMAIL || !ROBOT_PASSWORD) {
    const message =
      "[firebase] Compte robot non configuré (FIREBASE_ROBOT_EMAIL/FIREBASE_ROBOT_PASSWORD). " +
      "Toutes les écritures Firestore serveur échoueront avec PERMISSION_DENIED.";
    if (import.meta.env.PROD) {
      throw new Error(message);
    }
    console.warn(message);
    return;
  }
  const auth = getAuth(app);
  await auth.setPersistence(inMemoryPersistence);
  await signInWithEmailAndPassword(auth, ROBOT_EMAIL, ROBOT_PASSWORD);
  console.log("[firebase] Serveur authentifié en tant que robot de service ✓");
}

// Attendu par les fonctions serveur : garantit que le robot est connecté
// avant tout accès Firestore.
export function ensureServerReady(): Promise<void> {
  if (!robotReadyPromise) {
    robotReadyPromise = signInRobot().catch((err) => {
      console.error("[firebase] Échec de l'authentification robot:", err);
      robotReadyPromise = null;
      throw err;
    });
  }
  return robotReadyPromise;
}

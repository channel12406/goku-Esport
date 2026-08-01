import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDJCHm6KetdTztLULSXoXomXDDPRfrurYg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mon-shop-70e50.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://mon-shop-70e50-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mon-shop-70e50",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mon-shop-70e50.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "482743719018",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:482743719018:web:2a954ccd8eec9c94c82613",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9GDLN6SFS3",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

let analytics: ReturnType<(typeof import("firebase/analytics"))["getAnalytics"]> | null = null;
if (typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) analytics = getAnalytics(app);
    });
  });
}
export { analytics };

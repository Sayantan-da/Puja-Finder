import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
} else {
  // If not configured, initialize with minimal placeholder if safe, or keep null
  try {
    app = getApps().length === 0 ? initializeApp({
      apiKey: "AIzaSyMockKeyForDevOnly1234567890",
      authDomain: "pujafinder-dev.firebaseapp.com",
      projectId: "pujafinder-dev",
      appId: "1:1234567890:web:abcdef"
    }) : getApps()[0];
    auth = getAuth(app);
  } catch {
    // Ignored in dev
  }
}

export { app, auth };

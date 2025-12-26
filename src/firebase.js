import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Get config from Electron bridge (priority) or process.env (fallback)
const bridgeConfig = window.electronAPI?.getFirebaseConfigSync?.();

const firebaseConfig = {
    apiKey: bridgeConfig?.apiKey || process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: bridgeConfig?.authDomain || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: bridgeConfig?.projectId || process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: bridgeConfig?.storageBucket || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: bridgeConfig?.messagingSenderId || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: bridgeConfig?.appId || process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: bridgeConfig?.measurementId || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
if (!firebaseConfig.apiKey) {
    console.error('Firebase API Key is missing! Check .env file and restart app.');
}
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

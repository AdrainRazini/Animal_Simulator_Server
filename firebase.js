import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAFcTol_ZewYrft-wflOdgNEPn6kzJ5qpo",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "data-server-ids.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "data-server-ids",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "data-server-ids.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "878117229677",
  appId: process.env.FIREBASE_APP_ID || "1:878117229677:web:7b008a3fa3c6fd59811b64",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

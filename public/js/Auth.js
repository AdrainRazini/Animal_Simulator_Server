// public/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:"AIzaSyAFcTol_ZewYrft-wflOdgNEPn6kzJ5qpo",
  authDomain:"data-server-ids.firebaseapp.com",
  projectId:"data-server-ids",
  storageBucket:"data-server-ids.firebasestorage.app",
  messagingSenderId:"878117229677",
  appId:"1:878117229677:web:7b008a3fa3c6fd59811b64",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, db, provider };

// Conexão com os Dados 
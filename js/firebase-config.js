// Remplace ces valeurs par celles de ta console Firebase
// (Paramètres du projet > Vos applications > Config)
const firebaseConfig = {
  apiKey: "TON_API_KEY",
  authDomain: "suuf-xxxxx.firebaseapp.com",
  projectId: "suuf-xxxxx",
  storageBucket: "suuf-xxxxx.appspot.com",
  messagingSenderId: "TON_SENDER_ID",
  appId: "TON_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Storage nécessite le forfait Blaze sur Firebase (pas encore activé).
// On tente l'init sans bloquer le reste de l'app si ça échoue.
let storage = null;
try {
  storage = firebase.storage();
} catch (e) {
  console.warn("Firebase Storage non disponible (forfait Blaze requis). Upload de documents désactivé pour l'instant.", e);
}

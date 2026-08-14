const firebaseConfig = {
  apiKey: "AIzaSyBWNp8bvcWZrs3B0l_IOJiWOJzp4iK92ro",
  authDomain: "suuf-5365e.firebaseapp.com",
  projectId: "suuf-5365e",
  storageBucket: "suuf-5365e.firebasestorage.app",
  messagingSenderId: "928795399084",
  appId: "1:928795399084:web:2881a89477ecf13fd1a009"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let storage = null;
try {
  storage = firebase.storage();
} catch (e) {
  console.warn("Firebase Storage non disponible (forfait Blaze requis). Upload de documents désactivé pour l'instant.", e);
}
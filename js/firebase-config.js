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
const storage = firebase.storage();

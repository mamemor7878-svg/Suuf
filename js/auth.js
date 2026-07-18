// ===== Authentification Suuf =====
// Inscription email/mot de passe avec choix du rôle (vendeur / acheteur / notaire)

function inscrire(email, motDePasse, nom, role) {
  return auth.createUserWithEmailAndPassword(email, motDePasse)
    .then((cred) => {
      return db.collection('users').doc(cred.user.uid).set({
        nom: nom,
        email: email,
        role: role, // "vendeur" | "acheteur" | "notaire"
        verifie: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
}

function connecter(email, motDePasse) {
  return auth.signInWithEmailAndPassword(email, motDePasse);
}

function deconnecter() {
  return auth.signOut();
}

// Observer l'état de connexion
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Connecté :", user.uid);
    // charger le profil utilisateur depuis Firestore
  } else {
    console.log("Non connecté");
  }
});

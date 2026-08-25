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

// Finalise le profil Firestore d'un compte créé par téléphone (l'inscription
// par téléphone crée d'abord le compte Auth via le code SMS, puis demande le
// nom et le rôle dans un second écran — c'est ce second écran qui appelle
// cette fonction). Trouvé manquant : app.js l'appelait déjà sans qu'elle
// n'existe nulle part dans le code, ce qui cassait silencieusement la fin de
// l'inscription par téléphone (erreur JS non affichée à l'utilisateur).
function completerProfilTelephone(nom, role) {
  const user = auth.currentUser;
  return db.collection('users').doc(user.uid).set({
    nom: nom,
    telephone: user.phoneNumber || '',
    role: role, // "vendeur" | "acheteur" | "notaire"
    verifie: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function deconnecter() {
  // On retire le token push de ce compte avant de se déconnecter : sur un
  // appareil partagé (un proche qui se connecte ensuite avec son propre
  // compte sur le même téléphone), ça évite que l'ancien utilisateur continue
  // de recevoir les notifications destinées au nouveau. Ça doit rester best
  // effort : une erreur ici ne doit jamais empêcher la déconnexion elle-même.
  const uid = auth.currentUser && auth.currentUser.uid;
  const nettoyageToken = uid
    ? db.collection('users').doc(uid).update({ fcmToken: firebase.firestore.FieldValue.delete() }).catch(() => {})
    : Promise.resolve();
  return nettoyageToken.then(() => auth.signOut());
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

// ===== Notifications push (pont natif iOS uniquement) =====
//
// Ce fichier ne fait quelque chose que dans l'app iOS native (WKWebView) : les
// handlers `window.webkit.messageHandlers.push-*` sont injectés côté natif
// (voir ios/Suuf/WebView.swift + ios/Suuf/PushNotifications.swift). Sur le web
// classique (navigateur, PWA installée hors app iOS), ces handlers n'existent
// pas — toutes les fonctions ci-dessous deviennent silencieusement des no-op,
// rien ne casse.

function bridgeNatifPushDisponible() {
  return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers['push-token']);
}

// Déclenche la demande de permission système iOS. Ne s'affiche réellement que
// la toute première fois (iOS ne re-propose jamais après un premier choix) ;
// si déjà autorisé ou refusé, le natif répond directement sans rien afficher.
function demanderPermissionPush() {
  if (!bridgeNatifPushDisponible()) return;
  window.webkit.messageHandlers['push-permission-request'].postMessage('');
}

function demanderTokenPush() {
  if (!bridgeNatifPushDisponible()) return;
  window.webkit.messageHandlers['push-token'].postMessage('');
}

// Enregistre le token FCM de cet appareil sur le profil Firestore de
// l'utilisateur connecté, pour que la Cloud Function puisse lui envoyer des
// notifications plus tard. `set(..., {merge:true})` plutôt que `update()` :
// si le document n'existe pas encore pour une raison quelconque, ça ne doit
// pas faire échouer silencieusement l'enregistrement du token.
function enregistrerTokenPush(token) {
  if (!token || token === 'ERROR GET TOKEN' || !auth.currentUser) return;
  db.collection('users').doc(auth.currentUser.uid).set({ fcmToken: token }, { merge: true })
    .catch(err => console.error('Erreur enregistrement token push :', err));
}

window.addEventListener('push-permission-request', (e) => {
  if (e.detail === 'granted') demanderTokenPush();
});

window.addEventListener('push-token', (e) => {
  enregistrerTokenPush(e.detail);
});

// L'utilisateur touche une notification système (app en arrière-plan ou
// fermée) : on l'amène directement dans la conversation concernée si on a son
// identifiant (transmis via le champ `data.conversationId` de la notification
// côté Cloud Function), sinon simplement sur l'onglet Messages.
window.addEventListener('push-notification-click', (e) => {
  const conversationId = e.detail && e.detail.conversationId;
  if (conversationId && auth.currentUser) {
    ouvrirChat(conversationId, 'Conversation');
  } else {
    goTo('messages');
  }
});

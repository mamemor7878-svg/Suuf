// ===== Messagerie in-app =====

function demarrerConversation(terrainId, autreUserId) {
  const userId = auth.currentUser.uid;
  const participants = [userId, autreUserId].sort();
  const convId = `${terrainId}_${participants.join('_')}`;

  return db.collection('conversations').doc(convId).set({
    participants: participants,
    terrainId: terrainId,
    dernierMessage: '',
    dernierMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    // On marque tout de suite la conversation comme "lue" pour son créateur : sans
    // ça, tant qu'il n'y a aucun message, dernierMessageAt existerait déjà mais
    // luPar serait vide et la conversation apparaîtrait à tort comme non lue.
    [`luPar.${userId}`]: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).then(() => convId);
}

function envoyerMessage(conversationId, texte) {
  const userId = auth.currentUser.uid;
  const msgRef = db.collection('conversations').doc(conversationId)
    .collection('messages').doc();

  return msgRef.set({
    expediteurId: userId,
    texte: texte,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    return db.collection('conversations').doc(conversationId).update({
      dernierMessage: texte,
      dernierMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      // L'expéditeur a évidemment déjà "lu" son propre message : on met à jour son
      // luPar en même temps, sinon sa propre conversation s'afficherait comme non lue.
      [`luPar.${userId}`]: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

// Marque la conversation comme lue par l'utilisateur courant (appelée à l'ouverture
// d'un fil de discussion). N'écrase que sa propre entrée dans luPar grâce à la
// notation par chemin de champ calculé — les autres participants ne sont pas touchés.
function marquerConversationLue(conversationId) {
  const userId = auth.currentUser.uid;
  return db.collection('conversations').doc(conversationId).update({
    [`luPar.${userId}`]: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function ecouterMessages(conversationId, callback, onError) {
  return db.collection('conversations').doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(messages);
    }, (err) => {
      console.error('Erreur ecouterMessages :', err);
      if (onError) onError(err);
    });
}

function mesConversations(callback, onError) {
  const userId = auth.currentUser.uid;
  return db.collection('conversations')
    .where('participants', 'array-contains', userId)
    .orderBy('dernierMessageAt', 'desc')
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      // Erreur la plus probable ici : index composite Firestore manquant pour
      // (participants array-contains + orderBy dernierMessageAt). Firestore renvoie
      // alors un message d'erreur contenant un lien direct pour créer l'index.
      console.error('Erreur mesConversations :', err);
      if (onError) onError(err);
    });
}

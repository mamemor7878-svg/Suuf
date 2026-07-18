// ===== Messagerie in-app =====

function demarrerConversation(terrainId, autreUserId) {
  const userId = auth.currentUser.uid;
  const participants = [userId, autreUserId].sort();
  const convId = `${terrainId}_${participants.join('_')}`;

  return db.collection('conversations').doc(convId).set({
    participants: participants,
    terrainId: terrainId,
    dernierMessage: '',
    dernierMessageAt: firebase.firestore.FieldValue.serverTimestamp()
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
      dernierMessageAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

function ecouterMessages(conversationId, callback) {
  return db.collection('conversations').doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(messages);
    });
}

function mesConversations(callback) {
  const userId = auth.currentUser.uid;
  return db.collection('conversations')
    .where('participants', 'array-contains', userId)
    .orderBy('dernierMessageAt', 'desc')
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

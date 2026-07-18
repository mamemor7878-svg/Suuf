// ===== Annuaire notaires & demandes de mise en relation =====

function listerNotaires(filtres = {}) {
  let query = db.collection('notaires').where('disponible', '==', true);

  if (filtres.ville) query = query.where('ville', '==', filtres.ville);
  if (filtres.specialite) query = query.where('specialite', '==', filtres.specialite);

  return query.get().then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

function solliciterNotaire(terrainId, notaireId) {
  const userId = auth.currentUser.uid;

  return db.collection('terrains').doc(terrainId).get().then(terrainDoc => {
    const terrain = terrainDoc.data();

    return db.collection('demandesNotaire').add({
      terrainId: terrainId,
      acheteurId: userId,
      vendeurId: terrain.vendeurId,
      notaireId: notaireId,
      statut: 'en_attente', // en_attente | accepte | traite
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

function mesDemandesNotaire(callback) {
  const userId = auth.currentUser.uid;
  return db.collection('demandesNotaire')
    .where('acheteurId', '==', userId)
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

// ===== Gestion des terrains =====

function publierTerrain(data, fichierTitre, photos) {
  const vendeurId = auth.currentUser.uid;
  const terrainRef = db.collection('terrains').doc();

  const uploads = [];

  if (fichierTitre && storage) {
    const refDoc = storage.ref(`documents/${terrainRef.id}/titre_foncier`);
    uploads.push(refDoc.put(fichierTitre).then(snap => snap.ref.getDownloadURL()));
  } else if (fichierTitre && !storage) {
    console.warn("Document non uploadé : Storage n'est pas encore activé (forfait Blaze requis).");
  }

  return Promise.all(uploads).then((urls) => {
    return terrainRef.set({
      vendeurId: vendeurId,
      titre: data.titre,
      superficie: data.superficie,
      prix: data.prix,
      statutJuridique: data.statutJuridique, // "titre_foncier" | "bail" | "non_loti" (terrains uniquement)
      typeBien: data.typeBien || 'terrain', // "terrain" | "logement"
      typeTransaction: data.typeTransaction || 'vente', // "vente" | "location"
      typeLogement: data.typeLogement || null, // "maison" | "appartement" (logements uniquement)
      chambres: data.chambres != null ? data.chambres : null,
      meuble: !!data.meuble,
      localisation: data.localisation, // {lat, lng}
      zone: data.zone,
      description: data.description || '',
      documentsUrl: urls,
      scoreConfiance: {
        titreVerifie: false,
        bornageGPS: false,
        litiges: 0
      },
      statut: 'disponible', // visible immédiatement (modération manuelle désactivée pour la phase de test)
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

function rechercherTerrains(filtres = {}) {
  let query = db.collection('terrains').where('statut', '==', 'disponible');

  if (filtres.statutJuridique) {
    query = query.where('statutJuridique', '==', filtres.statutJuridique);
  }
  if (filtres.zone) {
    query = query.where('zone', '==', filtres.zone);
  }

  return query.get().then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

function getTerrain(terrainId) {
  return db.collection('terrains').doc(terrainId).get()
    .then(doc => ({ id: doc.id, ...doc.data() }));
}

function modifierTerrain(terrainId, data, fichierTitre) {
  const terrainRef = db.collection('terrains').doc(terrainId);
  const miseAJour = {
    titre: data.titre,
    zone: data.zone,
    superficie: data.superficie,
    statutJuridique: data.statutJuridique,
    typeBien: data.typeBien || 'terrain',
    typeTransaction: data.typeTransaction || 'vente',
    typeLogement: data.typeLogement || null,
    chambres: data.chambres != null ? data.chambres : null,
    meuble: !!data.meuble,
    prix: data.prix,
    description: data.description,
    localisation: data.localisation
  };

  if (fichierTitre && storage) {
    const refDoc = storage.ref(`documents/${terrainId}/titre_foncier`);
    return refDoc.put(fichierTitre).then(snap => snap.ref.getDownloadURL()).then(url => {
      miseAJour.documentsUrl = [url];
      return terrainRef.update(miseAJour);
    });
  }

  return terrainRef.update(miseAJour);
}

function supprimerTerrain(terrainId) {
  const supprimerDoc = storage
    ? storage.ref(`documents/${terrainId}/titre_foncier`).delete().catch(() => {})
    : Promise.resolve();

  return supprimerDoc.then(() => db.collection('terrains').doc(terrainId).delete());
}

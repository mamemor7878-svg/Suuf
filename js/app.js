// ===== app.js : navigation + orchestration de l'UI =====

let profilCourant = null;
let terrainCourantId = null;
let conversationCouranteId = null;
let roleInscription = 'acheteur';
let roleInscriptionTel = 'acheteur';
let modeAuth = 'connexion'; // 'connexion' | 'inscription'
let methodeAuth = 'email'; // 'email' | 'telephone'
let terrainEnEditionId = null; // id du terrain en cours de modification, ou null si on publie une nouvelle annonce
let entreeParEdition = false; // évite que goTo('publier') réinitialise le formulaire quand on arrive via "Modifier"

// Écrans qui nécessitent obligatoirement un compte connecté. Explorer, la fiche
// d'un terrain et l'annuaire des notaires restent consultables librement, sans
// connexion (conformité App Store : un compte ne doit être exigé que pour les
// fonctionnalités qui en ont réellement besoin).
const ECRANS_PROTEGES = ['publier', 'messages', 'chat', 'profil', 'mes-annonces', 'mes-demandes', 'notifications', 'confidentialite'];

function goTo(screenName) {
  if (ECRANS_PROTEGES.includes(screenName) && !auth.currentUser) {
    screenName = 'auth';
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === screenName));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.go === screenName));
  if (screenName === 'recherche') chargerTerrains();
  if (screenName === 'messages') chargerConversations();
  if (screenName === 'notaires') chargerNotaires();
  if (screenName === 'profil') chargerProfil();
  if (screenName === 'mes-annonces') chargerMesAnnonces();
  if (screenName === 'mes-demandes') chargerMesDemandes();
  if (screenName === 'notifications') chargerNotifications();
  if (screenName === 'publier') {
    initCartePublier();
    if (!entreeParEdition) {
      terrainEnEditionId = null;
      document.getElementById('publierTitre').textContent = 'Publier un terrain';
      document.getElementById('publierSubmitBtn').textContent = "Publier l'annonce";
      document.getElementById('formPublier').reset();
      reinitialiserCartePublier();
    }
    entreeParEdition = false;
    if (mapPublier) setTimeout(() => mapPublier.resize(), 50);
  }
}
document.querySelectorAll('[data-go]').forEach(el => {
  el.addEventListener('click', () => goTo(el.dataset.go));
});

// Attache un écouteur uniquement si l'élément existe, pour éviter qu'une page
// pas encore à jour (ancien index.html en cache, fichier mal poussé, etc.)
// ne bloque le câblage de TOUT le reste du script.
function surEvenement(id, evenement, gestionnaire) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(evenement, gestionnaire);
  } else {
    console.warn(`[Suuf] Élément #${id} introuvable — vérifie que index.html est à jour (cache/déploiement).`);
  }
}

// icônes en haut à droite des écrans
surEvenement('btnNotifications', 'click', () => goTo('notifications'));
surEvenement('btnParametres', 'click', () => goTo('confidentialite'));

// ===== AUTH =====
document.querySelectorAll('.role-picker .role-opt[data-role]').forEach(el => {
  el.addEventListener('click', () => {
    const picker = el.closest('.role-picker');
    picker.querySelectorAll('.role-opt').forEach(o => o.classList.remove('on'));
    el.classList.add('on');
    if (picker.id === 'rolePickerTel') {
      roleInscriptionTel = el.dataset.role;
    } else {
      roleInscription = el.dataset.role;
    }
  });
});

// bascule Email / Téléphone sur l'écran d'authentification
document.querySelectorAll('.role-opt[data-methode]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.role-opt[data-methode]').forEach(o => o.classList.remove('on'));
    el.classList.add('on');
    methodeAuth = el.dataset.methode;
    document.getElementById('authEmailFields').style.display = methodeAuth === 'email' ? 'block' : 'none';
    document.getElementById('authPhoneFields').style.display = methodeAuth === 'telephone' ? 'block' : 'none';
    document.getElementById('authError').classList.remove('show');
  });
});

surEvenement('authSwitchLink', 'click', (e) => {
  e.preventDefault();
  modeAuth = modeAuth === 'connexion' ? 'inscription' : 'connexion';
  const estInscription = modeAuth === 'inscription';
  document.getElementById('registerFields').style.display = estInscription ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = estInscription ? 'Créer mon compte' : 'Se connecter';
  document.getElementById('authSwitchText').textContent = estInscription ? 'Déjà un compte ?' : 'Pas encore de compte ?';
  document.getElementById('authSwitchLink').textContent = estInscription ? 'Se connecter' : 'Créer un compte';
  document.getElementById('motDePasseOublieWrap').style.display = estInscription ? 'none' : 'block';
});

surEvenement('motDePasseOublieLink', 'click', (e) => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.color = '';
  errEl.classList.remove('show');

  if (!email) {
    errEl.textContent = 'Merci de renseigner ton email pour recevoir le lien de réinitialisation.';
    errEl.classList.add('show');
    return;
  }

  reinitialiserMotDePasse(email).then(() => {
    errEl.style.color = '#2c8a4b';
    errEl.textContent = 'Un email de réinitialisation a été envoyé à ' + email + '.';
    errEl.classList.add('show');
  }).catch(err => {
    errEl.style.color = '';
    errEl.textContent = traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

// ----- Connexion / inscription par téléphone -----
surEvenement('btnEnvoyerCode', 'click', () => {
  const numero = document.getElementById('authTelephone').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.color = '';
  errEl.classList.remove('show');

  if (!numero) {
    errEl.textContent = 'Merci de renseigner un numéro de téléphone (avec l\'indicatif, ex : +221...).';
    errEl.classList.add('show');
    return;
  }

  envoyerCodeTelephone(numero).then(() => {
    document.getElementById('phoneEtapeNumero').style.display = 'none';
    document.getElementById('phoneEtapeCode').style.display = 'block';
  }).catch(err => {
    errEl.textContent = traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

surEvenement('renvoyerCodeLink', 'click', (e) => {
  e.preventDefault();
  const numero = document.getElementById('authTelephone').value.trim();
  const errEl = document.getElementById('authError');
  if (!numero) return;
  envoyerCodeTelephone(numero).then(() => {
    errEl.style.color = '#2c8a4b';
    errEl.textContent = 'Un nouveau code a été envoyé par SMS.';
    errEl.classList.add('show');
  }).catch(err => {
    errEl.style.color = '';
    errEl.textContent = traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

surEvenement('btnValiderCode', 'click', () => {
  const code = document.getElementById('authCode').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.color = '';
  errEl.classList.remove('show');

  if (!code) {
    errEl.textContent = 'Merci de saisir le code reçu par SMS.';
    errEl.classList.add('show');
    return;
  }

  // La suite (redirection vers le profil à compléter ou vers l'app) est gérée
  // automatiquement par auth.onAuthStateChanged une fois la connexion confirmée.
  validerCodeTelephone(code).catch(err => {
    errEl.textContent = err.code ? traduireErreurFirebase(err.code) : (err.message || 'Code incorrect.');
    errEl.classList.add('show');
  });
});

surEvenement('btnTerminerInscriptionTel', 'click', () => {
  const nom = document.getElementById('regNomTel').value.trim();
  const errEl = document.getElementById('authError');
  errEl.style.color = '';
  errEl.classList.remove('show');

  if (!nom) {
    errEl.textContent = 'Merci de renseigner ton nom complet.';
    errEl.classList.add('show');
    return;
  }

  completerProfilTelephone(nom, roleInscriptionTel).then(() => {
    document.getElementById('regNomTel').value = '';
    document.getElementById('authTelephone').value = '';
    document.getElementById('authCode').value = '';
    document.getElementById('phoneEtapeProfil').style.display = 'none';
    document.getElementById('phoneEtapeNumero').style.display = 'block';
    document.getElementById('phoneEtapeCode').style.display = 'none';
    document.getElementById('bottomnav').style.display = 'flex';
    goTo('recherche');
  }).catch(err => {
    errEl.textContent = traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

surEvenement('authSubmit', 'click', () => {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const errEl = document.getElementById('authError');
  errEl.classList.remove('show');

  if (!email || !pass) {
    errEl.textContent = 'Merci de remplir email et mot de passe.';
    errEl.classList.add('show');
    return;
  }

  const action = modeAuth === 'inscription'
    ? inscrire(email, pass, document.getElementById('regNom').value.trim(), roleInscription)
    : connecter(email, pass);

  action.catch(err => {
    errEl.textContent = traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

function traduireErreurFirebase(code) {
  const map = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
  };
  return map[code] || 'Une erreur est survenue. Réessaie.';
}

surEvenement('btnLogout', 'click', () => deconnecter());

// bascule automatique auth <-> app selon l'état de connexion
auth.onAuthStateChanged((user) => {
  const bottomnav = document.getElementById('bottomnav');
  if (user) {
    // compte téléphone : on vérifie qu'un profil Firestore existe déjà,
    // sinon on affiche l'étape "complète ton profil" avant d'entrer dans l'app.
    if (user.phoneNumber && !user.email) {
      db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
          bottomnav.style.display = 'flex';
          goTo('recherche');
        } else {
          bottomnav.style.display = 'none';
          goTo('auth');
          document.querySelectorAll('.role-opt[data-methode]').forEach(o => o.classList.remove('on'));
          const ongletTel = document.querySelector('.role-opt[data-methode="telephone"]');
          if (ongletTel) ongletTel.classList.add('on');
          document.getElementById('authEmailFields').style.display = 'none';
          document.getElementById('authPhoneFields').style.display = 'block';
          document.getElementById('phoneEtapeNumero').style.display = 'none';
          document.getElementById('phoneEtapeCode').style.display = 'none';
          document.getElementById('phoneEtapeProfil').style.display = 'block';
        }
      });
    } else {
      bottomnav.style.display = 'flex';
      goTo('recherche');
    }
  } else {
    // Pas de compte connecté : l'utilisateur peut quand même explorer les
    // annonces librement. La connexion ne sera demandée qu'au moment où il
    // essaiera d'accéder à une fonctionnalité qui la nécessite réellement
    // (Publier, Messages, Profil, Notaires → solliciter, Contacter un vendeur).
    bottomnav.style.display = 'flex';
    document.getElementById('phoneEtapeNumero').style.display = 'block';
    document.getElementById('phoneEtapeCode').style.display = 'none';
    document.getElementById('phoneEtapeProfil').style.display = 'none';
    goTo('recherche');
  }
});

// ===== RECHERCHE =====
function chargerTerrains(filtres = {}) {
  const container = document.getElementById('listeTerrains');
  container.innerHTML = '<div class="loader">Chargement des terrains…</div>';

  rechercherTerrains(filtres).then(terrains => {
    if (terrains.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun terrain disponible pour le moment.</div>';
      return;
    }
    container.innerHTML = terrains.map(carteTerrainHTML).join('');
    container.querySelectorAll('.m-card').forEach(card => {
      card.addEventListener('click', () => ouvrirTerrain(card.dataset.id));
    });
  }).catch(err => {
    container.innerHTML = `<div class="empty-state">Erreur de chargement : ${err.message}</div>`;
  });
}

function carteTerrainHTML(t) {
  const fiable = t.scoreConfiance && t.scoreConfiance.titreVerifie;
  const tagHTML = fiable
    ? '<span class="tag tag-ok"><svg class="ic"><use href="#ic-check-seal"/></svg>Fiable</span>'
    : '<span class="tag tag-warn"><svg class="ic"><use href="#ic-hourglass"/></svg>À vérifier</span>';
  return `
    <div class="m-card" data-id="${t.id}">
      <div class="m-thumb"><svg class="ic" style="width:34px;height:34px;"><use href="#ic-pin"/></svg></div>
      <div class="m-info">
        <div class="m-zone">${escHTML(t.zone || '')} · ${escHTML(labelStatut(t.statutJuridique))}</div>
        <div class="m-title">${escHTML(t.titre || '')}</div>
        <div class="m-row">
          <span class="m-price">${formaterFCFA(t.prix)}</span>
          ${tagHTML}
        </div>
      </div>
    </div>`;
}

function labelStatut(s) {
  return { titre_foncier: 'Titre foncier', bail: 'Bail', non_loti: 'Zone non lotie' }[s] || s || '';
}
function formaterFCFA(n) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}
function escHTML(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.querySelectorAll('.chip[data-filtre]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip[data-filtre]').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    const f = chip.dataset.filtre;
    chargerTerrains(f === 'tous' ? {} : { statutJuridique: f });
  });
});

// ===== FICHE TERRAIN =====
function ouvrirTerrain(id) {
  terrainCourantId = id;
  const sheet = document.getElementById('terrainSheet');
  sheet.innerHTML = '<div class="loader">Chargement…</div>';
  document.getElementById('terrainMapContainer').style.display = 'none';
  goTo('terrain');

  getTerrain(id).then(t => {
    if (!t || !t.id) {
      sheet.innerHTML = '<div class="empty-state">Ce terrain est introuvable.</div>';
      return;
    }
    afficherCarteTerrain(t.localisation);
    const sc = t.scoreConfiance || {};
    sheet.innerHTML = `
      <div class="zone">${escHTML(t.zone || '')} · ${escHTML(labelStatut(t.statutJuridique))}</div>
      <h1>${escHTML(t.titre || '')}</h1>
      <div class="stat-grid">
        <div class="stat"><div class="v">${t.superficie || '—'} m²</div><div class="l">Superficie</div></div>
        <div class="stat"><div class="v">${t.distanceRoute || '—'}</div><div class="l">De la route</div></div>
        <div class="stat"><div class="v">${t.prix && t.superficie ? Math.round(t.prix / t.superficie) : '—'}</div><div class="l">FCFA / m²</div></div>
      </div>
      <div class="badges-row">
        <span class="tag ${sc.titreVerifie ? 'tag-ok' : 'tag-warn'}"><svg class="ic"><use href="#ic-doc"/></svg>${labelStatut(t.statutJuridique)}</span>
        <span class="tag ${sc.bornageGPS ? 'tag-ok' : 'tag-warn'}"><svg class="ic"><use href="#ic-target"/></svg>Bornage GPS</span>
        <span class="tag ${(sc.litiges === 0) ? 'tag-ok' : 'tag-warn'}"><svg class="ic"><use href="#ic-scale"/></svg>${sc.litiges === 0 ? '0 litige' : (sc.litiges || '?') + ' litige(s)'}</span>
      </div>
      <div class="desc">${escHTML(t.description || 'Aucune description fournie.')}</div>
      <div class="seller">
        <div class="avatar">${initiales(t.vendeurNom || 'Vendeur')}</div>
        <div>
          <div class="name">${escHTML(t.vendeurNom || 'Vendeur')}</div>
          <div class="sub">Vendeur · Prix : ${formaterFCFA(t.prix)}</div>
        </div>
      </div>`;
  }).catch(err => {
    sheet.innerHTML = `<div class="empty-state">Erreur de chargement : ${escHTML(err.message)}</div>`;
    console.error('Erreur ouvrirTerrain :', err);
  });
}

function initiales(nom) {
  return nom.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

surEvenement('btnContacterVendeur', 'click', () => {
  if (!auth.currentUser) { goTo('auth'); return; }
  if (!terrainCourantId) return;
  getTerrain(terrainCourantId).then(t => {
    demarrerConversation(terrainCourantId, t.vendeurId).then(convId => ouvrirChat(convId, t.vendeurNom || 'Vendeur'));
  });
});

surEvenement('btnSolliciterNotaire', 'click', () => {
  goTo('notaires');
});

// ===== PUBLIER =====
surEvenement('formPublier', 'submit', (e) => {
  e.preventDefault();
  const errEl = document.getElementById('publierError');
  errEl.classList.remove('show');

  const data = {
    titre: document.getElementById('pTitre').value.trim(),
    zone: document.getElementById('pZone').value.trim(),
    superficie: Number(document.getElementById('pSuperficie').value),
    statutJuridique: document.getElementById('pStatut').value,
    prix: Number(document.getElementById('pPrix').value),
    description: document.getElementById('pDescription').value.trim(),
    localisation: pinSelectionne // {lat, lng} choisi sur la carte, ou null si non renseigné
  };
  const fichier = document.getElementById('pFichier').files[0] || null;
  const idEnEdition = terrainEnEditionId;

  const action = idEnEdition
    ? modifierTerrain(idEnEdition, data, fichier)
    : publierTerrain(data, fichier, []);

  action.then(() => {
    document.getElementById('formPublier').reset();
    reinitialiserCartePublier();
    terrainEnEditionId = null;
    goTo(idEnEdition ? 'mes-annonces' : 'recherche');
  }).catch(err => {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  });
});

surEvenement('pFichier', 'change', (e) => {
  const f = e.target.files[0];
  document.getElementById('pFichierLabel').textContent = f ? f.name : 'Glisser un fichier ou parcourir';
});

// ===== MESSAGES =====
function chargerConversations() {
  const container = document.getElementById('listeConversations');
  mesConversations((convs) => {
    if (convs.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune conversation pour le moment.</div>';
      return;
    }
    container.innerHTML = convs.map(c => `
      <div class="conv" data-id="${c.id}">
        <div class="avatar">${initiales('Contact')}</div>
        <div>
          <div class="name">Conversation</div>
          <div class="last">${escHTML(c.dernierMessage || 'Nouvelle conversation')}</div>
        </div>
      </div>`).join('');
    container.querySelectorAll('.conv').forEach(el => {
      el.addEventListener('click', () => ouvrirChat(el.dataset.id, 'Conversation'));
    });
  });
}

function ouvrirChat(convId, titre) {
  conversationCouranteId = convId;
  document.getElementById('chatTitre').textContent = titre;
  goTo('chat');
  const thread = document.getElementById('chatThread');
  ecouterMessages(convId, (messages) => {
    thread.innerHTML = messages.map(m => `
      <div class="bubble ${m.expediteurId === auth.currentUser.uid ? 'mine' : 'theirs'}">${escHTML(m.texte)}</div>
    `).join('');
    thread.scrollTop = thread.scrollHeight;
  });
}

surEvenement('chatSend', 'click', envoyerMessageDepuisInput);
surEvenement('chatInput', 'keypress', (e) => {
  if (e.key === 'Enter') envoyerMessageDepuisInput();
});
function envoyerMessageDepuisInput() {
  const input = document.getElementById('chatInput');
  const texte = input.value.trim();
  if (!texte || !conversationCouranteId) return;
  envoyerMessage(conversationCouranteId, texte);
  input.value = '';
}

// ===== NOTAIRES =====
let notairesCourants = [];

function afficherNotaires(notaires, messageVide) {
  const container = document.getElementById('listeNotaires');
  if (notaires.length === 0) {
    container.innerHTML = `<div class="empty-state">${messageVide}</div>`;
    return;
  }
  container.innerHTML = notaires.map(n => `
    <div class="not-item" data-id="${n.id}">
      <div class="avatar">${initiales(n.nom || 'N')}</div>
      <div class="info">
        <div class="name">${escHTML(n.nom || '')}</div>
        <div class="ville">${escHTML(n.ville || '')}</div>
        <span class="tag tag-terre" style="margin-top:5px;"><svg class="ic"><use href="#ic-seal"/></svg>${escHTML(n.specialite || '')}</span>
      </div>
      <button class="go"><svg class="ic"><use href="#ic-arrow-right"/></svg></button>
    </div>`).join('');
  container.querySelectorAll('.not-item').forEach(el => {
    el.addEventListener('click', () => {
      if (!auth.currentUser) { goTo('auth'); return; }
      if (!terrainCourantId) { alert('Ouvre d\'abord un terrain pour solliciter un notaire.'); return; }
      solliciterNotaire(terrainCourantId, el.dataset.id).then(() => {
        alert('Demande envoyée au notaire.');
      });
    });
  });
}

function chargerNotaires() {
  const container = document.getElementById('listeNotaires');
  container.innerHTML = '<div class="loader">Chargement…</div>';
  listerNotaires().then(notaires => {
    notairesCourants = notaires;
    afficherNotaires(notaires, 'Aucun notaire référencé pour le moment.');
  });
}

surEvenement('btnRechercheNotaire', 'click', () => {
  const bar = document.getElementById('notaireSearchBar');
  const input = document.getElementById('notaireSearchInput');
  const estVisible = bar.style.display !== 'none';
  if (estVisible) {
    bar.style.display = 'none';
    input.value = '';
    afficherNotaires(notairesCourants, 'Aucun notaire référencé pour le moment.');
  } else {
    bar.style.display = 'flex';
    input.focus();
  }
});

surEvenement('notaireSearchInput', 'input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    afficherNotaires(notairesCourants, 'Aucun notaire référencé pour le moment.');
    return;
  }
  const filtres = notairesCourants.filter(n =>
    (n.nom || '').toLowerCase().includes(q) ||
    (n.ville || '').toLowerCase().includes(q) ||
    (n.specialite || '').toLowerCase().includes(q)
  );
  afficherNotaires(filtres, 'Aucun notaire ne correspond à ta recherche.');
});

// ===== PROFIL =====
function chargerProfil() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection('users').doc(user.uid).get().then(doc => {
    const data = doc.data() || {};
    profilCourant = data;
    document.getElementById('profilNom').textContent = data.nom || user.email;
    document.getElementById('profilEmail').textContent = user.email;
    document.getElementById('profilRole').textContent = { vendeur: 'Vendeur', acheteur: 'Acheteur', notaire: 'Notaire' }[data.role] || data.role || '—';
    document.getElementById('profilAvatar').textContent = initiales(data.nom || user.email);
  });
}

function labelStatutDemande(statut) {
  return {
    en_attente: { texte: 'En attente', classe: 'tag-warn' },
    accepte: { texte: 'Acceptée', classe: 'tag-ok' },
    traite: { texte: 'Traitée', classe: 'tag-ok' }
  }[statut] || { texte: statut || '—', classe: 'tag-neutral' };
}

// ===== MES ANNONCES =====
function chargerMesAnnonces() {
  const container = document.getElementById('listeMesAnnonces');
  const user = auth.currentUser;
  if (!user) return;
  container.innerHTML = '<div class="loader">Chargement…</div>';

  db.collection('terrains').where('vendeurId', '==', user.uid).get().then(snap => {
    const terrains = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (terrains.length === 0) {
      container.innerHTML = '<div class="empty-state">Vous n\'avez publié aucune annonce pour le moment.</div>';
      return;
    }
    terrains.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    container.innerHTML = terrains.map(t => `
      <div class="m-card" data-id="${t.id}">
        <div class="m-thumb"><svg class="ic" style="width:34px;height:34px;"><use href="#ic-pin"/></svg></div>
        <div class="m-info">
          <div class="m-zone">${escHTML(t.zone || '')} · ${escHTML(labelStatut(t.statutJuridique))}</div>
          <div class="m-title">${escHTML(t.titre || '')}</div>
          <div class="m-row">
            <span class="m-price">${formaterFCFA(t.prix)}</span>
            <span class="tag ${t.statut === 'disponible' ? 'tag-ok' : 'tag-neutral'}">${t.statut === 'disponible' ? 'En ligne' : (t.statut || '—')}</span>
          </div>
          <div class="m-actions">
            <button type="button" class="m-action-btn" data-action="editer" data-id="${t.id}"><svg class="ic"><use href="#ic-pencil"/></svg>Modifier</button>
            <button type="button" class="m-action-btn m-action-danger" data-action="supprimer" data-id="${t.id}"><svg class="ic"><use href="#ic-trash"/></svg>Supprimer</button>
          </div>
        </div>
      </div>`).join('');
    container.querySelectorAll('.m-card').forEach(card => {
      card.addEventListener('click', () => ouvrirTerrain(card.dataset.id));
    });
    container.querySelectorAll('[data-action="editer"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ouvrirEditionTerrain(btn.dataset.id);
      });
    });
    container.querySelectorAll('[data-action="supprimer"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Supprimer définitivement cette annonce ?')) return;
        supprimerTerrain(btn.dataset.id).then(() => chargerMesAnnonces());
      });
    });
  }).catch(err => {
    container.innerHTML = `<div class="empty-state">Erreur de chargement : ${escHTML(err.message)}</div>`;
  });
}

// ===== MODIFIER UNE ANNONCE =====
function ouvrirEditionTerrain(id) {
  getTerrain(id).then(t => {
    if (!t || !t.id) return;
    entreeParEdition = true;
    terrainEnEditionId = id;
    goTo('publier');

    document.getElementById('pTitre').value = t.titre || '';
    document.getElementById('pZone').value = t.zone || '';
    document.getElementById('pSuperficie').value = t.superficie || '';
    document.getElementById('pStatut').value = t.statutJuridique || 'titre_foncier';
    document.getElementById('pPrix').value = t.prix || '';
    document.getElementById('pDescription').value = t.description || '';
    document.getElementById('publierTitre').textContent = "Modifier l'annonce";
    document.getElementById('publierSubmitBtn').textContent = 'Enregistrer les modifications';

    if (t.localisation && typeof t.localisation.lat === 'number') {
      setTimeout(() => placerPinPublier(t.localisation.lat, t.localisation.lng), 200);
    }
  });
}

// ===== MES DEMANDES NOTAIRE =====
let unsubMesDemandes = null;
function chargerMesDemandes() {
  const container = document.getElementById('listeMesDemandes');
  container.innerHTML = '<div class="loader">Chargement…</div>';
  if (unsubMesDemandes) unsubMesDemandes();

  unsubMesDemandes = mesDemandesNotaire((demandes) => {
    if (demandes.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune demande envoyée à un notaire pour le moment.</div>';
      return;
    }
    demandes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    Promise.all(demandes.map(d =>
      Promise.all([
        db.collection('terrains').doc(d.terrainId).get().then(doc => doc.data() || {}),
        db.collection('notaires').doc(d.notaireId).get().then(doc => doc.data() || {})
      ]).then(([terrain, notaire]) => ({ ...d, terrainTitre: terrain.titre, notaireNom: notaire.nom }))
    )).then(items => {
      const st = labelStatutDemande;
      container.innerHTML = items.map(d => `
        <div class="not-item">
          <div class="avatar">${initiales(d.notaireNom || 'N')}</div>
          <div class="info">
            <div class="name">${escHTML(d.terrainTitre || 'Terrain')}</div>
            <div class="ville">Notaire : ${escHTML(d.notaireNom || '—')}</div>
            <span class="tag ${st(d.statut).classe}" style="margin-top:5px;">${st(d.statut).texte}</span>
          </div>
        </div>`).join('');
    });
  });
}

// ===== NOTIFICATIONS =====
function chargerNotifications() {
  const container = document.getElementById('listeNotifications');
  const user = auth.currentUser;
  if (!user) return;
  container.innerHTML = '<div class="loader">Chargement…</div>';

  Promise.all([
    db.collection('demandesNotaire').where('acheteurId', '==', user.uid).get(),
    db.collection('demandesNotaire').where('vendeurId', '==', user.uid).get()
  ]).then(([snapAcheteur, snapVendeur]) => {
    const parId = new Map();
    snapAcheteur.docs.forEach(d => parId.set(d.id, { id: d.id, role: 'acheteur', ...d.data() }));
    snapVendeur.docs.forEach(d => { if (!parId.has(d.id)) parId.set(d.id, { id: d.id, role: 'vendeur', ...d.data() }); });
    const items = Array.from(parId.values());

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune notification pour le moment.</div>';
      return;
    }
    items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    Promise.all(items.map(it =>
      db.collection('terrains').doc(it.terrainId).get().then(doc => ({ ...it, terrainTitre: (doc.data() || {}).titre }))
    )).then(itemsAvecTerrain => {
      const st = labelStatutDemande;
      container.innerHTML = itemsAvecTerrain.map(it => `
        <div class="not-item">
          <div class="avatar"><svg class="ic" style="width:18px;height:18px;color:#fff;"><use href="#ic-handshake"/></svg></div>
          <div class="info">
            <div class="name">${it.role === 'vendeur'
              ? `Un acheteur a sollicité un notaire pour « ${escHTML(it.terrainTitre || 'votre terrain')} »`
              : `Votre demande de notaire pour « ${escHTML(it.terrainTitre || 'ce terrain')} »`}</div>
            <span class="tag ${st(it.statut).classe}" style="margin-top:6px;">${st(it.statut).texte}</span>
          </div>
        </div>`).join('');
    });
  }).catch(err => {
    container.innerHTML = `<div class="empty-state">Erreur de chargement : ${escHTML(err.message)}</div>`;
  });
}

// ===== MODIFIER LE MOT DE PASSE =====
surEvenement('btnChangerMotDePasse', 'click', () => {
  const user = auth.currentUser;
  const errEl = document.getElementById('motDePasseError');
  errEl.style.color = '';
  errEl.classList.remove('show');

  if (!user.email) {
    errEl.textContent = "Cette fonctionnalité est réservée aux comptes créés avec un email. Les comptes créés par téléphone n'ont pas de mot de passe.";
    errEl.classList.add('show');
    return;
  }

  const ancien = document.getElementById('ancienMotDePasse').value;
  const nouveau = document.getElementById('nouveauMotDePasse').value;
  const confirmation = document.getElementById('confirmationMotDePasse').value;

  if (!ancien || !nouveau || !confirmation) {
    errEl.textContent = 'Merci de remplir tous les champs.';
    errEl.classList.add('show');
    return;
  }
  if (nouveau.length < 6) {
    errEl.textContent = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
    errEl.classList.add('show');
    return;
  }
  if (nouveau !== confirmation) {
    errEl.textContent = 'La confirmation ne correspond pas au nouveau mot de passe.';
    errEl.classList.add('show');
    return;
  }

  changerMotDePasse(ancien, nouveau).then(() => {
    errEl.style.color = '#2c8a4b';
    errEl.textContent = 'Mot de passe mis à jour avec succès.';
    errEl.classList.add('show');
    document.getElementById('ancienMotDePasse').value = '';
    document.getElementById('nouveauMotDePasse').value = '';
    document.getElementById('confirmationMotDePasse').value = '';
  }).catch(err => {
    errEl.textContent = err.code === 'auth/wrong-password'
      ? 'Mot de passe actuel incorrect.'
      : traduireErreurFirebase(err.code);
    errEl.classList.add('show');
  });
});

// ===== SUPPRESSION DE COMPTE =====
surEvenement('btnSupprimerCompte', 'click', () => {
  const user = auth.currentUser;
  const errEl = document.getElementById('suppressionError');
  const passInput = document.getElementById('suppressionPass');
  errEl.classList.remove('show');

  const supprimerDonneesEtCompte = () => {
    return db.collection('terrains').where('vendeurId', '==', user.uid).get()
      .then(snap => Promise.all(snap.docs.map(d => supprimerTerrain(d.id))))
      .then(() => db.collection('users').doc(user.uid).delete())
      .then(() => user.delete());
  };

  if (!confirm('Supprimer définitivement votre compte Suuf ? Cette action est irréversible.')) return;

  if (user.email) {
    const pass = passInput.value;
    if (!pass) {
      errEl.textContent = 'Merci de confirmer votre mot de passe.';
      errEl.classList.add('show');
      return;
    }
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, pass);

    user.reauthenticateWithCredential(credential)
      .then(supprimerDonneesEtCompte)
      .catch(err => {
        errEl.textContent = err.code === 'auth/wrong-password'
          ? 'Mot de passe incorrect.'
          : traduireErreurFirebase(err.code);
        errEl.classList.add('show');
      })
      .finally(() => { passInput.value = ''; });
  } else {
    // compte téléphone : pas de mot de passe à vérifier, la session récente suffit
    supprimerDonneesEtCompte().catch(err => {
      errEl.textContent = err.code === 'auth/requires-recent-login'
        ? 'Merci de te déconnecter puis de te reconnecter par téléphone avant de supprimer ton compte.'
        : traduireErreurFirebase(err.code);
      errEl.classList.add('show');
    });
  }
});

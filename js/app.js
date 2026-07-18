// ===== app.js : navigation + orchestration de l'UI =====

let profilCourant = null;
let terrainCourantId = null;
let conversationCouranteId = null;
let roleInscription = 'acheteur';
let modeAuth = 'connexion'; // 'connexion' | 'inscription'

function goTo(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === screenName));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.go === screenName));
  if (screenName === 'recherche') chargerTerrains();
  if (screenName === 'messages') chargerConversations();
  if (screenName === 'notaires') chargerNotaires();
  if (screenName === 'profil') chargerProfil();
}
document.querySelectorAll('[data-go]').forEach(el => {
  el.addEventListener('click', () => goTo(el.dataset.go));
});

// ===== AUTH =====
document.querySelectorAll('.role-opt').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.role-opt').forEach(o => o.classList.remove('on'));
    el.classList.add('on');
    roleInscription = el.dataset.role;
  });
});

document.getElementById('authSwitchLink').addEventListener('click', (e) => {
  e.preventDefault();
  modeAuth = modeAuth === 'connexion' ? 'inscription' : 'connexion';
  const estInscription = modeAuth === 'inscription';
  document.getElementById('registerFields').style.display = estInscription ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = estInscription ? 'Créer mon compte' : 'Se connecter';
  document.getElementById('authSwitchText').textContent = estInscription ? 'Déjà un compte ?' : 'Pas encore de compte ?';
  document.getElementById('authSwitchLink').textContent = estInscription ? 'Se connecter' : 'Créer un compte';
});

document.getElementById('authSubmit').addEventListener('click', () => {
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

document.getElementById('btnLogout').addEventListener('click', () => deconnecter());

// bascule automatique auth <-> app selon l'état de connexion
auth.onAuthStateChanged((user) => {
  const bottomnav = document.getElementById('bottomnav');
  if (user) {
    bottomnav.style.display = 'flex';
    goTo('recherche');
  } else {
    bottomnav.style.display = 'none';
    goTo('auth');
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
  goTo('terrain');

  getTerrain(id).then(t => {
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
        <div class="avatar">${initiales(t.vendeurNom || 'V')}</div>
        <div>
          <div class="name">${escHTML(t.vendeurNom || 'Vendeur')}</div>
          <div class="sub">Vendeur · Prix : ${formaterFCFA(t.prix)}</div>
        </div>
      </div>`;
  });
}

function initiales(nom) {
  return nom.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

document.getElementById('btnContacterVendeur').addEventListener('click', () => {
  if (!terrainCourantId) return;
  getTerrain(terrainCourantId).then(t => {
    demarrerConversation(terrainCourantId, t.vendeurId).then(convId => ouvrirChat(convId, t.vendeurNom || 'Vendeur'));
  });
});

document.getElementById('btnSolliciterNotaire').addEventListener('click', () => {
  goTo('notaires');
});

// ===== PUBLIER =====
document.getElementById('formPublier').addEventListener('submit', (e) => {
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
    localisation: null // à compléter avec l'intégration carte
  };
  const fichier = document.getElementById('pFichier').files[0] || null;

  publierTerrain(data, fichier, []).then(() => {
    document.getElementById('formPublier').reset();
    goTo('recherche');
  }).catch(err => {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  });
});

document.getElementById('pFichier').addEventListener('change', (e) => {
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

document.getElementById('chatSend').addEventListener('click', envoyerMessageDepuisInput);
document.getElementById('chatInput').addEventListener('keypress', (e) => {
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
function chargerNotaires() {
  const container = document.getElementById('listeNotaires');
  listerNotaires().then(notaires => {
    if (notaires.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun notaire référencé pour le moment.</div>';
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
        if (!terrainCourantId) { alert('Ouvre d\'abord un terrain pour solliciter un notaire.'); return; }
        solliciterNotaire(terrainCourantId, el.dataset.id).then(() => {
          alert('Demande envoyée au notaire.');
        });
      });
    });
  });
}

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

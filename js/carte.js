// ===== carte.js : intégration Leaflet + OpenStreetMap pour la localisation des terrains =====
// Gratuit, sans clé API, sans carte bancaire. Centré par défaut sur le Sénégal (Dakar).

const CENTRE_SENEGAL = { lat: 14.7167, lng: -17.4677 };

let mapPublier = null;
let markerPublier = null;
let pinSelectionne = null; // {lat, lng} choisi par le vendeur lors de la publication

let mapTerrain = null;

function tuilesOSM(map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
}

// ===== Carte interactive pour choisir la localisation (écran Publier) =====
function initCartePublier() {
  const container = document.getElementById('pMapContainer');
  if (!container || mapPublier) return; // déjà initialisée
  if (typeof L === 'undefined') {
    container.innerHTML = '<div style="padding:16px; font-size:12.5px; opacity:.6;">Carte indisponible (Leaflet non chargé).</div>';
    return;
  }

  mapPublier = L.map('pMapContainer').setView([CENTRE_SENEGAL.lat, CENTRE_SENEGAL.lng], 6);
  tuilesOSM(mapPublier);

  mapPublier.on('click', (e) => {
    placerPinPublier(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => mapPublier.invalidateSize(), 200);
}

function placerPinPublier(lat, lng) {
  pinSelectionne = { lat, lng };
  if (markerPublier) {
    markerPublier.setLatLng([lat, lng]);
  } else {
    markerPublier = L.marker([lat, lng]).addTo(mapPublier);
  }
  document.getElementById('pMapCoords').textContent =
    `Position choisie : ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function reinitialiserCartePublier() {
  pinSelectionne = null;
  if (markerPublier) {
    mapPublier.removeLayer(markerPublier);
    markerPublier = null;
  }
  const coordsEl = document.getElementById('pMapCoords');
  if (coordsEl) coordsEl.textContent = 'Aucune position sélectionnée';
  if (mapPublier) {
    mapPublier.setView([CENTRE_SENEGAL.lat, CENTRE_SENEGAL.lng], 6);
  }
}

// ===== Carte en lecture seule pour la fiche terrain =====
function afficherCarteTerrain(localisation) {
  const container = document.getElementById('terrainMapContainer');
  if (!container) return;

  if (!localisation || typeof localisation.lat !== 'number' || typeof localisation.lng !== 'number') {
    container.style.display = 'none';
    return;
  }

  if (typeof L === 'undefined') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  if (mapTerrain) {
    mapTerrain.remove();
    mapTerrain = null;
  }

  mapTerrain = L.map('terrainMapContainer', {
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    zoomControl: false,
    touchZoom: false
  }).setView([localisation.lat, localisation.lng], 14);
  tuilesOSM(mapTerrain);

  L.marker([localisation.lat, localisation.lng]).addTo(mapTerrain);

  setTimeout(() => mapTerrain.invalidateSize(), 200);
}

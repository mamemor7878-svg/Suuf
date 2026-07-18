# Suuf

Plateforme de mise en relation vendeurs/acheteurs de terrain au Sénégal,
avec accès direct à des notaires vérifiés. La transaction (signature, paiement)
se fait toujours hors application, entre les parties et le notaire.

## Structure

```
index.html              → point d'entrée PWA
manifest.json            → config PWA
service-worker.js        → cache offline
css/style.css             → styles (design system Suuf : ocre/baobab)
js/firebase-config.js    → connexion Firebase (à compléter avec tes clés)
js/auth.js                → inscription / connexion (vendeur, acheteur, notaire)
js/terrains.js             → publication et recherche de terrains
js/messages.js             → messagerie in-app
js/notaires.js              → annuaire notaires + demandes de mise en relation
firestore.rules            → règles de sécurité Firestore
```

## Setup

1. Remplir `js/firebase-config.js` avec la config de ton projet Firebase
2. Déployer les règles : `firebase deploy --only firestore:rules`
3. Ouvrir `index.html` (ou servir en local avec `npx serve .`)

## Collections Firestore

- `users` — profils (rôle : vendeur / acheteur / notaire)
- `terrains` — annonces
- `conversations` + sous-collection `messages`
- `notaires` — annuaire
- `demandesNotaire` — mises en relation acheteur/vendeur ↔ notaire

## Prochaines étapes

- [ ] Intégrer les écrans validés (recherche, fiche terrain, publier, messages, notaires, profil)
- [ ] Intégrer Google Maps / Mapbox pour la localisation et le bornage
- [ ] Modération manuelle des annonces avant publication
- [ ] Vérification manuelle des comptes notaires

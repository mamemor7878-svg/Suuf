// ===== Cloud Functions Suuf : notifications push =====
//
// Une seule fonction pour l'instant : dès qu'un nouveau message est écrit dans
// une conversation, on envoie une notification push (via Firebase Cloud
// Messaging -> APNs) à l'autre participant, s'il a déjà un appareil enregistré
// (champ `fcmToken` sur son document `users/{uid}`, rempli côté app iOS par
// js/push.js une fois la permission accordée). Si personne n'a de token
// (utilisateur sur le web, notifications refusées, etc.), on ne fait rien —
// la messagerie elle-même continue de fonctionner normalement dans tous les cas,
// cette fonction n'est qu'un plus.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.notifierNouveauMessage = functions.firestore
  .document('conversations/{convId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data() || {};
    const convId = context.params.convId;
    const expediteurId = message.expediteurId;
    const texte = (message.texte || '').toString();

    if (!expediteurId) return null;

    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return null;

    const conversation = convSnap.data() || {};
    const participants = conversation.participants || [];
    const destinataires = participants.filter((uid) => uid !== expediteurId);
    if (destinataires.length === 0) return null;

    const destinatairesDocs = await Promise.all(
      destinataires.map((uid) => db.collection('users').doc(uid).get())
    );

    // On garde le lien token -> doc pour pouvoir nettoyer les tokens invalides
    // après l'envoi (désinstallation de l'app, réinstallation, etc.).
    const entrees = destinatairesDocs
      .filter((doc) => doc.exists && doc.data().fcmToken)
      .map((doc) => ({ ref: doc.ref, token: doc.data().fcmToken }));

    if (entrees.length === 0) return null;

    const expediteurDoc = await db.collection('users').doc(expediteurId).get();
    const nomExpediteur = (expediteurDoc.exists && expediteurDoc.data().nom) || 'Nouveau message';

    const corpsNotification = texte.length > 120 ? texte.slice(0, 117) + '...' : (texte || 'Nouveau message');

    const messagePush = {
      tokens: entrees.map((e) => e.token),
      notification: {
        title: nomExpediteur,
        body: corpsNotification,
      },
      data: {
        conversationId: convId,
      },
      apns: {
        payload: {
          aps: { sound: 'default' },
        },
      },
    };

    const reponse = await admin.messaging().sendEachForMulticast(messagePush);

    // Nettoyage : un token devenu invalide (désinstallation, etc.) est retiré du
    // profil de l'utilisateur pour ne pas continuer à essayer de le notifier à
    // chaque nouveau message.
    const nettoyages = [];
    reponse.responses.forEach((r, index) => {
      if (!r.success && r.error && (
        r.error.code === 'messaging/invalid-registration-token' ||
        r.error.code === 'messaging/registration-token-not-registered'
      )) {
        nettoyages.push(entrees[index].ref.update({ fcmToken: admin.firestore.FieldValue.delete() }));
      }
    });
    if (nettoyages.length > 0) await Promise.all(nettoyages);

    return null;
  });

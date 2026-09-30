// backend/routes/proProjects.js
// Projets PRO — branchés sur les systèmes validés (septembre 2026) :
//  - bien vide   : pipeline V1 (photo vérifiée AVANT l'envoi, choix cuisine /
//                  salle de bain, famille de style par projet) ;
//  - bien habité : pipeline habités PRO validé.
// La génération n'est plus faite ici : chaque photo « Avant » est déposée
// dans Notion (Photos PRO) avec « Statut génération : À générer », puis le
// générateur (generateurJob.js) la traite, et l'image « Après » attend votre
// validation, exactement comme pour les particuliers.
//
// Quota mensuel : photos incluses dans l'offre + « Photos supplémentaires »
// (colonne nombre de la fiche abonnement, facultative), compté par mois
// calendaire sur la colonne « Photos reçues » des projets du mois.
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const roomPromptsHabitesPro = require('./roomPromptsHabitesPro');
const router = express.Router();

const NOTION_HEADERS = {
  Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

const OFFER_PHOTOS_LIMIT = {
  pro_starter: 10,
  pro_business: 30,
  pro_agency: 80,
};

// Types de pièces acceptés
const ROOM_TYPES_VIDE = [
  'salon', 'salon_salle_a_manger', 'cuisine', 'salle_bain', 'chambre_parentale',
  'chambre_enfant', 'chambre_ado', 'balcon_terrasse', 'entree',
];
const ROOM_TYPES_HABITE = Object.keys(roomPromptsHabitesPro);

const FAMILLES_STYLE = ['A', 'B', 'C', 'D', 'E'];
const ETATS_CUISINE_AVEC_CHOIX = ['CUISINE_EXISTANTE_PRESENTABLE', 'CUISINE_EXISTANTE_DATEE'];
const ETATS_SDB_AVEC_CHOIX = ['SDB_PRESENTABLE', 'SDB_DATEE'];
const CHOIX_VALIDES = ['valorisation_douce', 'projection_modernisee'];

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'evidence-secret-temp');
  } catch {
    return null;
  }
}

// Même jeton que celui délivré par /api/payments/verifier-photo
// (preuve que la photo a été vérifiée sur notre serveur).
function jetonValide(url, roomType, verification, jeton) {
  if (typeof jeton !== 'string' || jeton.length !== 64) return false;
  const attendu = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify([url, roomType, verification]))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(jeton));
}

async function trouverAbonnement(email) {
  const res = await axios.post(
    `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_DATABASE_ID}/query`,
    { filter: { property: 'Email', email: { equals: email } } },
    { headers: NOTION_HEADERS }
  );
  return res.data.results[0] || null;
}

// Abonnement Stripe actif (ou en période d'essai) pour cet email
async function abonnementActif(email) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const clients = await stripe.customers.list({ email, limit: 10 });
  for (const c of clients.data) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 10 });
    if (subs.data.some((s) => ['active', 'trialing'].includes(s.status))) return true;
  }
  return false;
}

// Photos déjà envoyées ce mois-ci (mois calendaire) par cet abonnement
async function photosDuMois(subPageId) {
  const now = new Date();
  const debutMois = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  let total = 0;
  let cursor;
  do {
    const res = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_PROJECTS_DATABASE_ID}/query`,
      {
        filter: {
          and: [
            { property: 'Nom entreprise', relation: { contains: subPageId } },
            { timestamp: 'created_time', created_time: { on_or_after: debutMois } },
          ],
        },
        start_cursor: cursor,
      },
      { headers: NOTION_HEADERS }
    );
    for (const p of res.data.results) total += p.properties['Photos reçues']?.number || 0;
    cursor = res.data.has_more ? res.data.next_cursor : undefined;
  } while (cursor);
  return total;
}

function quotaDe(subPage) {
  const offre = subPage.properties['Offre']?.select?.name || 'pro_starter';
  const inclus = OFFER_PHOTOS_LIMIT[offre] || 0;
  const supplementaires = subPage.properties['Photos supplémentaires']?.number || 0;
  return { offre, inclus, supplementaires, total: inclus + supplementaires };
}

// ─── GET /api/pro/projects/quota ────────────────────────────────────────────
router.get('/quota', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const subPage = await trouverAbonnement(decoded.email);
    if (!subPage) return res.status(404).json({ error: 'Abonnement non trouvé.' });
    const q = quotaDe(subPage);
    const utilisees = await photosDuMois(subPage.id);
    res.json({ ...q, utilisees, restantes: Math.max(0, q.total - utilisees) });
  } catch (err) {
    console.error('[ProProjects] Erreur quota:', err.response?.data || err.message);
    res.status(500).json({ error: 'Impossible de lire votre quota.' });
  }
});

// Vérifie les photos d'un projet. Retourne null si tout est bon, sinon un message.
function erreurPhotos(photos, typeBien) {
  const prefixeCloudinary = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
  const types = typeBien === 'habite' ? ROOM_TYPES_HABITE : ROOM_TYPES_VIDE;

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i] || {};
    const n = i + 1;
    if (typeof p.url !== 'string' || !p.url.startsWith(prefixeCloudinary)) return `Photo ${n} : photo invalide.`;
    if (!types.includes(p.roomType)) return `Photo ${n} : type de pièce inconnu.`;
    if (typeBien === 'habite') continue;

    if (!p.verification || !jetonValide(p.url, p.roomType, p.verification, p.jeton)) {
      return `Photo ${n} : elle n'a pas été vérifiée. Merci de la renvoyer.`;
    }
    const choixCuisine = p.roomType === 'cuisine' && ETATS_CUISINE_AVEC_CHOIX.includes(p.verification.cuisine);
    const choixSdb = p.roomType === 'salle_bain' && ETATS_SDB_AVEC_CHOIX.includes(p.verification.sdb);
    if ((choixCuisine || choixSdb) && !CHOIX_VALIDES.includes(p.choixCuisine)) {
      return `Photo ${n} : merci de choisir le niveau de traitement.`;
    }
  }
  return null;
}

// ─── POST /api/pro/projects/create ──────────────────────────────────────────
// Corps : { projectName, typeBien: 'vide' | 'habite',
//           photos: [{ url, roomType, verification?, jeton?, choixCuisine? }] }
router.post('/create', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });

  const { projectName, typeBien, photos } = req.body || {};
  if (!projectName || !String(projectName).trim()) {
    return res.status(400).json({ error: 'Nom du projet requis.' });
  }
  if (!['vide', 'habite'].includes(typeBien)) {
    return res.status(400).json({ error: 'Choisissez bien vide ou bien habité.' });
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'Ajoutez au moins une photo.' });
  }

  const erreur = erreurPhotos(photos, typeBien);
  if (erreur) return res.status(400).json({ error: erreur });

  try {
    const subPage = await trouverAbonnement(decoded.email);
    if (!subPage) return res.status(404).json({ error: 'Abonnement non trouvé.' });

    if (!(await abonnementActif(decoded.email))) {
      return res.status(403).json({ error: "Votre abonnement n'est pas actif. Vérifiez votre facturation." });
    }

    const q = quotaDe(subPage);
    const utilisees = await photosDuMois(subPage.id);
    const restantes = Math.max(0, q.total - utilisees);
    if (photos.length > restantes) {
      return res.status(403).json({
        error: `Quota atteint : il vous reste ${restantes} photo(s) ce mois-ci. Retirez des photos, ou changez d'offre.`,
        restantes,
      });
    }

    // 1. Le projet
    const famille = FAMILLES_STYLE[crypto.randomInt(FAMILLES_STYLE.length)];
    const nom = String(projectName).trim();
    const projetRes = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: process.env.NOTION_PRO_PROJECTS_DATABASE_ID },
        properties: {
          'Nom du projet': { title: [{ text: { content: nom } }] },
          'Nom entreprise': { relation: [{ id: subPage.id }] },
          'Statut': { select: { name: 'Nouveau' } },
          'Photos reçues': { number: photos.length },
          'Photos livrées': { number: 0 },
          'Type de bien': { select: { name: typeBien === 'habite' ? 'Bien habité' : 'Bien vide' } },
          ...(typeBien === 'vide' ? { 'Famille style': { select: { name: famille } } } : {}),
        },
      },
      { headers: NOTION_HEADERS }
    );
    const projetId = projetRes.data.id;

    // 2. Une ligne « Avant » par photo, directement dans la file du générateur
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const avecChoix = ['cuisine', 'salle_bain'].includes(p.roomType) && CHOIX_VALIDES.includes(p.choixCuisine);
      await axios.post(
        'https://api.notion.com/v1/pages',
        {
          parent: { database_id: process.env.NOTION_PHOTOS_PRO_DATABASE_ID },
          properties: {
            'Titre': { title: [{ text: { content: `${nom} — ${p.roomType} — Avant` } }] },
            'Projet': { relation: [{ id: projetId }] },
            'Type': { select: { name: 'Avant' } },
            'URL photo': { url: p.url },
            'Pièce': { select: { name: p.roomType } },
            'Statut': { select: { name: 'En attente' } },
            'Statut génération': { select: { name: 'À générer' } },
            ...(typeBien === 'vide'
              ? { 'Contrôle photo': { rich_text: [{ text: { content: JSON.stringify(p.verification).slice(0, 1900) } }] } }
              : {}),
            ...(avecChoix ? { 'Choix cuisine': { select: { name: p.choixCuisine } } } : {}),
          },
        },
        { headers: NOTION_HEADERS }
      );
    }

    console.log(`[ProProjects] Projet créé — ${nom} — ${typeBien} — ${photos.length} photo(s)`);
    res.json({ success: true, restantes: restantes - photos.length });
  } catch (err) {
    console.error('[ProProjects] Erreur création:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la création du projet.' });
  }
});

module.exports = router;
module.exports.ROOM_TYPES_HABITE = ROOM_TYPES_HABITE;

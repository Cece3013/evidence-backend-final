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
// Quota :
//  - photos INCLUSES dans l'offre : remises à zéro chaque mois calendaire ;
//  - photos SUPPLÉMENTAIRES achetées : un solde (colonne « Photos
//    supplémentaires » de la fiche abonnement), valable sans limite de durée.
// Un projet consomme d'abord les photos incluses du mois, puis le solde.
// La part prise sur le solde est notée dans « Photos sur supplément » du projet.
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

const SITE_URL = 'https://evidence-platform-pied.vercel.app';

// Prix d'une photo supplémentaire selon l'offre, en centimes
const PRIX_PHOTO_SUP = {
  pro_starter: 1200,
  pro_business: 900,
  pro_agency: 700,
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

// Photos INCLUSES déjà utilisées ce mois-ci (mois calendaire) par cet abonnement
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
    for (const p of res.data.results) {
      const recues = p.properties['Photos reçues']?.number || 0;
      const surSupplement = p.properties['Photos sur supplément']?.number || 0;
      total += Math.max(0, recues - surSupplement);
    }
    cursor = res.data.has_more ? res.data.next_cursor : undefined;
  } while (cursor);
  return total;
}

async function quotaDe(subPage) {
  const offre = subPage.properties['Offre']?.select?.name || 'pro_starter';
  const inclus = OFFER_PHOTOS_LIMIT[offre] || 0;
  const supplementaires = Math.max(0, subPage.properties['Photos supplémentaires']?.number || 0);
  const utilisees = await photosDuMois(subPage.id);
  const inclusRestantes = Math.max(0, inclus - utilisees);
  return {
    offre,
    inclus,
    utilisees,
    inclusRestantes,
    supplementaires,
    restantes: inclusRestantes + supplementaires,
    total: inclus + supplementaires,
    prixPhotoSup: (PRIX_PHOTO_SUP[offre] || PRIX_PHOTO_SUP.pro_starter) / 100,
  };
}

// ─── GET /api/pro/projects/quota ────────────────────────────────────────────
router.get('/quota', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const subPage = await trouverAbonnement(decoded.email);
    if (!subPage) return res.status(404).json({ error: 'Abonnement non trouvé.' });
    res.json(await quotaDe(subPage));
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

    const q = await quotaDe(subPage);
    const restantes = q.restantes;
    if (photos.length > restantes) {
      return res.status(403).json({
        error: `Quota atteint : il vous reste ${restantes} photo(s). Retirez des photos, achetez des photos supplémentaires ou changez d'offre.`,
        restantes,
      });
    }
    // D'abord les photos incluses du mois, puis le solde de photos supplémentaires
    const surSupplement = Math.max(0, photos.length - q.inclusRestantes);

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
          'Photos sur supplément': { number: surSupplement },
          'Type de bien': { select: { name: typeBien === 'habite' ? 'Bien habité' : 'Bien vide' } },
          ...(typeBien === 'vide' ? { 'Famille style': { select: { name: famille } } } : {}),
        },
      },
      { headers: NOTION_HEADERS }
    );
    const projetId = projetRes.data.id;

    // Le solde de photos supplémentaires est débité de la part utilisée
    if (surSupplement > 0) {
      await axios.patch(
        `https://api.notion.com/v1/pages/${subPage.id}`,
        { properties: { 'Photos supplémentaires': { number: q.supplementaires - surSupplement } } },
        { headers: NOTION_HEADERS }
      );
    }

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

// ─── POST /api/pro/projects/acheter-photos ──────────────────────────────────
// Corps : { quantite } — crée un paiement Stripe ponctuel. Le solde est
// crédité par le webhook Stripe à la confirmation du paiement.
router.post('/acheter-photos', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });

  const quantite = parseInt(req.body?.quantite, 10);
  if (!Number.isInteger(quantite) || quantite < 1 || quantite > 100) {
    return res.status(400).json({ error: 'Choisissez entre 1 et 100 photos.' });
  }

  try {
    const subPage = await trouverAbonnement(decoded.email);
    if (!subPage) return res.status(404).json({ error: 'Abonnement non trouvé.' });
    if (!(await abonnementActif(decoded.email))) {
      return res.status(403).json({ error: "Votre abonnement n'est pas actif. Vérifiez votre facturation." });
    }

    const offre = subPage.properties['Offre']?.select?.name || 'pro_starter';
    const prix = PRIX_PHOTO_SUP[offre] || PRIX_PHOTO_SUP.pro_starter;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: decoded.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: prix,
          product_data: { name: 'Photos supplémentaires — Evidence PRO' },
        },
        quantity: quantite,
      }],
      success_url: `${SITE_URL}/dashboard?achat=ok`,
      cancel_url: `${SITE_URL}/dashboard`,
      metadata: {
        type: 'pro_photos_sup',
        subPageId: subPage.id,
        quantite: String(quantite),
        email: decoded.email,
      },
    });

    console.log(`[ProProjects] Achat photos sup. — ${decoded.email} — ${quantite} photo(s)`);
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('[ProProjects] Erreur achat photos:', err.response?.data || err.message);
    res.status(500).json({ error: "Impossible de lancer l'achat." });
  }
});

// Crédit du solde après paiement — appelé par le webhook Stripe.
// Protégé contre un double traitement d'un même paiement.
const sessionsCreditees = new Set();
async function crediterPhotosSupplementaires(session) {
  const m = session.metadata || {};
  if (m.type !== 'pro_photos_sup' || session.payment_status !== 'paid') return false;
  if (sessionsCreditees.has(session.id)) return false;
  sessionsCreditees.add(session.id);

  const quantite = parseInt(m.quantite, 10) || 0;
  const pageRes = await axios.get(`https://api.notion.com/v1/pages/${m.subPageId}`, { headers: NOTION_HEADERS });
  const solde = pageRes.data.properties['Photos supplémentaires']?.number || 0;
  await axios.patch(
    `https://api.notion.com/v1/pages/${m.subPageId}`,
    { properties: { 'Photos supplémentaires': { number: solde + quantite } } },
    { headers: NOTION_HEADERS }
  );
  console.log(`[ProProjects] ${quantite} photo(s) supplémentaire(s) créditée(s) — ${m.email} — solde ${solde + quantite}`);
  return true;
}

// ─── GET /api/pro/projects/:id ──────────────────────────────────────────────
// Détail d'un projet pour son propriétaire : infos + paires avant / après.
// Seules les images « Après » VALIDÉES par l'équipe sont visibles.
router.get('/:id', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });

  try {
    const subPage = await trouverAbonnement(decoded.email);
    if (!subPage) return res.status(404).json({ error: 'Abonnement non trouvé.' });

    const projetRes = await axios.get(`https://api.notion.com/v1/pages/${req.params.id}`, { headers: NOTION_HEADERS });
    const projet = projetRes.data;
    const proprietaire = (projet.properties['Nom entreprise']?.relation || []).some((r) => r.id === subPage.id);
    if (!proprietaire) return res.status(404).json({ error: 'Projet introuvable.' });

    // Toutes les photos du projet, dans l'ordre de création
    const photos = [];
    let cursor;
    do {
      const r = await axios.post(
        `https://api.notion.com/v1/databases/${process.env.NOTION_PHOTOS_PRO_DATABASE_ID}/query`,
        {
          filter: { property: 'Projet', relation: { contains: projet.id } },
          sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
          start_cursor: cursor,
        },
        { headers: NOTION_HEADERS }
      );
      photos.push(...r.data.results);
      cursor = r.data.has_more ? r.data.next_cursor : undefined;
    } while (cursor);

    const lire = (ph) => ({
      piece: (ph.properties['Pièce']?.select?.name || '').toLowerCase(),
      url: ph.properties['URL photo']?.url || null,
      statut: ph.properties['Statut']?.select?.name || '',
    });
    const avants = photos.filter((ph) => ph.properties['Type']?.select?.name === 'Avant').map(lire);
    const apresValides = photos
      .filter((ph) => ph.properties['Type']?.select?.name === 'Après')
      .map(lire)
      .filter((a) => ['Validé', 'Envoyé'].includes(a.statut));

    // Chaque « Après » validée est associée à une « Avant » de la même pièce
    const utilisees = new Set();
    const paires = apresValides.map((apres) => {
      const i = avants.findIndex((av, idx) => !utilisees.has(idx) && av.piece === apres.piece);
      if (i >= 0) utilisees.add(i);
      return { piece: apres.piece, avant: i >= 0 ? avants[i].url : null, apres: apres.url };
    });

    const pp = projet.properties;
    res.json({
      id: projet.id,
      name: pp['Nom du projet']?.title?.[0]?.plain_text || '—',
      projectId: pp['ID projet']?.unique_id ? `${pp['ID projet'].unique_id.prefix}-${pp['ID projet'].unique_id.number}` : '—',
      status: pp['Statut']?.select?.name || '—',
      typeBien: pp['Type de bien']?.select?.name || null,
      createdDate: pp['Date de création']?.date?.start || projet.created_time,
      photosReceived: avants.length,
      photosDelivered: paires.length,
      paires,
    });
  } catch (err) {
    console.error('[ProProjects] Erreur détail:', err.response?.data || err.message);
    res.status(500).json({ error: 'Impossible de charger le projet.' });
  }
});

module.exports = router;
module.exports.ROOM_TYPES_HABITE = ROOM_TYPES_HABITE;
module.exports.crediterPhotosSupplementaires = crediterPhotosSupplementaires;

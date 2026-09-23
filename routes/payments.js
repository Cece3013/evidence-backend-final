// backend/routes/payments.js
const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { controlePhoto, classifierCuisine } = require('./pipelineVidesV1');
const { confirmerPaiementCommande } = require('./confirmationCommande');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Montants en centimes
const FORMULA_PRICES = {
  // Biens vides — projection immobilière
  decouverte:       { amount: 3900,  label: 'Découverte — 2 photos aménagées',   maxPhotos: 2, type: 'vide' },
  essentielle:      { amount: 8900,  label: 'Essentielle — 5 photos aménagées',  maxPhotos: 5, type: 'vide' },
  performance:      { amount: 13900, label: 'Performance — 8 photos aménagées',  maxPhotos: 8, type: 'vide' },
  // Biens habités — analyse et home staging
  essentiel_habite: { amount: 7900,  label: 'Essentiel — 2 pièces',              maxRooms: 2,  type: 'habite' },
  premium_habite:   { amount: 15900, label: 'Premium — 5 pièces',                maxRooms: 5,  type: 'habite' },
};

const OPTION_PRICES = {
  photo_supplementaire:  { amount: 1200, label: 'Photo supplémentaire',   multiple: true  },
  optimisation_annonce:  { amount: 4900, label: 'Optimisation Annonce',   multiple: false },
  pack_vente_acceleree:  { amount: 6900, label: 'Pack Vente Accélérée',   multiple: false },
};

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Types de pièces acceptés pour les biens vides = modules du pipeline V1
const ROOM_TYPES_V1 = [
  'salon', 'salon_salle_a_manger', 'cuisine', 'salle_bain', 'chambre_parentale',
  'chambre_enfant', 'chambre_ado', 'balcon_terrasse', 'entree',
];

// Familles STYLE_VARIANT : une par commande, en rotation d'un client à l'autre
const FAMILLES_STYLE = ['A', 'B', 'C', 'D', 'E'];

// États de cuisine pour lesquels le client doit choisir le niveau de transformation
const ETATS_CUISINE_AVEC_CHOIX = ['CUISINE_EXISTANTE_PRESENTABLE', 'CUISINE_EXISTANTE_DATEE'];
const CHOIX_CUISINE_VALIDES = ['valorisation_douce', 'projection_modernisee'];

// Jeton de vérification : prouve que la photo a bien passé le contrôle
// sur NOTRE serveur (impossible à fabriquer depuis le navigateur).
function signerVerification(url, roomType, verification) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(JSON.stringify([url, roomType, verification]))
    .digest('hex');
}

function jetonValide(url, roomType, verification, jeton) {
  if (typeof jeton !== 'string' || jeton.length !== 64) return false;
  const attendu = signerVerification(url, roomType, verification);
  return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(jeton));
}

// Limite anti-abus : chaque vérification coûte un appel d'analyse
const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  keyGenerator: (req) => req.ip,
  message: { error: 'Trop de vérifications de photos. Réessayez dans une heure.' },
});

// Adresse du site (utilisée dans les liens envoyés aux clients)
const SITE_URL = 'https://evidence-platform-pied.vercel.app';

// Construit le lien de suivi sécurisé : référence + code secret aléatoire
function buildSuiviUrl(reference, suiviCode) {
  if (!reference || !suiviCode) return null;
  return `${SITE_URL}/commande/suivi/${reference}?code=${suiviCode}`;
}

function computeTotal(formula, options = []) {
  let total = formula.amount;
  const details = [];

  for (const opt of options) {
    const option = OPTION_PRICES[opt.id];
    if (!option) continue;
    const qty = option.multiple ? Math.max(1, parseInt(opt.quantity) || 1) : 1;
    total += option.amount * qty;
    details.push(`${option.label}${qty > 1 ? ` x${qty}` : ''}`);
  }

  return { total, details };
}

function buildLineItems(formula, options = []) {
  const lineItems = [{
    price_data: {
      currency: 'eur',
      product_data: { name: `EVIDENCE Home Staging — ${formula.label}` },
      unit_amount: formula.amount,
    },
    quantity: 1,
  }];

  for (const opt of options) {
    const option = OPTION_PRICES[opt.id];
    if (!option) continue;
    const qty = option.multiple ? Math.max(1, parseInt(opt.quantity) || 1) : 1;
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: option.label },
        unit_amount: option.amount,
      },
      quantity: qty,
    });
  }

  return lineItems;
}

// ─── GET /api/payments/formulas ──────────────────────────────────────────────────
router.get('/formulas', (req, res) => {
  res.json({
    formulas: Object.entries(FORMULA_PRICES).map(([id, f]) => ({
      id,
      label: f.label,
      price: f.amount / 100,
      maxPhotos: f.maxPhotos || null,
      maxRooms: f.maxRooms || null,
      type: f.type,
    })),
    options: Object.entries(OPTION_PRICES).map(([id, o]) => ({
      id,
      label: o.label,
      price: o.amount / 100,
      multiple: o.multiple,
    })),
  });
});

// ─── POST /api/payments/upload-photo ─────────────────────────────────────────────
router.post('/upload-photo', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = crypto
      .createHash('sha1')
      .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
      .digest('hex');

    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname });
    form.append('timestamp', timestamp);
    form.append('api_key', process.env.CLOUDINARY_API_KEY);
    form.append('signature', signature);

    const cloudRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      form,
      { headers: form.getHeaders(), maxBodyLength: Infinity }
    );

    res.json({ url: cloudRes.data.secure_url });
  } catch (err) {
    console.error('[Payments] Erreur upload photo:', err.response?.data || err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi de la photo." });
  }
});

// ─── POST /api/payments/verifier-photo ───────────────────────────────────────────
// Bien vide, AVANT paiement : Contrôle Photo V1 (+ classification si cuisine).
// Réponses possibles :
//  { statut: 'ACCEPTEE', verification, jeton }
//  { statut: 'CHOIX_CUISINE', verification, jeton, recommandation, options }
//  { statut: 'REFUSEE', raison, conseil }  → refus bloquant, le client change de photo
router.post('/verifier-photo', verificationLimiter, async (req, res) => {
  const { url, roomType } = req.body || {};

  const prefixeCloudinary = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
  if (typeof url !== 'string' || !url.startsWith(prefixeCloudinary)) {
    return res.status(400).json({ error: 'Photo invalide.' });
  }
  if (!ROOM_TYPES_V1.includes(roomType)) {
    return res.status(400).json({ error: 'Type de pièce inconnu.' });
  }

  try {
    const controle = await controlePhoto(url);

    if (!controle.allow_generation) {
      return res.json({
        statut: 'REFUSEE',
        raison: controle.reason || "Cette photo ne permet pas un aménagement fiable.",
        conseil: controle.retake_instruction || null,
      });
    }

    // Ce qu'on garde du contrôle (réutilisé après paiement, sans refaire le contrôle)
    const verification = {
      status: controle.status || null,
      allow_generation: true,
      reason: controle.reason || null,
      cuisine: null,
    };

    if (roomType === 'cuisine') {
      const classification = await classifierCuisine(url);
      verification.cuisine = classification.status || null;

      if (ETATS_CUISINE_AVEC_CHOIX.includes(classification.status)) {
        return res.json({
          statut: 'CHOIX_CUISINE',
          verification,
          jeton: signerVerification(url, roomType, verification),
          recommandation: classification.status === 'CUISINE_EXISTANTE_PRESENTABLE'
            ? 'valorisation_douce'
            : 'projection_modernisee',
          options: [
            { id: 'valorisation_douce', label: 'Valorisation douce', description: "Moderniser légèrement l'existant : désencombrement, harmonisation et rafraîchissement, tout en conservant fortement l'aspect actuel de la cuisine." },
            { id: 'projection_modernisee', label: 'Projection modernisée', description: "Montrer le potentiel d'une cuisine plus actuelle : modernisation cohérente des façades, du plan de travail, de la crédence et des murs, en conservant l'implantation et les contraintes réelles." },
          ],
        });
      }
    }

    res.json({ statut: 'ACCEPTEE', verification, jeton: signerVerification(url, roomType, verification) });
  } catch (err) {
    console.error('[Payments] Erreur verifier-photo:', err.response?.data || err.message);
    res.status(500).json({ error: 'La vérification de la photo a échoué. Réessayez.' });
  }
});

// Vérifie les photos d'une commande de bien vide avant de créer le paiement.
// Retourne null si tout est bon, sinon un message d'erreur pour le client.
function erreurPhotosBienVide(photos, formula, options) {
  const supplementaires = options
    .filter((o) => o.id === 'photo_supplementaire')
    .reduce((n, o) => n + Math.max(1, parseInt(o.quantity) || 1), 0);
  const maxAutorise = (formula.maxPhotos || 0) + supplementaires;

  if (photos.length > maxAutorise) {
    return `Votre formule permet ${maxAutorise} photo(s). Retirez des photos ou ajoutez l'option « Photo supplémentaire ».`;
  }

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i] || {};
    const n = i + 1;
    if (!ROOM_TYPES_V1.includes(p.roomType)) return `Photo ${n} : type de pièce inconnu.`;
    if (!p.verification || !jetonValide(p.url, p.roomType, p.verification, p.jeton)) {
      return `Photo ${n} : elle n'a pas été vérifiée. Merci de la renvoyer.`;
    }
    const choixRequis = p.roomType === 'cuisine' && ETATS_CUISINE_AVEC_CHOIX.includes(p.verification.cuisine);
    if (choixRequis && !CHOIX_CUISINE_VALIDES.includes(p.choixCuisine)) {
      return `Photo ${n} : merci de choisir le niveau de transformation de la cuisine.`;
    }
  }
  return null;
}

// ─── POST /api/payments/create-checkout ──────────────────────────────────────────
// Crée la commande dans Notion, puis redirige vers Stripe Checkout (parcours web)
router.post('/create-checkout', async (req, res) => {
  try {
    const { formulaId, options = [], clientEmail, metadata = {}, photos = [] } = req.body;
    const formula = FORMULA_PRICES[formulaId];
    if (!formula) {
      return res.status(400).json({ error: 'Formule inconnue.' });
    }

    const orderId = `ORD-${uuidv4().split('-')[0].toUpperCase()}`;
    const isHabite = metadata.propertyType === 'habite';

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'Ajoutez au moins une photo.' });
    }
    if (!isHabite) {
      const erreur = erreurPhotosBienVide(photos, formula, options);
      if (erreur) return res.status(400).json({ error: erreur });
    }

    // Code secret du lien de suivi : 32 caractères aléatoires, impossible à deviner
    const suiviCode = crypto.randomBytes(16).toString('hex');

    // 1. Fiche client dans Notion (paiement pas encore validé)
    const clientPage = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties: {
          "Nom du Client": { title: [{ text: { content: metadata.clientName || '—' } }] },
          "Email": { email: metadata.clientEmail || null },
          "Téléphone": { phone_number: metadata.clientPhone || null },
          "Adresse du bien": { rich_text: [{ text: { content: metadata.propertyAddress || '—' } }] },
          "Type de prestation": { select: { name: isHabite ? 'Bien habité - Expert' : 'Bien vide' } },
          "Formule": { select: { name: formula.label } },
          "Date de commande": { date: { start: new Date().toISOString() } },
          "Paiement réussi": { checkbox: false },
          "Code suivi": { rich_text: [{ text: { content: suiviCode } }] },
        },
      },
      { headers: NOTION_HEADERS }
    );

    const clientPageId = clientPage.data.id;

    // 2. Référence dossier générée par Notion
    let referenceDossier = orderId;
    let numeroDossier = null;
    try {
      const full = await axios.get(`https://api.notion.com/v1/pages/${clientPageId}`, { headers: NOTION_HEADERS });
      const refProp = full.data.properties["Référence Dossier"];
      if (refProp?.unique_id) {
        referenceDossier = `${refProp.unique_id.prefix || ''}-${refProp.unique_id.number}`;
        numeroDossier = refProp.unique_id.number;
      }
    } catch (err) {
      console.error('[Payments] Référence dossier non lue:', err.message);
    }

    // Bien vide : une famille de style pour toute la commande, en rotation
    // d'un client à l'autre (numéro de dossier), au hasard si numéro illisible
    if (!isHabite) {
      const famille = numeroDossier
        ? FAMILLES_STYLE[(numeroDossier - 1) % FAMILLES_STYLE.length]
        : FAMILLES_STYLE[crypto.randomInt(FAMILLES_STYLE.length)];
      try {
        await axios.patch(
          `https://api.notion.com/v1/pages/${clientPageId}`,
          { properties: { 'Famille style': { select: { name: famille } } } },
          { headers: NOTION_HEADERS }
        );
      } catch (err) {
        console.error('[Payments] Famille style non enregistrée:', err.response?.data || err.message);
      }
    }

    // 3. Une entrée par photo
    for (const photo of photos) {
      await axios.post(
        'https://api.notion.com/v1/pages',
        {
          parent: { database_id: process.env.NOTION_PHOTOS_DATABASE_ID },
          properties: {
            "Titre": { title: [{ text: { content: `${metadata.clientName || '—'} — ${photo.roomType} — Avant — ${referenceDossier}` } }] },
            "Nom du Client": { relation: [{ id: clientPageId }] },
            "Type": { select: { name: 'Avant' } },
            "URL photo": { url: photo.url },
            "Pièce": { select: { name: photo.roomType } },
            "Statut": { select: { name: 'En attente' } },
            "Type de prestation": { select: { name: isHabite ? 'Bien habité' : 'Bien vide' } },
            ...(isHabite ? {} : {
              "Statut génération": { select: { name: 'En attente paiement' } },
              "Contrôle photo": { rich_text: [{ text: { content: JSON.stringify(photo.verification).slice(0, 1900) } }] },
              ...(photo.roomType === 'cuisine' && CHOIX_CUISINE_VALIDES.includes(photo.choixCuisine)
                ? { "Choix cuisine": { select: { name: photo.choixCuisine } } }
                : {}),
            }),
          },
        },
        { headers: NOTION_HEADERS }
      );
    }

    console.log(`[Payments] Commande créée dans Notion — ${referenceDossier} — ${photos.length} photo(s)`);

    // 4. Session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: buildLineItems(formula, options),
      customer_email: clientEmail || undefined,
      success_url: `${SITE_URL}/commande/confirmation?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/commande`,
      metadata: {
        orderId,
        formulaId,
        formulaLabel: formula.label,
        clientName: metadata.clientName || '',
        clientEmail: metadata.clientEmail || '',
        notionPageId: clientPageId,
        referenceDossier,
        isHabite: String(isHabite),
        photoCount: String(photos.length),
        suiviCode,
      },
    });

    console.log(`[Payments] Checkout créé — ${orderId}`);
    res.json({ checkoutUrl: session.url, orderId, referenceDossier });
  } catch (err) {
    console.error('[Payments] Erreur create-checkout:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la création de la commande.' });
  }
});

// ─── POST /api/payments/finalize ─────────────────────────────────────────────────
// Retour de Stripe (page de confirmation du site). Le webhook Stripe fait le
// même travail de son côté : le premier arrivé confirme, l'autre ne refait rien.
router.post('/finalize', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId requis.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Paiement non confirmé.' });
    }

    const m = session.metadata || {};
    await confirmerPaiementCommande(session);

    res.json({
      success: true,
      referenceDossier: m.referenceDossier,
      clientName: m.clientName,
      formulaLabel: m.formulaLabel,
      photoCount: m.photoCount,
      isHabite: m.isHabite === 'true',
      suiviUrl: buildSuiviUrl(m.referenceDossier, m.suiviCode),
    });
  } catch (err) {
    console.error('[Payments] Erreur finalize:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la finalisation.' });
  }
});

// ─── GET /api/payments/suivi/:reference?code=... ─────────────────────────────────
// Page de suivi client : état de la commande + fichiers livrés.
// Accès uniquement avec la référence ET le code secret du dossier.
router.get('/suivi/:reference', async (req, res) => {
  const { reference } = req.params;
  const code = String(req.query.code || '');

  // Même réponse que "introuvable" : on ne révèle pas si la référence existe
  if (!/^[a-f0-9]{32}$/.test(code)) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }

  try {
    // Recherche directe de la fiche par son code secret (plus de limite à 100 fiches)
    const clientQuery = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
      {
        filter: { property: 'Code suivi', rich_text: { equals: code } },
        page_size: 1,
      },
      { headers: NOTION_HEADERS }
    );

    const clientPage = clientQuery.data.results[0];
    if (!clientPage) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const props = clientPage.properties;

    // La référence de l'adresse doit correspondre à celle du dossier
    const refProp = props["Référence Dossier"]?.unique_id;
    const builtRef = refProp ? `${refProp.prefix || ''}-${refProp.number}` : null;
    if (builtRef !== reference) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    if (props["Paiement réussi"]?.checkbox !== true) {
      return res.status(403).json({ error: 'Commande non finalisée.' });
    }

    const typePrestation = props["Type de prestation"]?.select?.name || '';
    const isHabite = typePrestation.toLowerCase().includes('habité');

    // Photos liées à ce dossier uniquement (filtre direct, plus de limite à 100 fiches)
    const photosQuery = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PHOTOS_DATABASE_ID}/query`,
      {
        filter: { property: 'Nom du Client', relation: { contains: clientPage.id } },
        page_size: 100,
      },
      { headers: NOTION_HEADERS }
    );

    const photos = photosQuery.data.results;

    const avant = [];
    const apres = [];

    for (const photo of photos) {
      const pp = photo.properties;
      const url = pp["URL photo"]?.url;
      if (!url) continue;
      const item = {
        url,
        piece: pp["Pièce"]?.select?.name || '—',
        valide: pp["Validé"]?.checkbox === true,
      };
      if (pp["Type"]?.select?.name === 'Après') apres.push(item);
      else avant.push(item);
    }

    const apresValidees = apres.filter((p) => p.valide);

    // Récupération du rapport PDF (colonne "Rapport PDF", type fichier ou URL)
    const pdfProp = props["Rapport PDF"];
    let rapportPdf = null;
    if (pdfProp?.url) rapportPdf = pdfProp.url;
    else if (pdfProp?.files?.length) {
      rapportPdf = pdfProp.files[0].file?.url || pdfProp.files[0].external?.url || null;
    }

    // Bien habité : livré quand le PDF est disponible
    // Bien vide : livré quand toutes les photos "Après" sont validées
    const pretALivrer = isHabite
      ? !!rapportPdf
      : apres.length > 0 && apresValidees.length === apres.length;

    res.json({
      reference,
      clientName: props["Nom du Client"]?.title?.[0]?.plain_text || '',
      formule: props["Formule"]?.select?.name || '',
      typePrestation,
      isHabite,
      dateCommande: props["Date de commande"]?.date?.start || null,
      pretALivrer,
      photosAvant: avant.map((p) => ({ url: p.url, piece: p.piece })),
      photosApres: pretALivrer && !isHabite ? apresValidees.map((p) => ({ url: p.url, piece: p.piece })) : [],
      rapportPdf: pretALivrer && isHabite ? rapportPdf : null,
      nbPhotosAttendues: avant.length,
    });
  } catch (err) {
    console.error('[Payments] Erreur suivi:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande.' });
  }
});

// ─── POST /api/payments/create-intent ────────────────────────────────────────────
// Utilisé par l'application mobile (paiement intégré)
router.post('/create-intent', async (req, res, next) => {
  try {
    const { formulaId, metadata = {}, options = [] } = req.body;
    const formula = FORMULA_PRICES[formulaId];
    if (!formula) {
      console.error(`[Payments] Formule inconnue reçue: "${formulaId}"`);
      return res.status(400).json({ error: 'Formule inconnue.' });
    }

    const { total, details } = computeTotal(formula, options);
    const orderId = `ORD-${uuidv4().split('-')[0].toUpperCase()}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        orderId,
        formulaId,
        formulaLabel: formula.label,
        options: details.join(', ') || 'aucune',
        createdAt: new Date().toISOString(),
      },
      description: `EVIDENCE Home Staging — ${formula.label}`,
      statement_descriptor_suffix: 'EV HOMESTAGING',
    });

    console.log(`[Payments] Intent créé — ${formulaId} (${total / 100}€)`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
      amount: total,
      formulaLabel: formula.label,
    });
  } catch (err) {
    console.error('[Payments] Erreur create-intent:', err.message);
    next(err);
  }
});

// ─── POST /api/payments/confirm ──────────────────────────────────────────────────
// Utilisé par l'application mobile
router.post('/confirm', async (req, res, next) => {
  try {
    const { orderId, paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Paiement non confirmé.' });
    }

    const { metadata, amount } = paymentIntent;
    const priceTTC = amount / 100;
    const priceHT  = parseFloat((priceTTC / 1.20).toFixed(2));
    const tva      = parseFloat((priceTTC - priceHT).toFixed(2));

    const invoice = {
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString(),
      clientName:  metadata.clientName  || 'Client',
      clientEmail: metadata.clientEmail || paymentIntent.receipt_email || '',
      formulaName: FORMULA_PRICES[metadata.formulaId]?.label || metadata.formulaId,
      options:     metadata.options || 'aucune',
      roomType:    `${metadata.roomType || ''}${metadata.multiVue === 'true' ? ' · Multi-vue' : ''}`,
      decoStyle:   metadata.decoStyle || '',
      photoCount:  parseInt(metadata.photoCount || '0'),
      multiVue:    metadata.multiVue === 'true',
      priceHT,
      tva,
      priceTTC,
    };

    console.log(`[Payments] Paiement mobile confirmé — ${orderId} — ${priceTTC}€`);
    res.json({ invoice, orderId });
  } catch (err) {
    console.error('[Payments] Erreur confirm:', err.message);
    next(err);
  }
});

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `EHS-${year}-${seq}`;
}

module.exports = router;

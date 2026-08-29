// backend/routes/payments.js
const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
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
        },
      },
      { headers: NOTION_HEADERS }
    );

    const clientPageId = clientPage.data.id;

    // 2. Référence dossier générée par Notion
    let referenceDossier = orderId;
    try {
      const full = await axios.get(`https://api.notion.com/v1/pages/${clientPageId}`, { headers: NOTION_HEADERS });
      const refProp = full.data.properties["Référence Dossier"];
      if (refProp?.unique_id) {
        referenceDossier = `${refProp.unique_id.prefix || ''}-${refProp.unique_id.number}`;
      }
    } catch (err) {
      console.error('[Payments] Référence dossier non lue:', err.message);
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
      success_url: 'https://evidence-platform-pied.vercel.app/commande/confirmation?session={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://evidence-platform-pied.vercel.app/commande',
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
// Retour de Stripe : marque la commande payée et envoie l'email de confirmation
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
    const isHabite = m.isHabite === 'true';

    global.finalizedOrders = global.finalizedOrders || {};
    const alreadyProcessed = !!global.finalizedOrders[m.orderId];
    global.finalizedOrders[m.orderId] = true;

    if (!alreadyProcessed) {
      // 1. Cocher "Paiement réussi" dans Notion
      await axios.patch(
        `https://api.notion.com/v1/pages/${m.notionPageId}`,
        { properties: { "Paiement réussi": { checkbox: true } } },
        { headers: NOTION_HEADERS }
      );
      console.log(`[Payments] Paiement confirmé — ${m.referenceDossier}`);

      // 2. Email de confirmation au client
      try {
        const suiviUrl = `https://evidence-platform-pied.vercel.app/commande/suivi/${m.referenceDossier}`;
        await axios.post('https://api.resend.com/emails', {
          from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
          to: m.clientEmail,
          subject: 'Votre commande Evidence Home Staging a bien été reçue',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
              <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
                <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
              </div>
              <div style="background: #fff; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${m.clientName || 'cher client'},</h2>
                <p style="color: #555; line-height: 1.6;">
                  Nous avons bien reçu votre commande ainsi que vos ${m.photoCount} photo(s).
                </p>
                <p style="color: #555; line-height: 1.6;">
                  ${isHabite
                    ? "Notre équipe analyse votre bien et vous enverra votre rapport personnalisé sous 48 à 72h."
                    : "Vos visuels sont en cours de préparation et vous seront livrés sous 12h."}
                </p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${suiviUrl}" style="background: #b88a44; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 14px;">
                    Suivre ma commande
                  </a>
                </div>
                <p style="color: #888; font-size: 12px; margin-top: 24px;">
                  Référence : ${m.referenceDossier}<br/>
                  Formule : ${m.formulaLabel || ''}<br/>
                  Conservez ce lien, il vous permettra de récupérer vos fichiers.
                </p>
              </div>
            </div>
          `,
        }, {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        console.log(`[Payments] Email envoyé à ${m.clientEmail}`);
      } catch (err) {
        console.error('[Payments] Erreur email:', err.response?.data || err.message);
      }
    }

    res.json({
      success: true,
      referenceDossier: m.referenceDossier,
      clientName: m.clientName,
      formulaLabel: m.formulaLabel,
      photoCount: m.photoCount,
      isHabite,
    });
  } catch (err) {
    console.error('[Payments] Erreur finalize:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la finalisation.' });
  }
});

// ─── GET /api/payments/suivi/:reference ──────────────────────────────────────────
// Page de suivi client : état de la commande + fichiers livrés
router.get('/suivi/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const clientQuery = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
      { page_size: 100 },
      { headers: NOTION_HEADERS }
    );

    const clientPage = clientQuery.data.results.find((p) => {
      const ref = p.properties["Référence Dossier"];
      if (!ref?.unique_id) return false;
      const built = `${ref.unique_id.prefix || ''}-${ref.unique_id.number}`;
      return built === reference;
    });

    if (!clientPage) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const props = clientPage.properties;
    if (props["Paiement réussi"]?.checkbox !== true) {
      return res.status(403).json({ error: 'Commande non finalisée.' });
    }

    const typePrestation = props["Type de prestation"]?.select?.name || '';
    const isHabite = typePrestation.toLowerCase().includes('habité');

    // Photos liées à ce dossier
    const photosQuery = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PHOTOS_DATABASE_ID}/query`,
      { page_size: 100 },
      { headers: NOTION_HEADERS }
    );

    const photos = photosQuery.data.results.filter((p) =>
      p.properties["Nom du Client"]?.relation?.some((r) => r.id === clientPage.id)
    );

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

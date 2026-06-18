// backend/routes/staging.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { buildPrompt } = require('./prompts');
const { Client } = require("@notionhq/client");
const router = express.Router();

global.stagingOrders = global.stagingOrders || [];

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function uploadToCloudinary(file) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
  try {
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { file, timestamp, api_key: process.env.CLOUDINARY_API_KEY, signature }
    );
    return res.data.secure_url;
  } catch (err) {
    console.error('[Cloudinary] ❌ Erreur détaillée:', err.response?.data || err.message);
    throw err;
  }
}

async function callReplicate(imageUrl, prompt, isFreeTrialMode) {
  const response = await axios.post(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
    {
      input: {
        prompt,
        input_image: imageUrl,
        output_format: 'jpg',
        output_quality: isFreeTrialMode ? 70 : 95,
        safety_tolerance: 2,
        guidance: 7.5,
        num_inference_steps: 30,
      },
    },
    {
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
    }
  );

  let prediction = response.data;
  let attempts = 0;

  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    if (attempts++ > 60) throw new Error('Replicate timeout apres 90s.');
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await axios.get(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` } }
    );
    prediction = poll.data;
  }

  if (prediction.status === 'failed') {
    throw new Error(`Replicate failed: ${JSON.stringify(prediction.error)}`);
  }

  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

async function createNotionRecord(clientData, commandeData, photosData) {
  try {
    console.log('[Notion] Envoi vers Notion:', {
      nom: clientData.nom,
      email: clientData.email,
      nombre_pieces: clientData.nombre_pieces,
      exterieurs: clientData.exterieurs,
      photos_count: photosData.length,
    });

    // 1. Créer la fiche client dans "Gestion Clients"
    const clientPage = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        "Nom du Client": { title: [{ type: "text", text: { content: clientData.nom || "—" } }] },
        "Email": { email: clientData.email || null },
        "Téléphone": { phone_number: clientData.telephone || null },
        "Adresse du bien": { rich_text: [{ type: "text", text: { content: clientData.adresse || "—" } }] },
        "Type de bien": { select: { name: clientData.type_bien || "Autre" } },
        "Nombre de pièces": { select: { name: clientData.nombre_pieces || "—" } },
        "Extérieurs": {
          multi_select: (clientData.exterieurs && clientData.exterieurs.length > 0)
            ? clientData.exterieurs.map(e => ({ name: e }))
            : []
        },
        "Type de prestation": { select: { name: commandeData.type_prestation || "—" } },
        "Formule": { select: { name: commandeData.formula || "—" } },
        "Statut": { status: { name: "Nouveau client" } },
      },
    });

    const clientPageId = clientPage.id;
    console.log('[Notion] ✅ Fiche client créée:', clientPageId);

    // 2. Créer une entrée par photo dans "Photos Particuliers"
    for (let i = 0; i < photosData.length; i++) {
      const photo = photosData[i];
      const pieceLabel = photo.roomTypeId || `Photo ${i + 1}`;

      // Photo AVANT
      if (photo.inputUrl) {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_PHOTOS_DATABASE_ID },
          properties: {
            "Titre": { title: [{ type: "text", text: { content: `${clientData.nom || '—'} — ${pieceLabel} — Avant` } }] },
            "Nom du Client": { relation: [{ id: clientPageId }] },
            "Type": { select: { name: "Avant" } },
            "URL photo": { url: photo.inputUrl },
            "Pièce": { select: { name: pieceLabel } },
            "Statut": { select: { name: "En attente" } },
           "Titre": { title: [{ type: "text", text: { content: `${clientData.nom || '—'} — ${pieceLabel} — Avant — ${commandeData.orderId}` } }] },
          },
        });
      }

      // Photo APRÈS (seulement si générée — bien vide uniquement)
      if (photo.outputUrl) {
        await notion.pages.create({
          parent: { database_id: process.env.NOTION_PHOTOS_DATABASE_ID },
          properties: {
            "Titre": { title: [{ type: "text", text: { content: `${clientData.nom || '—'} — ${pieceLabel} — Après` } }] },
            "Nom du Client": { relation: [{ id: clientPageId }] },
            "Type": { select: { name: "Après" } },
            "URL photo": { url: photo.outputUrl },
            "Pièce": { select: { name: pieceLabel } },
            "Statut": { select: { name: "En attente" } },
           "Titre": { title: [{ type: "text", text: { content: `${clientData.nom || '—'} — ${pieceLabel} — Avant — ${commandeData.orderId}` } }] },
          },
        });
      }
    }

    console.log(`[Notion] ✅ ${photosData.length} photo(s) créées dans Photos Particuliers`);

  } catch (err) {
    console.error('[Notion] ❌ Erreur:', err.message);
  }
}

// ─── POST /api/staging/submit ─────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  const {
    photos, clientName, clientEmail, clientPhone, propertyAddress,
    propertyType, propertySize, exteriorFeatures, isHabite,
    orderId, formulaId, formulaLabel, isFreeTrialMode = false,
  } = req.body;

  if (!photos || photos.length === 0) {
    return res.status(400).json({ error: 'Photos requises.' });
  }

  const orderRef = orderId || `ORD-${Date.now()}`;

  res.json({
    success: true,
    orderId: orderRef,
    message: 'Vos photos ont bien été reçues. Livraison sous 2h à 12h.',
  });

  processOrder({
    photos, clientName, clientEmail, clientPhone, propertyAddress,
    propertyType, propertySize, exteriorFeatures, isHabite,
    orderId: orderRef, formulaId, formulaLabel, isFreeTrialMode,
  }).catch(err => console.error('[Staging] Erreur traitement:', err.message));
});

async function processOrder({ photos, clientName, clientEmail, clientPhone, propertyAddress, propertyType, propertySize, exteriorFeatures, isHabite, orderId, formulaId, formulaLabel, isFreeTrialMode }) {
  console.log(`[Staging] Début traitement commande ${orderId}`);

  const processedPhotos = [];

  for (const photo of photos) {
    try {
      const { imageBase64, roomTypeId, roomSubTypeId, roomSize = 'medium' } = photo;
      const inputUrl = await uploadToCloudinary(`data:image/jpeg;base64,${imageBase64}`);
      console.log(`[Staging] Photo uploadée: ${inputUrl}`);

      const { prompt: prompt1 } = buildPrompt({ roomTypeId, roomSubTypeId, roomSize, variant: 1 });

      let outputUrl = null;
      if (!isHabite) {
        try {
          const replicateUrl = await callReplicate(inputUrl, prompt1, isFreeTrialMode);
          outputUrl = await uploadToCloudinary(replicateUrl);
          console.log(`[Staging] Proposition générée: ${outputUrl}`);
        } catch (err) {
          console.error('[Staging] Erreur proposition:', err.message);
        }
      } else {
        console.log(`[Staging] Bien habité — pas de génération IA`);
      }

      processedPhotos.push({ roomTypeId, roomSubTypeId, inputUrl, outputUrl });
    } catch (err) {
      console.error('[Staging] Erreur traitement photo:', err.message);
    }
  }

  // 3. Envoyer vers Notion
  try {
    await createNotionRecord(
      {
        nom: clientName, email: clientEmail, telephone: clientPhone,
        adresse: propertyAddress, type_bien: propertyType,
        nombre_pieces: propertySize, exterieurs: exteriorFeatures,
      },
      {
        type_prestation: isHabite ? 'Bien habité - Expert' : 'Bien vide',
        formula: formulaLabel || formulaId,
        orderId: orderId,
      },
      processedPhotos
    );
  } catch (err) {
    console.error('[Staging] Erreur Notion direct:', err.message);
  }

  // 4. Sauvegarder en mémoire
  const order = {
    orderId, clientName, clientEmail, formulaId, formulaLabel,
    type: isHabite ? 'habite' : 'vide', photos: processedPhotos,
    status: 'pending_validation', createdAt: new Date().toISOString(),
  };
  global.stagingOrders.push(order);

  // 5. Envoyer email de confirmation
  try {
    const photoUrl = processedPhotos[0]?.outputUrl || processedPhotos[0]?.inputUrl || null;
    await axios.post('https://api.resend.com/emails', {
      from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
      to: clientEmail,
      subject: isHabite ? '📋 Votre dossier home staging a bien été reçu !' : '✨ Votre projection home staging est prête !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
          <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${clientName || 'cher client'},</h2>
            ${isHabite
              ? `<p style="color: #555; line-height: 1.6;">Votre dossier a bien été reçu. Notre équipe d'experts va analyser votre bien et vous envoyer votre rapport sous 48 à 72h.</p>`
              : `<p style="color: #555; line-height: 1.6;">Votre projection home staging est prête ! Notre IA a analysé votre bien et généré une visualisation professionnelle.</p>`
            }
            ${photoUrl && !isHabite ? `<div style="text-align: center; margin: 24px 0;"><img src="${photoUrl}" style="width: 100%; border-radius: 8px;" alt="Votre projection" /></div>` : ''}
            <p style="color: #555; line-height: 1.6;">Retrouvez votre ${isHabite ? 'rapport' : 'projection'} dans l'application Evidence Home Staging.</p>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0; color: #888; font-size: 11px;">Référence commande : ${orderId}</p>
            <p style="margin: 4px 0 0; color: #888; font-size: 11px;">Pour toute question : contact@evidence-homestaging.fr</p>
          </div>
        </div>
      `,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[Staging] ✅ Email envoyé à ${clientEmail}`);
  } catch (err) {
    console.error('[Staging] ❌ Erreur email:', err.message);
  }

  console.log(`[Staging] Commande ${orderId} en attente de validation`);
}

// ─── GET /api/staging/orders ──────────────────────────────────────────────────
router.get('/orders', (req, res) => {
  res.json(global.stagingOrders || []);
});

// ─── PATCH /api/staging/orders/:orderId/validate ──────────────────────────────
router.patch('/orders/:orderId/validate', async (req, res) => {
  const order = global.stagingOrders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

  order.status = 'validated';
  order.validatedAt = new Date().toISOString();

  res.json({ success: true, order });
});

module.exports = router;

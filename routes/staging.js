// backend/routes/staging.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { buildPrompt } = require('./prompts');
const { Client } = require("@notionhq/client");
const router = express.Router();

// Store global pour commandes biens vides en attente de validation
global.stagingOrders = global.stagingOrders || [];

// Notion Client
const notion = new Client({ 
  auth: process.env.NOTION_API_KEY 
});

async function uploadToCloudinary(file) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      file,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      signature,
    }
  );
  return res.data.secure_url;
}

async function callReplicate(imageUrl, prompt, isFreeTrialMode) {
  const response = await axios.post(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
    {
      input: {
        prompt: prompt,
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

    const photoUrl = photosData.length > 0 && photosData[0].outputUrl ? photosData[0].outputUrl : null;

    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        "Nom du Client": { 
          title: [{ type: "text", text: { content: clientData.nom || "—" } }] 
        },
        "Email": { 
          email: clientData.email || null
        },
        "Téléphone": { 
          phone_number: clientData.telephone || null
        },
        "Adresse du bien": { 
          rich_text: [{ type: "text", text: { content: clientData.adresse || "—" } }] 
        },
        "Type de bien": { 
          select: { name: clientData.type_bien || "Autre" } 
        },
        "Nombre de pièces": { 
          select: { name: clientData.nombre_pieces || "—" } 
        },
        "Extérieurs": { 
          multi_select: (clientData.exterieurs && clientData.exterieurs.length > 0) 
            ? clientData.exterieurs.map(e => ({ name: e }))
            : []
        },
        "Type de prestation": { 
          select: { name: commandeData.type_prestation || "—" } 
        },
        "Formule": { 
          select: { name: commandeData.formula || "—" } 
        },
        "Photos": photoUrl ? { url: photoUrl } : { url: null },
        "Statut": { 
          status: { name: "Nouveau client" } 
        },
      },
    });
    console.log('[Notion] ✅ Record créé avec succès');
  } catch (err) {
    console.error('[Notion] ❌ Erreur:', err.message);
  }
}
// ─── POST /api/staging/submit ─────────────────────────────────────────────────
router.post('/submit', async (req, res) => {
  const {
    photos,
    clientName,
    clientEmail,
    clientPhone,
    propertyAddress,
    propertyType,
    propertySize,
    exteriorFeatures,
    isHabite,
    orderId,
    formulaId,
    formulaLabel,
    isFreeTrialMode = false,
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
    photos,
    clientName,
    clientEmail,
    clientPhone,
    propertyAddress,
    propertyType,
    propertySize,  
    exteriorFeatures, 
    isHabite,
    orderId: orderRef,
    formulaId,
    formulaLabel,
    isFreeTrialMode,
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
      try {
        const replicateUrl = await callReplicate(inputUrl, prompt1, isFreeTrialMode);
        outputUrl = await uploadToCloudinary(replicateUrl);
        console.log(`[Staging] Proposition générée: ${outputUrl}`);
      } catch (err) {
        console.error('[Staging] Erreur proposition:', err.message);
      }

      processedPhotos.push({
        roomTypeId,
        roomSubTypeId,
        inputUrl,
        outputUrl,
      });
    } catch (err) {
      console.error('[Staging] Erreur traitement photo:', err.message);
    }
  }
// 3. Envoyer vers Notion DIRECTEMENT
  try {
    await createNotionRecord(
      {
        nom: clientName,
        email: clientEmail,
        telephone: clientPhone,
        adresse: propertyAddress,
        type_bien: propertyType,
        nombre_pieces: propertySize,
        exterieurs: exteriorFeatures,
      },
      {
        type_prestation: isHabite ? 'Bien habité - Expert' : 'Bien vide',
        formula: formulaLabel || formulaId,
      },
      processedPhotos
    );
  } catch (err) {
    console.error('[Staging] Erreur Notion direct:', err.message);
  }
  // 4. Sauvegarder la commande en mémoire
  const order = {
    orderId,
    clientName,
    clientEmail,
    formulaId,
    formulaLabel,
    type: 'vide',
    photos: processedPhotos,
    status: 'pending_validation',
    createdAt: new Date().toISOString(),
  };
  global.stagingOrders.push(order);
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

  try {
    await axios.post('https://api.resend.com/emails', {
      from: 'Evidence Home Staging <noreply@evidence-homestaging.fr>',
      to: order.clientEmail,
      subject: 'Vos projections home staging sont prêtes !',
      html: `
        <h2>Bonjour ${order.clientName || 'cher client'},</h2>
        <p>Vos projections home staging ont été validées et sont disponibles dans votre espace client.</p>
        <p>Connectez-vous à l'application Evidence Home Staging pour les consulter et les télécharger.</p>
        <br>
        <p>L'équipe Evidence Home Staging</p>
      `,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[Staging] Email envoyé à ${order.clientEmail}`);
  } catch (err) {
    console.error('[Staging] Erreur email Resend:', err.message);
  }

  res.json({ success: true, order });
});

module.exports = router;
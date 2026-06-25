const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Client } = require("@notionhq/client");
const { buildPrompt } = require('./prompts');
const router = express.Router();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const OFFER_PHOTOS_LIMIT = {
  pro_starter: 10,
  pro_business: 30,
  pro_agency: 80,
};

async function uploadToCloudinary(file) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha256')
    .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');
  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { file, timestamp, api_key: process.env.CLOUDINARY_API_KEY, signature }
  );
  return res.data.secure_url;
}

async function callReplicate(imageUrl, prompt) {
  const response = await axios.post(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
    {
      input: {
        prompt,
        input_image: imageUrl,
        output_format: 'jpg',
        output_quality: 95,
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
    if (attempts++ > 60) throw new Error('Replicate timeout.');
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

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'evidence-secret-temp');
  } catch {
    return null;
  }
}

// ─── POST /api/pro/projects/create ─────────────────────────────────────────
router.post('/create', async (req, res) => {
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié.' });

  const { projectName, photos } = req.body;
  if (!projectName || !photos || photos.length === 0) {
    return res.status(400).json({ error: 'Nom du projet et photos requis.' });
  }

  try {
    // 1. Trouver la fiche abonnement PRO
    const subRes = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_DATABASE_ID}/query`,
      { filter: { property: 'Email', email: { equals: decoded.email } } },
      { headers: { 'Authorization': `Bearer ${process.env.NOTION_API_KEY}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } }
    );
    if (!subRes.data.results.length) {
      return res.status(404).json({ error: 'Abonnement non trouvé.' });
    }
    const subPage = subRes.data.results[0];
    const subPageId = subPage.id;
    const offerId = subPage.properties['Offre']?.select?.name || 'pro_starter';

    res.json({ success: true, message: 'Création du projet en cours.' });

    // 2. Créer le projet dans Notion (en arrière-plan)
    processProject({ subPageId, projectName, photos });

  } catch (err) {
    console.error('[ProProjects] Erreur:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la création du projet.' });
  }
});

async function processProject({ subPageId, projectName, photos }) {
  console.log(`[ProProjects] Début traitement projet: ${projectName}`);

  try {
    const projectPage = await notion.pages.create({
     parent: { database_id: process.env.NOTION_PRO_PROJECTS_DATABASE_ID },
      properties: {
        "Nom du projet": { title: [{ type: "text", text: { content: projectName } }] },
        "Nom entreprise": { relation: [{ id: subPageId }] },
        "Statut": { select: { name: "Nouveau" } },
        "Photos reçues": { number: photos.length },
      },
    });

    const projectPageId = projectPage.id;
    let deliveredCount = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        const inputUrl = await uploadToCloudinary(`data:image/jpeg;base64,${photo.imageBase64}`);
        console.log(`[ProProjects] Photo uploadée: ${inputUrl}`);

        const { prompt } = buildPrompt({
          roomTypeId: photo.roomTypeId || 'salon',
          roomSubTypeId: photo.roomSubTypeId,
          roomSize: photo.roomSize || 'medium',
          variant: 1,
        });

        let outputUrl = null;
        try {
          const replicateUrl = await callReplicate(inputUrl, prompt);
          outputUrl = await uploadToCloudinary(replicateUrl);
          deliveredCount++;
          console.log(`[ProProjects] Proposition générée: ${outputUrl}`);
        } catch (err) {
          console.error('[ProProjects] Erreur génération IA:', err.message);
        }

        const pieceLabel = photo.roomTypeId || `Photo ${i + 1}`;

        if (inputUrl) {
          await notion.pages.create({
            parent: { database_id: process.env.NOTION_PHOTOS_PRO_DATABASE_ID },
            properties: {
              "Titre": { title: [{ type: "text", text: { content: `${projectName} — ${pieceLabel} — Avant` } }] },
              "Projet": { relation: [{ id: projectPageId }] },
              "Type": { select: { name: "Avant" } },
              "URL photo": { url: inputUrl },
              "Pièce": { select: { name: pieceLabel } },
              "Statut": { select: { name: "En attente" } },
            },
          });
        }

        if (outputUrl) {
          await notion.pages.create({
            parent: { database_id: process.env.NOTION_PHOTOS_PRO_DATABASE_ID },
            properties: {
              "Titre": { title: [{ type: "text", text: { content: `${projectName} — ${pieceLabel} — Après` } }] },
              "Projet": { relation: [{ id: projectPageId }] },
              "Type": { select: { name: "Après" } },
              "URL photo": { url: outputUrl },
              "Pièce": { select: { name: pieceLabel } },
              "Statut": { select: { name: "En attente validation" } },
            },
          });
        }
      } catch (err) {
        console.error('[ProProjects] Erreur traitement photo:', err.message);
      }
    }

    await notion.pages.update({
      page_id: projectPageId,
      properties: {
        "Statut": { select: { name: "En cours" } },
        "Photos livrées": { number: deliveredCount },
      },
    });
    console.log(`[ProProjects] ✅ Projet ${projectName} terminé`);

  } catch (err) {
    console.error('[ProProjects] Erreur globale:', err.message);
  }
}

module.exports = router;

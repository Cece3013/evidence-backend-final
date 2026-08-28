const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const { buildPromptHabitesParticuliers } = require('./promptsHabitesParticuliers');

// ─── POST /api/test-staging/upload ─────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (req.body.testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
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
    console.error('[TestStaging] Erreur upload:', err.response?.data || err.message);
    res.status(500).json({ error: "Erreur lors de l'upload." });
  }
});

// ─── POST /api/test-staging/habites ────────────────────────────────────────
router.post('/habites', async (req, res) => {
  const { imageUrl, roomType, testKey } = req.body;

  // Protection simple pour que la route reste réservée à vous
  if (testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  if (!imageUrl || !roomType) {
    return res.status(400).json({ error: 'imageUrl et roomType requis.' });
  }

  try {
    // 1. Construire le prompt (avec détection auto des micro-modules)
    const { prompt, detectedModules } = await buildPromptHabitesParticuliers(roomType, imageUrl);

    // 2. Lancer la génération via Replicate
    const prediction = await axios.post(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions',
      {
        input: {
          prompt: prompt,
          input_image: imageUrl,
          output_format: 'jpg',
          safety_tolerance: 2,
        },
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        timeout: 120000,
      }
    );

    const outputUrl = Array.isArray(prediction.data.output)
      ? prediction.data.output[0]
      : prediction.data.output;

    if (!outputUrl) {
      return res.status(500).json({
        error: 'Aucune image générée.',
        status: prediction.data.status,
        detail: prediction.data.error,
      });
    }

    console.log(`[TestStaging] Génération réussie — pièce: ${roomType}`);

    res.json({
      success: true,
      originalUrl: imageUrl,
      generatedUrl: outputUrl,
      roomType,
      detectedModules,
      prompt,
    });
  } catch (err) {
    console.error('[TestStaging] Erreur:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erreur lors de la génération.',
      detail: err.response?.data || err.message,
    });
  }
});

module.exports = router;

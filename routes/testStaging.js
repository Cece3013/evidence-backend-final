
const express = require('express');
const axios = require('axios');
const router = express.Router();

const { buildPromptHabitesParticuliers } = require('./promptsHabitesParticuliers');

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
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        timeout: 120000,
      }
    );

    const outputUrl = prediction.data.output;

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

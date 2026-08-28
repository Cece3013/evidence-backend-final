const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const { buildPromptHabitesParticuliers } = require('./promptsHabitesParticuliers');
const { buildPromptHabitesPro } = require('./promptsHabitesPro');

async function uploadBufferToCloudinary(buffer, filename) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', buffer, { filename: filename || 'image.jpg' });
  form.append('timestamp', timestamp);
  form.append('api_key', process.env.CLOUDINARY_API_KEY);
  form.append('signature', signature);

  const cloudRes = await axios.post(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    form,
    { headers: form.getHeaders(), maxBodyLength: Infinity }
  );
  return cloudRes.data.secure_url;
}

// ─── POST /api/test-staging/upload ─────────────────────────────────────────
router.post('/upload', upload.single('photo'), async (req, res) => {
  if (req.body.testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  try {
    const url = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
    res.json({ url });
  } catch (err) {
    console.error('[TestStaging] Erreur upload:', err.response?.data || err.message);
    res.status(500).json({ error: "Erreur lors de l'upload." });
  }
});

// ─── POST /api/test-staging/habites ────────────────────────────────────────
router.post('/habites', async (req, res) => {
  const { imageUrl, roomType, testKey, clientType = 'particulier' } = req.body;

  if (testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  if (!imageUrl || !roomType) {
    return res.status(400).json({ error: 'imageUrl et roomType requis.' });
  }

  try {
    // 1. Construire le prompt selon le type de client
    const builder = clientType === 'pro' ? buildPromptHabitesPro : buildPromptHabitesParticuliers;
    const { prompt, detectedModules } = await builder(roomType, imageUrl);

    // 2. Télécharger la photo source
    const imageRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const imageBuffer = Buffer.from(imageRes.data);

    // 3. Envoyer à GPT Image 2 pour édition
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', prompt);
    form.append('image', imageBuffer, { filename: 'source.jpg', contentType: 'image/jpeg' });
    form.append('quality', 'high');
    form.append('size', '1536x1024');

    const openaiRes = await axios.post(
      'https://api.openai.com/v1/images/edits',
      form,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        maxBodyLength: Infinity,
        timeout: 180000,
      }
    );

    const b64 = openaiRes.data.data[0].b64_json;
    if (!b64) {
      return res.status(500).json({ error: 'Aucune image générée par OpenAI.' });
    }

    // 4. Réuploader le résultat sur Cloudinary
    const generatedUrl = await uploadBufferToCloudinary(Buffer.from(b64, 'base64'), 'generated.jpg');

    console.log(`[TestStaging] Génération réussie — ${clientType} / ${roomType}`);

    res.json({
      success: true,
      originalUrl: imageUrl,
      generatedUrl,
      roomType,
      clientType,
      detectedModules,
      prompt,
    });
  } catch (err) {
    console.error('[TestStaging] Erreur:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erreur lors de la génération.',
      detail: err.response?.data?.error?.message || err.response?.data || err.message,
    });
  }
});

module.exports = router;

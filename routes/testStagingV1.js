const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const { buildPromptBienVideV1 } = require('./pipelineVidesV1');
const { GUIDE_VISUEL_SALON_SAM_ACTIF } = require('./guideVisuelV1');

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

/**
 * Envoie un prompt + une image à un modèle d'image OpenAI, renvoie l'URL
 * Cloudinary du résultat. model par défaut : gpt-image-2.5-sunburst (déjà
 * en place sur la branche archivée).
 */
async function genererImage(prompt, imageUrl, model = 'gpt-image-2.5-sunburst') {
  const imageNormalisee = imageUrl.includes('/upload/')
    ? imageUrl.replace('/upload/', '/upload/w_1536,c_limit,f_png,fl_force_strip/')
    : imageUrl;

  const imageRes = await axios.get(imageNormalisee, { responseType: 'arraybuffer', timeout: 60000 });
  const imageBuffer = Buffer.from(imageRes.data);

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image', imageBuffer, { filename: 'source.png', contentType: 'image/png' });
  form.append('quality', 'high');
  form.append('size', 'auto');

  const openaiRes = await axios.post(
    'https://api.openai.com/v1/images/edits',
    form,
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
      maxBodyLength: Infinity,
      timeout: 180000,
    }
  );

  const b64 = openaiRes.data.data[0].b64_json;
  if (!b64) throw new Error('Aucune image générée par OpenAI.');
  return uploadBufferToCloudinary(Buffer.from(b64, 'base64'), 'generated.png');
}

/**
 * PROTOTYPE — Guide Visuel Assisté, salon_salle_a_manger uniquement.
 * Envoie DEUX images à l'endpoint edits : la photo source (image[0], celle
 * à transformer) et le guide de zonage (image[1], uniquement indicatif).
 * Séparée de genererImage() ci-dessus : aucun impact sur le flux normal.
 */
async function genererImageAvecGuide(prompt, imageUrl, guideUrl, model = 'gpt-image-2.5-sunburst') {
  const normaliser = (url) =>
    url.includes('/upload/') ? url.replace('/upload/', '/upload/w_1536,c_limit,f_png,fl_force_strip/') : url;

  const [imageRes, guideRes] = await Promise.all([
    axios.get(normaliser(imageUrl), { responseType: 'arraybuffer', timeout: 60000 }),
    axios.get(normaliser(guideUrl), { responseType: 'arraybuffer', timeout: 60000 }),
  ]);

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('image[]', Buffer.from(imageRes.data), { filename: 'source.png', contentType: 'image/png' });
  form.append('image[]', Buffer.from(guideRes.data), { filename: 'guide.png', contentType: 'image/png' });
  form.append('quality', 'high');
  form.append('size', 'auto');

  const openaiRes = await axios.post(
    'https://api.openai.com/v1/images/edits',
    form,
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...form.getHeaders() },
      maxBodyLength: Infinity,
      timeout: 180000,
    }
  );

  const b64 = openaiRes.data.data[0].b64_json;
  if (!b64) throw new Error('Aucune image générée par OpenAI.');
  return uploadBufferToCloudinary(Buffer.from(b64, 'base64'), 'generated.png');
}

// ─── POST /api/test-staging-v1/upload ──────────────────────────────────────
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
    console.error('[TestStagingV1] Erreur upload:', err.response?.data || err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi de la photo." });
  }
});

// ─── POST /api/test-staging-v1/vides ───────────────────────────────────────
// Pipeline V1 : Contrôle Photo V2 → (classification cuisine si applicable)
// → Noyau + Module → génération. Une seule photo, jamais de vues
// complémentaires.
router.post('/vides', async (req, res) => {
  const { imageUrl, roomType, choixCuisine, guideImageUrl, utiliserStyleVariant, testKey } = req.body;

  if (testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  if (!imageUrl || !roomType) {
    return res.status(400).json({ error: 'imageUrl et roomType requis.' });
  }

  // PROTOTYPE Guide Visuel : actif seulement si guideImageUrl est fourni,
  // roomType === 'salon_salle_a_manger', ET le drapeau maître est actif
  // (désactivé le 20/09/2026 — décision V1, voir guideVisuelV1.js).
  const utiliserGuideVisuel =
    Boolean(guideImageUrl) && roomType === 'salon_salle_a_manger' && GUIDE_VISUEL_SALON_SAM_ACTIF;

  try {
    const resultat = await buildPromptBienVideV1({
      photoPrincipale: imageUrl,
      roomType,
      choixCuisine: choixCuisine || null,
      utiliserGuideVisuel,
      utiliserStyleVariant: Boolean(utiliserStyleVariant),
    });

    if (resultat.status === 'PHOTO_A_REPRENDRE') {
      console.log(`[TestStagingV1] Photo à reprendre — ${resultat.raison}`);
      return res.json({
        success: false,
        status: 'PHOTO_A_REPRENDRE',
        raison: resultat.raison,
        retakeInstruction: resultat.retakeInstruction,
        controle: resultat.controle,
      });
    }

    if (resultat.status === 'CHOIX_CUISINE_REQUIS') {
      console.log(`[TestStagingV1] Choix cuisine requis — ${resultat.classificationCuisine.status}`);
      return res.json({
        success: false,
        status: 'CHOIX_CUISINE_REQUIS',
        classificationCuisine: resultat.classificationCuisine,
        recommandation: resultat.recommandation,
        options: resultat.options,
      });
    }

    // status === 'PRET'
    const generatedUrl = utiliserGuideVisuel
      ? await genererImageAvecGuide(resultat.prompt, imageUrl, guideImageUrl)
      : await genererImage(resultat.prompt, imageUrl);

    console.log(`[TestStagingV1] Vide généré — ${roomType}${utiliserGuideVisuel ? ' (guide visuel)' : ''}`);
    res.json({
      success: true,
      originalUrl: imageUrl,
      generatedUrl,
      roomType,
      prompt: resultat.prompt,
      controle: resultat.controle,
      classificationCuisine: resultat.classificationCuisine,
      lectureFonctionnelle: resultat.lectureFonctionnelle,
      guideVisuelUtilise: utiliserGuideVisuel,
      guideImageUrl: utiliserGuideVisuel ? guideImageUrl : undefined,
      styleVariantId: resultat.styleVariantId,
    });
  } catch (err) {
    console.error('[TestStagingV1] Erreur vides:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erreur lors de la génération.',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

module.exports = router;

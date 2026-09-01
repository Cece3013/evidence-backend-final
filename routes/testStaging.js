const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const multer = require('multer');
const FormData = require('form-data');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const { buildPromptHabitesParticuliers } = require('./promptsHabitesParticuliers');
const { buildPromptHabitesPro } = require('./promptsHabitesPro');
const { buildPromptBienVide, controlerGeneration } = require('./pipelineVides');

// Nombre maximal de régénérations automatiques après un contrôle rejeté avec
// next_step = REGENERATE. Au-delà, le dossier passe en révision manuelle
// plutôt que de boucler indéfiniment (coût et temps maîtrisés).
const MAX_REGENERATIONS = 2;

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
 * Envoie un prompt + une image à GPT Image 2, renvoie l'URL Cloudinary du résultat.
 * L'image est normalisée en PNG par Cloudinary pour garantir la compatibilité.
 */
async function genererImage(prompt, imageUrl) {
  const imageNormalisee = imageUrl.includes('/upload/')
    ? imageUrl.replace('/upload/', '/upload/w_1536,c_limit,f_png,fl_force_strip/')
    : imageUrl;

  const imageRes = await axios.get(imageNormalisee, { responseType: 'arraybuffer', timeout: 60000 });
  const imageBuffer = Buffer.from(imageRes.data);

  const form = new FormData();
  form.append('model', 'gpt-image-2');
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
 * Construit le texte de correction à ajouter au prompt de synthèse à partir
 * du verdict du contrôle post-génération, pour une nouvelle tentative ciblée.
 */
function construireCorrectionDepuisControle(controle) {
  return [
    '',
    '=== CORRECTION OBLIGATOIRE SUITE AU CONTRÔLE POST-GÉNÉRATION ===',
    "La génération précédente a été rejetée pour les raisons suivantes. Corrige-les strictement, sans modifier le reste de l'implantation ni de l'architecture :",
    controle.issues_summary || '',
    JSON.stringify(
      {
        forbidden_elements_visible: controle.forbidden_elements_visible || [],
        out_of_frame_furniture_visible: controle.out_of_frame_furniture_visible || [],
        required_furniture_missing: controle.required_furniture_missing || [],
        placement_conflicts: controle.placement_conflicts || [],
        space_utilization_issue: controle.space_utilization_issue || { detected: false, detail: '' },
        forbidden_zones_violated: controle.forbidden_zones_violated || [],
      },
      null,
      2
    ),
  ].join('\n');
}

/**
 * Génère une image puis la fait vérifier par le contrôle post-génération.
 * Régénère automatiquement (jusqu'à MAX_REGENERATIONS fois) si le contrôle
 * détecte un écart corrigible. Retourne le résultat final, qu'il soit validé
 * ou à envoyer en révision manuelle.
 */
async function genererEtControler({ prompt, imageUrl, implantation }) {
  let promptCourant = prompt;
  let generatedUrl = await genererImage(promptCourant, imageUrl);
  let controle = await controlerGeneration({
    photoPrincipale: imageUrl,
    imageGeneree: generatedUrl,
    implantation,
  });

  let tentatives = 0;
  while (
    controle.controle_status !== 'VALIDE' &&
    controle.next_step === 'REGENERATE' &&
    tentatives < MAX_REGENERATIONS
  ) {
    tentatives += 1;
    console.log(`[TestStaging] Contrôle rejeté (régénération ${tentatives}/${MAX_REGENERATIONS}) — ${controle.issues_summary}`);

    promptCourant = promptCourant + construireCorrectionDepuisControle(controle);
    generatedUrl = await genererImage(promptCourant, imageUrl);
    controle = await controlerGeneration({
      photoPrincipale: imageUrl,
      imageGeneree: generatedUrl,
      implantation,
    });
  }

  const valide = controle.controle_status === 'VALIDE';

  return {
    generatedUrl,
    promptFinal: promptCourant,
    controle,
    valide,
    manualReview: !valide,
    tentativesRegeneration: tentatives,
  };
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
    res.status(500).json({ error: "Erreur lors de l'envoi de la photo." });
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
    const builder = clientType === 'pro' ? buildPromptHabitesPro : buildPromptHabitesParticuliers;
    const { prompt, detectedModules } = await builder(roomType, imageUrl);

    const generatedUrl = await genererImage(prompt, imageUrl);

    console.log(`[TestStaging] Habité généré — ${clientType} / ${roomType}`);
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
    console.error('[TestStaging] Erreur habités:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erreur lors de la génération.',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

// ─── POST /api/test-staging/vides ──────────────────────────────────────────
// Pipeline A → B → synthèse → génération → contrôle post-génération
router.post('/vides', async (req, res) => {
  const {
    imageUrl,
    photosComplementaires = [],
    roomType,
    testKey,
    activeMicroModules = [],
    commentaireClient = '',
  } = req.body;

  if (testKey !== process.env.TEST_STAGING_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  if (!imageUrl || !roomType) {
    return res.status(400).json({ error: 'imageUrl et roomType requis.' });
  }

  try {
    const resultat = await buildPromptBienVide({
      photoPrincipale: imageUrl,
      photosComplementaires,
      roomType,
      activeMicroModules,
      commentaireClient,
    });

    // Le pipeline s'est arrêté : photos insuffisantes ou implantation impossible
    if (resultat.status !== 'PRET') {
      console.log(`[TestStaging] Vide bloqué à l'étape ${resultat.etape} — ${resultat.raison}`);
      return res.json({
        success: false,
        blocked: true,
        status: resultat.status,
        etape: resultat.etape,
        raison: resultat.raison,
        demandes: resultat.demandes,
        analyse: resultat.analyse,
        implantation: resultat.implantation || null,
      });
    }

    const {
      generatedUrl,
      promptFinal,
      controle,
      valide,
      manualReview,
      tentativesRegeneration,
    } = await genererEtControler({
      prompt: resultat.prompt,
      imageUrl,
      implantation: resultat.implantation,
    });

    console.log(
      `[TestStaging] Vide généré — ${roomType} — contrôle: ${controle.controle_status} (${tentativesRegeneration} régénération(s)) — ${manualReview ? 'RÉVISION MANUELLE' : 'OK'}`
    );

    res.json({
      success: true,
      valide,
      manualReview,
      tentativesRegeneration,
      originalUrl: imageUrl,
      generatedUrl,
      roomType,
      prompt: promptFinal,
      analyse: resultat.analyse,
      implantation: resultat.implantation,
      controle,
    });
  } catch (err) {
    console.error('[TestStaging] Erreur vides:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erreur lors de la génération.',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

module.exports = router;

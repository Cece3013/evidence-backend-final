const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { buildPrompt } = require('./prompts');
const router = express.Router();

const freeTrialLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: "Essai gratuit deja utilise aujourd'hui.",
      retryAfterHours: 24,
      upsellMessage: 'Passez a une formule payante pour des resultats illimites.',
    });
  },
});

router.post('/free-trial', freeTrialLimiter, async (req, res, next) => {
  req.body.isFreeTrialMode = true;
  next();
}, handleGenerate);

router.post('/generate', handleGenerate);

router.post('/regen', async (req, res, next) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId requis.' });
  req.body.isRegen = true;
  next();
}, handleGenerate);

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

async function handleGenerate(req, res) {
  const {
    imageBase64,
    imageUrl: existingUrl,
    isFreeTrialMode = false,
    angles = ['default'],
    roomTypeId = 'default',
    roomSubTypeId,
    roomSize = 'medium',
    variant = 1,
  } = req.body;

  if (!imageBase64 && !existingUrl) {
    return res.status(400).json({ error: 'Image requise (base64 ou URL).' });
  }

  try {
    let sourceUrl = existingUrl;

    if (imageBase64) {
      sourceUrl = await uploadToCloudinary(`data:image/jpeg;base64,${imageBase64}`);
    }

    const { prompt, negative_prompt } = buildPrompt({
      roomTypeId,
      roomSubTypeId,
      roomSize,
      variant,
    });

    const results = await Promise.all(
      angles.map(async (angleId) => {
        const replicateUrl = await callReplicate(sourceUrl, prompt, negative_prompt, isFreeTrialMode);
        const permanentUrl = await uploadToCloudinary(replicateUrl);
        const finalUrl = isFreeTrialMode ? applyCloudinaryWatermark(permanentUrl) : permanentUrl;
        return { angle: angleId, imageUrl: finalUrl };
      }),
    );

    const scoreDetails = computeAttractivenessScore(prompt);
    const score = Math.round(scoreDetails.reduce((a, d) => a + d.value, 0) / scoreDetails.length);
    const conseils = generateConseils();

    res.json({ results, score, scoreDetails, conseils, isFreeTrialMode });
  } catch (err) {
    console.error('[AI Generate]', err.message, err.response?.data || '');
    res.status(500).json({ error: err.message });
  }
}

async function callReplicate(imageUrl, prompt, negativePrompt, isFreeTrialMode) {
  try {
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
      if (attempts++ > 60) {
        throw new Error('Replicate timeout apres 90s.');
      }
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          },
        }
      );
      prediction = poll.data;
    }

    if (prediction.status === 'failed') {
      console.error('Replicate error:', prediction.error);
      throw new Error(`Replicate failed: ${JSON.stringify(prediction.error)}`);
    }

    return Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;

  } catch (err) {
    console.error('[Replicate ERROR]');
    console.error('Message:', err.message);
    console.error('Status:', err.response?.status);
    console.error('Data:', JSON.stringify(err.response?.data, null, 2));
    if (err.response?.status === 429) {
      const retryAfter = (err.response?.data?.retry_after || 10) * 1000;
      console.log(`[Replicate] Rate limited, retry in ${retryAfter}ms`);
      await new Promise(r => setTimeout(r, retryAfter));
      return callReplicate(imageUrl, prompt, negativePrompt, isFreeTrialMode);
    }
    throw err;
  }
}

function applyCloudinaryWatermark(url) {
  return url.replace(
    '/upload/',
    '/upload/l_text:Arial_36_bold:ESSAI%20GRATUIT,co_white,o_40,g_center,y_0/',
  );
}

function computeAttractivenessScore(prompt) {
  const isLumineux = /bright|light/i.test(prompt);
  const isNeutral = /neutral/i.test(prompt);
  const isMinimal = /minimal/i.test(prompt);
  return [
    { label: 'Luminosite', value: 70 + (isLumineux ? 15 : 0) + rand(10) },
    { label: 'Perception espace', value: 65 + (isMinimal ? 10 : 0) + rand(15) },
    { label: 'Neutralite deco', value: 63 + (isNeutral ? 12 : 0) + rand(10) },
    { label: 'Agencement', value: 68 + rand(12) },
  ];
}

function generateConseils() {
  return [
    { priorite: 'urgent', texte: 'Nettoyez chaque surface avant les visites.', impact: "L'acheteur percoit le soin apporte au bien." },
    { priorite: 'important', texte: 'Ouvrez les volets pour maximiser la lumiere.', impact: "La lumiere est le premier critere emotionnel d'un acheteur." },
    { priorite: 'optionnel', texte: 'Ajoutez des plantes vertes dans les angles.', impact: 'Atmosphere positive sans encombrer.' },
  ];
}

const rand = (max) => Math.floor(Math.random() * max);

router.post('/contextual-conseils', async (req, res) => {
  const { imageBase64, roomTypeId } = req.body;

  const roomGuides = {
    salon: 'Salon : alleger les meubles, maximiser lumiere naturelle, creer ambiance chaleureuse.',
    chambre: 'Chambre : literie soignee blanc/beige, couleurs douces, espace apaisant.',
    cuisine: 'Cuisine : plan de travail degage, proprete impeccable, rangements organises.',
    salle_bain: 'Salle de bain : joints propres, serviettes neutres, accessoires minimalistes.',
    bureau: 'Bureau : espace ordonne, lumiere naturelle, ambiance productive et neutre.',
    entree: 'Entree : espace degage, lumiere agreable, miroir si possible.',
    salle_manger: 'Salle a manger : table sobre, chaises neutres, lumiere naturelle.',
    terrasse: 'Terrasse : mobilier simple range, plantes propres, entree valorisee.',
  };

  const guide = roomGuides[roomTypeId] || 'Neutralite, lumiere, projection acheteur universel.';
  const systemPrompt = `Tu es un expert en home staging immobilier. Tu analyses cette photo pour donner 3 conseils actionnables. REGLES : ${guide} IMPORTANT : actions gratuites, ton rassurant, sans mentionner IA. FORMAT JSON STRICT : {"pointsForts": [{"categorie": "Lumiere", "texte": "<observation>"}], "conseils": [{"priorite": "urgent", "texte": "<conseil>", "impact": "<impact>"}, {"priorite": "important", "texte": "<conseil>", "impact": "<impact>"}, {"priorite": "optionnel", "texte": "<conseil>", "impact": "<impact>"}]}`;

  try {
    if (!imageBase64) return res.status(400).json({ error: 'Image requise.' });

   const response = await axios.post(
  'https://api.openai.com/v1/messages',
  {
    model: 'gpt-4-vision',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: systemPrompt,
          },
        ],
      },
    ],
  },
  {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  }
);

    const text = response.data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);

  } catch (err) {
    console.error('[Contextual Conseils]', err.message, err.response?.data || '');
    res.status(500).json({ error: err.message });
  }
});

router.post('/analyze', async (req, res) => {
  const { imageBase64, propertyType, roomCount, roomLabel, clientEmail, clientName, orderId } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Image requise.' });

  let cloudinaryUrl = null;
  try {
    cloudinaryUrl = await uploadToCloudinary(`data:image/jpeg;base64,${imageBase64}`);
    console.log('[Cloudinary] Photo bien habite uploadee :', cloudinaryUrl);
  } catch (cloudErr) {
    console.error('[Cloudinary] Erreur upload :', cloudErr.message);
    return res.status(500).json({ error: 'Erreur envoi photo. Reessayez.' });
  }

  try {
    await axios.post('https://hook.eu1.make.com/6wbof3mji4kvzuhlbk3lsf7pcltxoqcm', {
      orderId: orderId || null,
      clientName: clientName || null,
      clientEmail: clientEmail || null,
      propertyType: propertyType || null,
      roomCount: roomCount || null,
      roomLabel: roomLabel || null,
      photoUrl: cloudinaryUrl,
      uploadedAt: new Date().toISOString(),
    });
    console.log('[Make] Webhook envoye avec succes');
  } catch (makeErr) {
    console.error('[Make] Erreur webhook :', makeErr.message);
  }

  const order = {
    orderId: req.body.orderId || `ORD-${Date.now()}`,
    clientName: clientName || null,
    clientEmail: clientEmail || null,
    formulaLabel: req.body.formulaLabel || 'Rapport expert',
    propertyType: propertyType || null,
    roomCount: roomCount || null,
    photoUrls: [cloudinaryUrl],
    isHabite: true,
    status: 'pending',
    createdAt: new Date().toISOString(),
    pdfUrl: null,
  };
  global.habitedOrders = global.habitedOrders || [];
  global.habitedOrders.push(order);

  res.json({
    success: true,
    photoUrl: cloudinaryUrl,
    message: 'Vos photos ont bien ete recues. Vous recevrez votre rapport sous 48 a 72h.',
  });
});

module.exports = router;
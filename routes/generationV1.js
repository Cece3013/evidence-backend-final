// backend/routes/generationV1.js
// Génération d'UNE photo de commande (production) avec le pipeline V1 validé.
// Le pipeline (pipelineVidesV1.js) est utilisé tel quel ; la fonction de
// génération d'image est une copie à l'identique de celle de testStagingV1.js
// (le fichier de test n'est pas modifié).
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const { buildPromptBienVideV1 } = require('./pipelineVidesV1');
const { createPage, lireTexte, lireReference } = require('./notionHelpers');

// ─── INTERRUPTEUR STYLE_VARIANT EN PRODUCTION ─────────────────────────────────
// false : génération avec le style du Noyau seul (comme avant STYLE_VARIANT).
// true  : la famille de la commande (colonne "Famille style") est appliquée.
// À passer à true après validation définitive de STYLE_VARIANT V2.
const STYLE_VARIANT_PRODUCTION_ACTIF = false;

// Même modèle que les tests ; modifiable depuis Railway (variable OPENAI_IMAGE_MODEL).
const MODELE_IMAGE = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';

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

// Copie à l'identique de genererImage() de testStagingV1.js
async function genererImage(prompt, imageUrl, model = MODELE_IMAGE) {
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
 * Génère l'image "Après" d'une photo "Avant" et la dépose dans Notion,
 * en attente de validation humaine.
 * Retourne { statut: 'GENERE', url, familleUtilisee } ou { statut: 'A_VERIFIER', raison }.
 * Lève une erreur en cas d'échec technique (le générateur gère les nouveaux essais).
 */
async function genererPhotoCommande(photoPage, clientPage) {
  const pp = photoPage.properties;
  const cp = clientPage.properties;

  const imageUrl = pp['URL photo']?.url;
  const roomType = pp['Pièce']?.select?.name;
  const choixCuisine = pp['Choix cuisine']?.select?.name || null;
  const famille = cp['Famille style']?.select?.name || null;
  if (!imageUrl || !roomType) throw new Error('Photo sans URL ou sans type de pièce.');

  // Contrôle photo déjà fait avant paiement : on le réutilise (pas de second contrôle)
  let controleDejaEffectue = null;
  try {
    const texte = lireTexte(pp['Contrôle photo']);
    if (texte) controleDejaEffectue = JSON.parse(texte);
  } catch {
    controleDejaEffectue = null; // illisible : le pipeline refera le contrôle
  }

  const parametres = {
    photoPrincipale: imageUrl,
    roomType,
    choixCuisine,
    utiliserStyleVariant: STYLE_VARIANT_PRODUCTION_ACTIF && Boolean(famille),
    familleForcee: famille,
    controleDejaEffectue,
  };

  let resultat = await buildPromptBienVideV1(parametres);

  // Cas rare : la classification cuisine demande un choix que le client n'a pas eu
  // à faire avant paiement → on applique la recommandation du pipeline.
  if (resultat.status === 'CHOIX_CUISINE_REQUIS') {
    console.log(`[GenerationV1] Choix cuisine absent → recommandation appliquée : ${resultat.recommandation}`);
    resultat = await buildPromptBienVideV1({ ...parametres, choixCuisine: resultat.recommandation });
  }

  if (resultat.status === 'PHOTO_A_REPRENDRE') {
    return { statut: 'A_VERIFIER', raison: resultat.raison || 'Photo refusée par le contrôle.' };
  }

  const generatedUrl = await genererImage(resultat.prompt, imageUrl);

  const clientName = cp['Nom du Client']?.title?.[0]?.plain_text || '—';
  const reference = lireReference(cp) || '—';

  const proprietes = {
    'Titre': { title: [{ text: { content: `${clientName} — ${roomType} — Après — ${reference}` } }] },
    'Nom du Client': { relation: [{ id: clientPage.id }] },
    'Type': { select: { name: 'Après' } },
    'URL photo': { url: generatedUrl },
    'Pièce': { select: { name: roomType } },
    'Statut': { select: { name: 'En attente' } },
    'Type de prestation': { select: { name: 'Bien vide' } },
    'Statut génération': { select: { name: 'Généré' } },
  };
  if (resultat.styleVariantId) {
    proprietes['Famille style'] = { select: { name: resultat.styleVariantId } };
  }

  await createPage(process.env.NOTION_PHOTOS_DATABASE_ID, proprietes);
  console.log(`[GenerationV1] Après créé — ${reference} — ${roomType}${resultat.styleVariantId ? ` — famille ${resultat.styleVariantId}` : ''}`);

  return { statut: 'GENERE', url: generatedUrl, familleUtilisee: resultat.styleVariantId || null };
}

module.exports = { genererPhotoCommande, STYLE_VARIANT_PRODUCTION_ACTIF };

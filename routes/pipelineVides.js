// backend/routes/pipelineVides.js
// Orchestrateur Biens vides : PROMPT A → PROMPT B → PROMPT C → synthèse
const axios = require('axios');

const { PROMPT_A_ANALYSE, PROMPT_B_IMPLANTATION, PROMPT_C_GENERATION } = require('./promptsAgentsVides');
const { NOYAU_BIEN_VIDE } = require('./globalRulesVides');
const roomPrompts = require('./roomPromptsVides');
const microModules = require('./microModulesVides');

const OPENAI_HEADERS = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Retourne une version allégée de l'image Cloudinary,
 * suffisante pour l'analyse et téléchargeable rapidement par OpenAI.
 * L'image originale reste utilisée pour la génération finale.
 */
function versionAllegee(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/w_1200,q_auto:good,f_jpg/');
}

/**
 * Appelle un modèle de vision avec un prompt et une ou plusieurs images.
 * Retourne l'objet JSON produit par le modèle.
 */
async function callVisionJSON(prompt, imageUrls, maxTokens = 2000) {
  const content = [{ type: 'text', text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: 'image_url', image_url: { url: versionAllegee(url) } });
  }

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    },
    { headers: OPENAI_HEADERS, timeout: 120000 }
  );

  const raw = res.data.choices[0].message.content;
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ─── ÉTAPE A — Analyse des photos ─────────────────────────────────────────────
async function etapeA(photoPrincipale, photosComplementaires = [], roomTypePressenti = '') {
  const contexte = roomTypePressenti
    ? `\n\nTYPE DE PIÈCE PRESSENTI PAR LE CLIENT : ${roomTypePressenti}`
    : '';

  const images = [photoPrincipale, ...photosComplementaires];
  const analyse = await callVisionJSON(PROMPT_A_ANALYSE + contexte, images);

  console.log(`[PipelineVides] A — statut: ${analyse.analysis_status} — suite: ${analyse.allow_next_step}`);
  return analyse;
}

// ─── ÉTAPE B — Décision d'implantation ────────────────────────────────────────
async function etapeB(analyseA, photoPrincipale, photosComplementaires = []) {
  const prompt = `${PROMPT_B_IMPLANTATION}

=== SORTIE DU PROMPT A ===
${JSON.stringify(analyseA, null, 2)}`;

  const images = [photoPrincipale, ...photosComplementaires];
  const implantation = await callVisionJSON(prompt, images, 3000);

  console.log(`[PipelineVides] B — verrouillage: ${implantation.locked_layout?.status} — prêt: ${implantation.generation_ready}`);
  return implantation;
}

// ─── SYNTHÈSE — Prompt d'exécution compact pour le générateur ─────────────────
async function synthetiser({ implantation, roomType, activeMicroModules = [], commentaireClient }) {
  const modulePiece = roomPrompts[roomType];
  if (!modulePiece) {
    throw new Error(`Module de pièce introuvable : ${roomType}`);
  }

  const microTexts = activeMicroModules
    .map((k) => microModules[k])
    .filter(Boolean);

  const instructions = `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : produire UN SEUL prompt d'exécution compact destiné au modèle gpt-image-2 (API d'édition d'image), à partir de la documentation ci-dessous.

CONTRAINTES DE SORTIE :
- Entre 2000 et 3000 caractères maximum. Cette limite est stricte.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré selon la hiérarchie suivante, dans cet ordre :
  PRIORITÉ 1 — architecture, éléments fixes et point de vue : à préserver intégralement.
  PRIORITÉ 2 — implantation verrouillée : reproduire exactement les meubles, emplacements et orientations décidés. Ne jamais recalculer l'implantation.
  PRIORITÉ 3 — mobilier résiduel : appliquer les décisions KEEP / REMOVE indiquées.
  PRIORITÉ 4 — circulations et fonctionnalité de la pièce.
  PRIORITÉ 5 — style, matières, lumière et ambiance.
- Nomme explicitement chaque meuble de l'implantation verrouillée avec sa position.
- N'inclus jamais un meuble marqué "out_of_frame" dans l'image générée.
- N'invente aucun élément absent de la documentation.
- Termine par une ligne courte sur le rendu attendu : photoréaliste, lumière naturelle préservée, cadrage identique à la photo d'origine.

RÈGLES IMPÉRATIVES À REPRENDRE EXPLICITEMENT :
1. Ne jamais modifier l'architecture, les ouvertures, les murs, les sols ou les plafonds.
2. Ne jamais déplacer le point de vue ni recadrer l'image.
3. Ne jamais fusionner plusieurs angles de vue.
4. Respecter strictement l'implantation verrouillée sans la réinterpréter.

Réponds UNIQUEMENT avec le texte du prompt final, sans guillemets, sans titre, sans commentaire.

=== IMPLANTATION VERROUILLÉE ===
${JSON.stringify(implantation.locked_layout, null, 2)}

=== CONTRAINTES SPATIALES ===
${JSON.stringify(implantation.spatial_constraints || {}, null, 2)}

=== DÉCISIONS SUR LE MOBILIER RÉSIDUEL ===
${JSON.stringify(implantation.residual_furniture_decisions || [], null, 2)}

=== CONTRAINTES DE GÉNÉRATION ===
${JSON.stringify(implantation.generation_constraints || {}, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À intégrer si compatible avec l'implantation verrouillée.)` : ''}

=== RÈGLES DE GÉNÉRATION (référence) ===
${PROMPT_C_GENERATION}

=== NOYAU BIEN VIDE (référence) ===
${NOYAU_BIEN_VIDE}

=== MODULE DE LA PIÈCE : ${roomType} (référence) ===
${modulePiece}

${microTexts.length ? '=== MICRO-MODULES ACTIVÉS ===\n' + microTexts.join('\n\n') : ''}`;

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 1600,
        messages: [{ role: 'user', content: instructions }],
      },
      { headers: OPENAI_HEADERS, timeout: 90000 }
    );

    const prompt = res.data.choices[0].message.content.trim();
    console.log(`[PipelineVides] Synthèse — prompt final: ${prompt.length} caractères`);
    return prompt;
  } catch (err) {
    console.error('[PipelineVides] Erreur synthèse:', err.response?.data || err.message);
    throw new Error('Impossible de préparer le prompt de génération.');
  }
}

/**
 * Exécute la chaîne complète A → B → C.
 * Retourne soit un prompt prêt à générer, soit une demande de photos complémentaires.
 */
async function buildPromptBienVide({
  photoPrincipale,
  photosComplementaires = [],
  roomType,
  activeMicroModules = [],
  commentaireClient = '',
}) {
  // ── A ──
  const analyseA = await etapeA(photoPrincipale, photosComplementaires, roomType);

  if (analyseA.allow_next_step === false) {
    const demandes = (analyseA.missing_views || [])
      .filter((v) => v.needed)
      .map((v) => v.request)
      .filter(Boolean);

    return {
      status: 'PHOTOS_INSUFFISANTES',
      etape: 'A',
      raison: analyseA.analysis_status,
      demandes,
      analyse: analyseA,
    };
  }

  // ── B ──
  const implantation = await etapeB(analyseA, photoPrincipale, photosComplementaires);

  if (implantation.locked_layout?.status !== 'LOCKED' || implantation.generation_ready !== true) {
    const demande = implantation.additional_photo_request?.request || '';
    return {
      status: implantation.locked_layout?.status === 'NEEDS_MORE_INFORMATION'
        ? 'PHOTOS_INSUFFISANTES'
        : 'IMPLANTATION_IMPOSSIBLE',
      etape: 'B',
      raison: implantation.locked_layout?.status,
      demandes: demande ? [demande] : [],
      analyse: analyseA,
      implantation,
    };
  }

  // ── C (synthèse) ──
  const prompt = await synthetiser({
    implantation,
    roomType,
    activeMicroModules,
    commentaireClient,
  });

  return {
    status: 'PRET',
    prompt,
    analyse: analyseA,
    implantation,
  };
}

module.exports = { buildPromptBienVide };

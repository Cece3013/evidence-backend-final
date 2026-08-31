// backend/routes/pipelineVides.js
// Orchestrateur Biens vides : PROMPT A → PROMPT B → PROMPT C
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
    content.push({ type: 'image_url', image_url: { url } });
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

// ─── ÉTAPE C — Génération de l'image ──────────────────────────────────────────
async function etapeC({ photoPrincipale, implantation, roomType, activeMicroModules = [], commentaireClient }) {
  const modulePiece = roomPrompts[roomType];
  if (!modulePiece) {
    throw new Error(`Module de pièce introuvable : ${roomType}`);
  }

  const microTexts = activeMicroModules
    .map((k) => microModules[k])
    .filter(Boolean);

  const promptFinal = `${PROMPT_C_GENERATION}

=== NOYAU_BIEN_VIDE ===
${NOYAU_BIEN_VIDE}

=== MODULE_PIECE ===
${modulePiece}

=== ACTIVE_MICRO_MODULES ===
${microTexts.length ? microTexts.join('\n\n') : 'Aucun micro-module activé.'}

=== LOCKED_LAYOUT ===
${JSON.stringify(implantation.locked_layout, null, 2)}

=== SPATIAL_CONSTRAINTS ===
${JSON.stringify(implantation.spatial_constraints || {}, null, 2)}

=== RESIDUAL_FURNITURE_DECISIONS ===
${JSON.stringify(implantation.residual_furniture_decisions || [], null, 2)}

=== GENERATION_CONSTRAINTS ===
${JSON.stringify(implantation.generation_constraints || {}, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À respecter si compatible avec l'implantation verrouillée et les règles du noyau.)` : ''}`;

  console.log(`[PipelineVides] C — prompt final: ${promptFinal.length} caractères`);
  return promptFinal;
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

  // ── C ──
  const prompt = await etapeC({
    photoPrincipale,
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

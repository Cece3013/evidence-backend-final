// Pipeline V1 — Biens vides
// Architecture officielle validée (voir ETAT-DES-LIEUX pour la comparaison
// avec l'ancienne branche archivée) :
//   photo principale → Contrôle Photo V2 → (si Cuisine : classification
//   cuisine séparée) → Noyau V3 + Module → génération.
// Aucune étape de synthèse ni de compression : le prompt final est la
// concaténation stricte du Noyau et du Module, transmis tels quels.
// N'importe ni ne dépend du pipeline archivé (pipelineVides.js).

const axios = require('axios');
const { CONTROLE_PHOTO_V2, CLASSIFICATION_CUISINE } = require('./controlePhotoV2');
const { NOYAU_EVIDENCE_V3 } = require('./noyauVideV3');
const MODULES_VIDE_V3 = require('./modulesVideV3');

const OPENAI_HEADERS = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

// Même modèle d'analyse que la branche archivée, configurable depuis Railway.
const MODELE_ANALYSE = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

function limiteTokens(nb) {
  const ancienModele = /^(gpt-4|gpt-3)/.test(MODELE_ANALYSE);
  return ancienModele ? { max_tokens: nb } : { max_completion_tokens: nb };
}

function versionAllegee(url) {
  if (typeof url !== 'string' || !url) return null;
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/w_1200,q_auto:good,f_jpg/');
}

async function appelVisionJSON(prompt, photoPrincipale, maxTokens = 800) {
  const urlValide = versionAllegee(photoPrincipale);
  if (!urlValide) {
    throw new Error('Photo principale invalide.');
  }

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: urlValide } },
  ];

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: MODELE_ANALYSE,
      ...limiteTokens(maxTokens),
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    },
    { headers: OPENAI_HEADERS, timeout: 90000 }
  );

  const raw = res.data.choices[0].message.content;
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ─── CONTRÔLE PHOTO V2 — responsabilité unique : photo suffisante ou non ──────
async function controlePhoto(photoPrincipale) {
  const resultat = await appelVisionJSON(CONTROLE_PHOTO_V2, photoPrincipale, 500);
  console.log(`[PipelineVidesV1] Contrôle photo — statut: ${resultat.status}`);
  return resultat;
}

// ─── CLASSIFICATION CUISINE — séparée, appelée uniquement si pertinent ────────
async function classifierCuisine(photoPrincipale) {
  const resultat = await appelVisionJSON(CLASSIFICATION_CUISINE, photoPrincipale, 300);
  console.log(`[PipelineVidesV1] Classification cuisine — statut: ${resultat.status}`);
  return resultat;
}

// Textes à ajouter selon le choix utilisateur pour une cuisine existante.
// Reprennent mot pour mot les descriptions UX fournies (section 10).
const CHOIX_CUISINE_TEXTE = {
  valorisation_douce:
    "NIVEAU DE TRANSFORMATION CHOISI PAR LE CLIENT : Valorisation douce — Moderniser légèrement l'existant : désencombrement, harmonisation et rafraîchissement, tout en conservant fortement l'aspect actuel de la cuisine.",
  projection_modernisee:
    "NIVEAU DE TRANSFORMATION CHOISI PAR LE CLIENT : Projection modernisée — Montrer le potentiel d'une cuisine plus actuelle : modernisation cohérente des façades, du plan de travail, de la crédence et des murs, en conservant l'implantation et les contraintes réelles.",
};

const OPTIONS_CUISINE = [
  {
    id: 'valorisation_douce',
    label:
      "Moderniser légèrement l'existant : désencombrement, harmonisation et rafraîchissement, tout en conservant fortement l'aspect actuel de la cuisine.",
  },
  {
    id: 'projection_modernisee',
    label:
      "Montrer le potentiel d'une cuisine plus actuelle : modernisation cohérente des façades, du plan de travail, de la crédence et des murs, en conservant l'implantation et les contraintes réelles.",
  },
];

// États de classification cuisine qui nécessitent un choix utilisateur avant
// génération (les deux états "existante" — présentable ou datée).
const ETATS_CUISINE_AVEC_CHOIX = ['CUISINE_EXISTANTE_PRESENTABLE', 'CUISINE_EXISTANTE_DATEE'];

// ─── ASSEMBLAGE — Noyau + Module, sans synthèse ni compression ────────────────
function construirePromptV1({ roomType, choixCuisine }) {
  const module = MODULES_VIDE_V3[roomType];
  if (!module) {
    throw new Error(`Module V3 introuvable pour le type de pièce : ${roomType}`);
  }

  const blocChoix =
    roomType === 'cuisine' && choixCuisine && CHOIX_CUISINE_TEXTE[choixCuisine]
      ? '\n\n' + CHOIX_CUISINE_TEXTE[choixCuisine]
      : '';

  return [NOYAU_EVIDENCE_V3, '', module, blocChoix].join('\n');
}

/**
 * Point d'entrée du pipeline V1.
 *
 * Retourne l'un de ces trois statuts :
 * - { status: 'PHOTO_A_REPRENDRE', raison, retakeInstruction, controle }
 *   → la photo doit être reprise ; la nouvelle photo remplace l'ancienne.
 * - { status: 'CHOIX_CUISINE_REQUIS', classificationCuisine, recommandation, options }
 *   → cuisine existante (présentable ou datée) : l'application doit
 *     proposer les 2 niveaux de transformation avant de rappeler cette
 *     fonction avec `choixCuisine` renseigné.
 * - { status: 'PRET', prompt, controle, classificationCuisine }
 *   → prompt final assemblé, prêt pour l'appel de génération d'image.
 */
async function buildPromptBienVideV1({ photoPrincipale, roomType, choixCuisine = null }) {
  const controle = await controlePhoto(photoPrincipale);

  if (!controle.allow_generation) {
    return {
      status: 'PHOTO_A_REPRENDRE',
      raison: controle.reason,
      retakeInstruction: controle.retake_instruction,
      controle,
    };
  }

  let classificationCuisine = null;
  if (roomType === 'cuisine') {
    classificationCuisine = await classifierCuisine(photoPrincipale);

    if (ETATS_CUISINE_AVEC_CHOIX.includes(classificationCuisine.status) && !choixCuisine) {
      const recommandation =
        classificationCuisine.status === 'CUISINE_EXISTANTE_PRESENTABLE'
          ? 'valorisation_douce'
          : 'projection_modernisee';

      return {
        status: 'CHOIX_CUISINE_REQUIS',
        classificationCuisine,
        recommandation,
        options: OPTIONS_CUISINE,
      };
    }
  }

  const prompt = construirePromptV1({ roomType, choixCuisine });

  return {
    status: 'PRET',
    prompt,
    controle,
    classificationCuisine,
  };
}

module.exports = { buildPromptBienVideV1, controlePhoto, classifierCuisine };

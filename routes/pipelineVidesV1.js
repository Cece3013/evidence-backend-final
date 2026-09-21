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
const {
  LECTURE_FONCTIONNELLE_SALON_SAM,
  LECTURE_FONCTIONNELLE_SALON,
  LECTURE_FONCTIONNELLE_SALON_SAM_RENFORCEE,
  LECTURE_RENFORCEE_SALON_SAM_ACTIVE,
  ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE,
} = require('./lectureFonctionnelleV1');
const { INSTRUCTION_GUIDE_VISUEL } = require('./guideVisuelV1');
const { ROOM_TYPES_AVEC_STYLE_VARIANT, construireStyleVariant } = require('./styleVariantV1');

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

  // Contrainte technique de l'API OpenAI : avec response_format "json_object",
  // le mot "JSON" doit apparaître dans le message envoyé. Ajouté ici, au
  // niveau de l'appel, jamais dans le texte des prompts stockés (Contrôle
  // Photo V2, classification cuisine) qui restent inchangés.
  const promptAvecRappelJSON = `${prompt}\n\n(Réponds uniquement avec le JSON demandé ci-dessus, sans texte autour.)`;

  const content = [
    { type: 'text', text: promptAvecRappelJSON },
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

// ─── LECTURE FONCTIONNELLE — appel en texte libre, pas de JSON ───────────────
// Sortie en langage naturel uniquement : pas de response_format json_object
// ici, donc pas de contrainte "le mot JSON doit apparaître".
async function appelVisionTexte(prompt, photoPrincipale, maxTokens = 400) {
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
      messages: [{ role: 'user', content }],
    },
    { headers: OPENAI_HEADERS, timeout: 90000 }
  );

  return res.data.choices[0].message.content.trim();
}

// ─── CONTRÔLE PHOTO V2 — responsabilité unique : photo suffisante ou non ──────
async function controlePhoto(photoPrincipale) {
  const resultat = await appelVisionJSON(CONTROLE_PHOTO_V2, photoPrincipale, 500);
  console.log(`[PipelineVidesV1] Contrôle photo — statut: ${resultat.status}`);
  return resultat;
}

// ─── LECTURE FONCTIONNELLE — uniquement salon et salon_salle_a_manger ────────
// Ajoutée entre le Contrôle Photo V2 et l'assemblage du prompt final, sur
// demande explicite, pour pallier un zonage fonctionnel mal exploité sur les
// pièces à deux fonctions. Ne réintroduit aucun système géométrique — texte
// libre uniquement. Retourne null pour tout autre type de pièce : aucun
// changement de comportement ailleurs.
async function lireFonctionnellement(photoPrincipale, roomType) {
  if (!ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE.includes(roomType)) {
    return null;
  }

  let prompt;
  if (roomType === 'salon_salle_a_manger') {
    prompt = LECTURE_RENFORCEE_SALON_SAM_ACTIVE
      ? LECTURE_FONCTIONNELLE_SALON_SAM_RENFORCEE
      : LECTURE_FONCTIONNELLE_SALON_SAM;
  } else {
    prompt = LECTURE_FONCTIONNELLE_SALON;
  }

  const lecture = await appelVisionTexte(prompt, photoPrincipale, 500);
  console.log(`[PipelineVidesV1] Lecture fonctionnelle (${roomType}${roomType === 'salon_salle_a_manger' && LECTURE_RENFORCEE_SALON_SAM_ACTIVE ? ', renforcée' : ''}) — ${lecture.slice(0, 80)}...`);
  return lecture;
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

// ─── ASSEMBLAGE — Noyau + Module (+ Lecture Fonctionnelle OU Guide Visuel) ────
function construirePromptV1({ roomType, choixCuisine, lectureFonctionnelle, utiliserGuideVisuel, styleVariantTexte }) {
  const module = MODULES_VIDE_V3[roomType];
  if (!module) {
    throw new Error(`Module V3 introuvable pour le type de pièce : ${roomType}`);
  }

  // PROTOTYPE Guide Visuel : remplace la lecture fonctionnelle par l'instruction
  // du guide, uniquement quand explicitement demandé (salon_salle_a_manger +
  // guide fourni). N'affecte aucun autre cas.
  const blocLecture = utiliserGuideVisuel
    ? '\n' + INSTRUCTION_GUIDE_VISUEL
    : lectureFonctionnelle
    ? '\n' + lectureFonctionnelle
    : '';

  const blocChoix =
    roomType === 'cuisine' && choixCuisine && CHOIX_CUISINE_TEXTE[choixCuisine]
      ? '\n\n' + CHOIX_CUISINE_TEXTE[choixCuisine]
      : '';

  // TEST A/B STYLE_VARIANT : ajouté APRÈS tout le reste, sans rien y
  // toucher. N'affecte que salon et salon_salle_a_manger, et uniquement
  // quand explicitement demandé pour ce test.
  const blocStyle = styleVariantTexte ? '\n\n' + styleVariantTexte : '';

  return [NOYAU_EVIDENCE_V3, '', module, blocLecture, blocChoix, blocStyle].join('\n');
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
async function buildPromptBienVideV1({
  photoPrincipale,
  roomType,
  choixCuisine = null,
  utiliserGuideVisuel = false,
  utiliserStyleVariant = false,
}) {
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

  // PROTOTYPE Guide Visuel : quand actif, la lecture fonctionnelle textuelle
  // n'est PAS appelée du tout (pour isoler l'effet du guide, comme demandé) ;
  // construirePromptV1 utilise l'instruction du guide à la place.
  const lectureFonctionnelle = utiliserGuideVisuel ? null : await lireFonctionnellement(photoPrincipale, roomType);

  // TEST A/B STYLE_VARIANT : uniquement salon / salon_salle_a_manger, et
  // uniquement si explicitement demandé pour cet appel (permet de comparer
  // A — sans STYLE_VARIANT — et B — avec — sur les mêmes photos).
  let styleVariantId = null;
  let styleVariantTexte = null;
  if (utiliserStyleVariant && ROOM_TYPES_AVEC_STYLE_VARIANT.includes(roomType)) {
    const style = construireStyleVariant();
    styleVariantId = style.id;
    styleVariantTexte = style.texte;
  }

  const prompt = construirePromptV1({ roomType, choixCuisine, lectureFonctionnelle, utiliserGuideVisuel, styleVariantTexte });

  return {
    status: 'PRET',
    prompt,
    controle,
    classificationCuisine,
    lectureFonctionnelle,
    styleVariantId,
  };
}

module.exports = { buildPromptBienVideV1, controlePhoto, classifierCuisine };

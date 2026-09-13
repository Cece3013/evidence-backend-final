// backend/routes/pipelineVides.js
// Orchestrateur Biens vides : PROMPT A → PROMPT B → synthèse → génération
const axios = require('axios');

const { PROMPT_A_ANALYSE, PROMPT_B_IMPLANTATION, PROMPT_C_GENERATION } = require('./promptsAgentsVides');
const { PROMPT_D_CONTROLE } = require('./promptsControleVides');
const { NOYAU_BIEN_VIDE } = require('./globalRulesVides');
const roomPrompts = require('./roomPromptsVides');
const microModules = require('./microModulesVides');

const OPENAI_HEADERS = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

// Modèle d'analyse spatiale — configurable depuis Railway (OPENAI_VISION_MODEL)
const MODELE_ANALYSE = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

/**
 * Les modèles récents (GPT-5 et suivants) attendent 'max_completion_tokens'
 * là où les modèles plus anciens utilisent 'max_tokens'.
 */
function limiteTokens(nb) {
  const ancienModele = /^(gpt-4|gpt-3)/.test(MODELE_ANALYSE);
  return ancienModele ? { max_tokens: nb } : { max_completion_tokens: nb };
}

/**
 * Version allégée de l'image Cloudinary pour l'analyse.
 * L'image originale reste utilisée pour la génération finale.
 */
function versionAllegee(url) {
  if (typeof url !== 'string' || !url) return null;
  if (!url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/w_1200,q_auto:good,f_jpg/');
}

async function callVisionJSON(prompt, imageUrls, maxTokens = 2000) {
  const content = [{ type: 'text', text: prompt }];

  const urlsValides = imageUrls.map(versionAllegee).filter(Boolean);
  if (!urlsValides.length) {
    throw new Error('Aucune image valide à analyser.');
  }
  for (const url of urlsValides) {
    content.push({ type: 'image_url', image_url: { url } });
  }

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: MODELE_ANALYSE,
      ...limiteTokens(maxTokens),
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
  console.log('[PipelineVides] A — JSON complet:', JSON.stringify(analyse));
  return analyse;
}

// ─── ÉTAPE B — Décision d'implantation ────────────────────────────────────────
async function etapeB(analyseA, photoPrincipale, photosComplementaires = [], activeMicroModules = [], correctionValidateur = '') {
  const microTexts = activeMicroModules
    .map((k) => microModules[k])
    .filter(Boolean);

  let blocMicros = '';
  if (microTexts.length) {
    const entete = [
      '',
      '=== BESOINS COMPLEMENTAIRES VALIDES PAR LE CLIENT ===',
      `Le client a explicitement demandé que cette pièce intègre ${microTexts.length} fonction(s) supplémentaire(s) en plus de sa fonction principale.`,
      '',
      'METHODE OBLIGATOIRE :',
      'Cette pièce doit être traitée comme un espace MULTIFONCTION.',
      "Avant de verrouiller, découper l'espace disponible en autant de zones fonctionnelles",
      'distinctes que nécessaire, et renseigner chacune dans "usable_zones".',
      'Ne pas se limiter à une seule zone centrale.',
      '',
      'Chaque zone doit recevoir son mobilier propre, et TOUT ce mobilier doit figurer',
      'dans "primary_furniture" avec son emplacement et son orientation.',
      'Ne pas reléguer ces meubles dans "secondary_furniture_allowed".',
      '',
      'Exemple de découpage attendu pour un salon avec coin repas :',
      'zone_1 = coin salon (canapé, table basse) ;',
      'zone_2 = coin repas (table à manger, chaises).',
      '',
      'Si une fonction demandée ne peut réellement pas tenir dans la pièce sans bloquer',
      'une circulation ou une ouverture, ne pas verrouiller et expliquer précisément',
      'le blocage dans "layout_options_considered".',
      '',
    ].join('\n');

    blocMicros = entete + microTexts.join('\n\n');
  }

  const blocCorrection = correctionValidateur
    ? [
        '',
        '=== CORRECTION OBLIGATOIRE — VALIDATEUR DE COHÉRENCE GÉOMÉTRIQUE ===',
        'Ta précédente proposition a été rejetée AVANT verrouillage par un contrôle automatique déterministe (pas une simple relecture). Corrige strictement les points suivants, sans changer le reste de ton analyse si elle était par ailleurs cohérente :',
        correctionValidateur,
        '',
      ].join('\n')
    : '';

  const prompt = [
    PROMPT_B_IMPLANTATION,
    '',
    '=== SORTIE DU PROMPT A ===',
    JSON.stringify(analyseA, null, 2),
    blocMicros,
    blocCorrection,
  ].join('\n');

  const images = [photoPrincipale, ...photosComplementaires];
  // Limite augmentée de 3000 à 6000 : le Prompt B enrichi (référentiel spatial,
  // visibilité par élément, contrôle de cohérence) produit un JSON plus long.
  // 3000 provoquait une troncature en cours de génération ("Unterminated string in JSON").
  const implantation = await callVisionJSON(prompt, images, 6000);

  console.log(`[PipelineVides] B — verrouillage: ${implantation.locked_layout?.status} — prêt: ${implantation.generation_ready} — besoins: ${activeMicroModules.join(', ') || 'aucun'}`);
  console.log('[PipelineVides] B — JSON complet:', JSON.stringify(implantation));
  return implantation;
}

// ─── VALIDATEUR DÉTERMINISTE — Cohérence géométrique du LOCKED_LAYOUT ─────────
/**
 * Contrôle en code, pas en prompt : s'exécute après etapeB(), avant toute
 * synthèse ou génération. Ne dépend d'aucune bonne volonté du modèle de
 * langage — vérifie mécaniquement les incohérences structurelles qui ont causé
 * l'inversion canapé/TV constatée sur 8/8 générations (PF1 et PF3 tous deux
 * ancrés sur W1 tout en étant déclarés "face à face").
 * Retourne { valide, erreurs } — erreurs est un tableau de messages précis,
 * exploitables tels quels comme correction à renvoyer à B.
 */
function validerCoherenceGeometrique(implantation) {
  const erreurs = [];
  const layout = implantation.locked_layout || {};
  const meubles = layout.primary_furniture || [];
  const relations = layout.functional_relationships || [];
  const murs = (implantation.spatial_reference && implantation.spatial_reference.walls) || [];
  const zonesUtilisables = (implantation.usable_zones || []).map((z) => z.zone_id);

  const mapMurs = {};
  murs.forEach((w) => { mapMurs[w.id] = w; });
  const mapMeubles = {};
  meubles.forEach((m) => { mapMeubles[m.item_id] = m; });
  const idsMeubles = meubles.map((m) => m.item_id);

  // 1 — Intégrité référentielle : chaque champ structuré doit pointer vers
  // quelque chose qui existe réellement ailleurs dans le même JSON.
  meubles.forEach((m) => {
    if (m.floor_zone && !zonesUtilisables.includes(m.floor_zone)) {
      erreurs.push(
        `${m.item_id} : floor_zone "${m.floor_zone}" ne correspond à aucune zone déclarée dans usable_zones.`
      );
    }
    if (m.support_anchor && m.support_anchor !== 'NONE' && !mapMurs[m.support_anchor]) {
      erreurs.push(
        `${m.item_id} : support_anchor "${m.support_anchor}" ne correspond à aucun mur déclaré dans spatial_reference.walls.`
      );
    }
    if (
      m.orientation_target &&
      m.orientation_target !== 'NONE' &&
      !idsMeubles.includes(m.orientation_target) &&
      !mapMurs[m.orientation_target]
    ) {
      erreurs.push(
        `${m.item_id} : orientation_target "${m.orientation_target}" ne correspond à aucun meuble ni mur connu.`
      );
    }
  });

  // 2 — Règle face_to_face : jamais le même support_anchor ; si deux murs
  // différents, ils doivent être mutuellement déclarés opposés.
  relations
    .filter((r) => r.relationship_type === 'face_to_face')
    .forEach((r) => {
      const a = mapMeubles[r.from_item];
      const b = mapMeubles[r.to_item];
      if (!a || !b) {
        erreurs.push(
          `Relation face_to_face entre "${r.from_item}" et "${r.to_item}" : au moins un des deux meubles est introuvable dans primary_furniture.`
        );
        return;
      }
      const ancrageA = a.support_anchor;
      const ancrageB = b.support_anchor;
      if (ancrageA && ancrageB && ancrageA !== 'NONE' && ancrageB !== 'NONE') {
        if (ancrageA === ancrageB) {
          erreurs.push(
            `${a.item_id} et ${b.item_id} sont déclarés "face_to_face" mais partagent le même support_anchor ("${ancrageA}") — deux meubles sur le même mur sont côte à côte, jamais face à face. L'un des deux doit changer de mur ou devenir flottant ("support_anchor": "NONE").`
          );
        } else {
          const murA = mapMurs[ancrageA];
          const murB = mapMurs[ancrageB];
          const compatible =
            (murA && murA.opposite_wall_id === ancrageB) || (murB && murB.opposite_wall_id === ancrageA);
          if (!compatible) {
            erreurs.push(
              `${a.item_id} (mur ${ancrageA}) et ${b.item_id} (mur ${ancrageB}) sont déclarés "face_to_face" mais ces deux murs ne sont pas mutuellement déclarés opposés (opposite_wall_id). Renseigner cette compatibilité si elle est réelle, sinon rendre l'un des deux meubles flottant ("support_anchor": "NONE").`
            );
          }
        }
      }
      if (a.orientation_target && a.orientation_target !== 'NONE' && a.orientation_target !== b.item_id) {
        erreurs.push(
          `${a.item_id} : orientation_target devrait valoir "${b.item_id}" (relation face_to_face déclarée), mais vaut "${a.orientation_target}".`
        );
      }
      if (b.orientation_target && b.orientation_target !== 'NONE' && b.orientation_target !== a.item_id) {
        erreurs.push(
          `${b.item_id} : orientation_target devrait valoir "${a.item_id}" (relation face_to_face déclarée), mais vaut "${b.orientation_target}".`
        );
      }
    });

  // 3 — Enveloppe repas : une table et les chaises qui l'entourent
  // ("surrounds") doivent partager la même floor_zone — un ensemble
  // table/chaises réparti sur deux zones différentes n'est pas cohérent.
  relations
    .filter((r) => r.relationship_type === 'surrounds')
    .forEach((r) => {
      const item1 = mapMeubles[r.from_item];
      const item2 = mapMeubles[r.to_item];
      if (item1 && item2 && item1.floor_zone && item2.floor_zone && item1.floor_zone !== item2.floor_zone) {
        erreurs.push(
          `${item1.item_id} et ${item2.item_id} sont liés par "surrounds" mais n'ont pas la même floor_zone ("${item1.floor_zone}" vs "${item2.floor_zone}") — l'ensemble doit rester dans une seule zone cohérente.`
        );
      }
    });

  return { valide: erreurs.length === 0, erreurs };
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

  const regleMicro = microTexts.length
    ? "5. Les besoins complémentaires validés par le client doivent apparaître visiblement dans l'image générée."
    : '';

  const blocCommentaire = commentaireClient
    ? [
        '',
        '=== DEMANDE PARTICULIERE DU CLIENT ===',
        commentaireClient,
        "(À intégrer si compatible avec l'implantation verrouillée.)",
      ].join('\n')
    : '';

  const blocMicros = microTexts.length
    ? ['', '=== BESOINS COMPLEMENTAIRES VALIDES PAR LE CLIENT ===', microTexts.join('\n\n')].join('\n')
    : '';

  const instructions = [
    "Tu es un ingénieur prompt spécialisé en génération d'image immobilière.",
    '',
    "Ta mission : produire UN SEUL prompt d'exécution compact destiné au modèle gpt-image-2 (API d'édition d'image), à partir de la documentation ci-dessous.",
    '',
    'CONTRAINTES DE SORTIE :',
    '- Entre 2000 et 3000 caractères maximum. Cette limite est stricte.',
    "- Rédigé en français, à l'impératif, en instructions directes.",
    '- Structuré selon la hiérarchie suivante, dans cet ordre :',
    '  PRIORITE 1 — architecture, éléments fixes et point de vue : à préserver intégralement.',
    "  PRIORITE 2 — implantation verrouillée : reproduire exactement les meubles, emplacements et orientations décidés. Ne jamais recalculer l'implantation.",
    '  PRIORITE 3 — mobilier résiduel : appliquer les décisions KEEP / REMOVE indiquées.',
    '  PRIORITE 4 — circulations et fonctionnalité de la pièce.',
    '  PRIORITE 5 — style, matières, lumière et ambiance.',
    "- Nomme explicitement chaque meuble de l'implantation verrouillée avec sa position.",
    '- N\'inclus jamais un meuble marqué "out_of_frame" dans l\'image générée.',
    "- N'invente aucun élément absent de la documentation.",
    "- INTERDICTION ABSOLUE de recopier tel quel un code du référentiel spatial (W1, W2, O1, O2, C1, UZ1, FZ1, etc.) dans le texte final. Ces codes sont un outil interne de raisonnement ; gpt-image-2 ne les connaît pas et ne peut rien en faire. Pour chaque position, retrouve la description physique du mur/ouverture/zone concerné dans la section RÉFÉRENTIEL SPATIAL ci-dessous, et utilise CETTE description concrète et directement identifiable sur la photo (ex. \"contre le mur plein à gauche de la baie vitrée\" au lieu de \"contre W2\", \"à droite du placard, avant la porte\" au lieu de \"sur W4 entre O3 et O2\").",
    "- RÈGLE CRITIQUE SUR LES ÉLÉMENTS HORS CHAMP (strictly_out_of_frame dans main_photo_visibility) : ne JAMAIS les décrire en détail dans le corps du prompt (pas de position, pas de description physique, pas de phrase du type \"la porte blanche sur le mur droit\"). Les détailler augmente paradoxalement le risque que gpt-image-2 essaie de les représenter. Se contenter de les citer par leur nom simple dans UNE SEULE ligne négative et compacte, en toute fin de PRIORITE 1, sous la forme : \"NE JAMAIS AFFICHER, même partiellement : [liste des noms courts séparés par des virgules].\" Aucune autre mention de ces éléments ailleurs dans le texte.",
    "- Termine par une ligne courte sur le rendu attendu : photoréaliste, lumière naturelle préservée, cadrage identique à la photo d'origine.",
    '',
    'REGLES IMPERATIVES A REPRENDRE EXPLICITEMENT :',
    "1. Ne jamais modifier l'architecture, les ouvertures, les murs, les sols ou les plafonds.",
    '2. Ne jamais déplacer le point de vue ni recadrer l\'image.',
    '3. Ne jamais fusionner plusieurs angles de vue.',
    "4. Respecter strictement l'implantation verrouillée sans la réinterpréter.",
    "5. Ne jamais écrire un identifiant de référentiel (W, O, C, UZ, FZ suivi d'un chiffre) dans le texte final : toujours sa traduction physique concrète.",
    "6. Ne jamais décrire un élément hors champ ailleurs que dans l'unique ligne négative compacte prévue à cet effet.",
    regleMicro,
    '',
    'Réponds UNIQUEMENT avec le texte du prompt final, sans guillemets, sans titre, sans commentaire.',
    '',
    '=== RÉFÉRENTIEL SPATIAL (à utiliser pour traduire chaque code en description physique concrète — ne jamais recopier les identifiants eux-mêmes) ===',
    JSON.stringify(implantation.spatial_reference || {}, null, 2),
    '',
    '=== IMPLANTATION VERROUILLEE ===',
    JSON.stringify(implantation.locked_layout, null, 2),
    '',
    '=== CONTRAINTES SPATIALES ===',
    JSON.stringify(implantation.spatial_constraints || {}, null, 2),
    '',
    '=== DECISIONS SUR LE MOBILIER RESIDUEL ===',
    JSON.stringify(implantation.residual_furniture_decisions || [], null, 2),
    '',
    '=== CONTRAINTES DE GENERATION ===',
    JSON.stringify(implantation.generation_constraints || {}, null, 2),
    '',
    '=== VISIBILITÉ DEPUIS LA PHOTO PRINCIPALE (utiliser strictly_out_of_frame pour la ligne négative compacte) ===',
    JSON.stringify(implantation.main_photo_visibility || {}, null, 2),
    blocCommentaire,
    '',
    '=== REGLES DE GENERATION (reference) ===',
    PROMPT_C_GENERATION,
    '',
    '=== NOYAU BIEN VIDE (reference) ===',
    NOYAU_BIEN_VIDE,
    '',
    `=== MODULE DE LA PIECE : ${roomType} (reference) ===`,
    modulePiece,
    blocMicros,
  ].join('\n');

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: MODELE_ANALYSE,
        ...limiteTokens(1600),
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

// ─── CONTRÔLE — Vérification post-génération ──────────────────────────────────
/**
 * Compare la photo d'origine, l'image générée et l'implantation verrouillée.
 * Appelée par la route APRÈS genererImage(), AVANT tout envoi vers
 * Cloudinary/Notion pour validation par l'équipe.
 */
// ─── RÉSOLUTION DES CODES EN DESCRIPTIONS PHYSIQUES — pour le contrôle ────────
/**
 * Transforme le mobilier principal en une structure où chaque code interne
 * (support_anchor, floor_zone, orientation_target) est accompagné de sa
 * description physique concrète, résolue ici en code — pas laissée à la
 * charge du modèle de vision. Le Prompt D doit juger sur ces descriptions,
 * les identifiants ne restant que des métadonnées de traçabilité. Corrige le
 * faux positif constaté : le contrôle confondait des murs en raisonnant sur
 * les codes bruts (W2/W3) sans repasser par leur description.
 */
function resoudreDescriptionsPourControle(implantation) {
  const murs = (implantation.spatial_reference && implantation.spatial_reference.walls) || [];
  const zones = implantation.usable_zones || [];
  const meubles = (implantation.locked_layout && implantation.locked_layout.primary_furniture) || [];

  const mapMurs = {};
  murs.forEach((w) => { mapMurs[w.id] = w.description; });
  const mapZones = {};
  zones.forEach((z) => { mapZones[z.zone_id] = z.description; });
  const mapMeubles = {};
  meubles.forEach((m) => { mapMeubles[m.item_id] = m.type; });

  return meubles.map((m) => ({
    item_id: m.item_id,
    type: m.type,
    wall_anchor_id: m.support_anchor,
    wall_anchor_description:
      m.support_anchor && m.support_anchor !== 'NONE'
        ? mapMurs[m.support_anchor] || 'Description du mur introuvable — ne pas déduire du seul identifiant.'
        : 'Meuble flottant, non adossé à un mur : ne doit pas être recherché contre une paroi précise.',
    floor_zone_id: m.floor_zone,
    floor_zone_description: mapZones[m.floor_zone] || null,
    orientation_target_id: m.orientation_target,
    orientation_target_type:
      m.orientation_target && m.orientation_target !== 'NONE'
        ? mapMeubles[m.orientation_target] || mapMurs[m.orientation_target] || null
        : null,
    expected_relationship: m.orientation,
    location_anchor_description: m.location_anchor,
    visibility_from_main_photo: m.visibility_from_main_photo,
    notes: m.notes,
  }));
}

async function controlerGeneration({ photoPrincipale, imageGeneree, implantation }) {
  const prompt = [
    PROMPT_D_CONTROLE,
    '',
    '=== MOBILIER PRINCIPAL À VÉRIFIER (descriptions physiques déjà résolues — juger sur ces descriptions, pas sur les seuls identifiants) ===',
    JSON.stringify(resoudreDescriptionsPourControle(implantation), null, 2),
    '',
    '=== LOCKED_LAYOUT COMPLET (référence, traçabilité) ===',
    JSON.stringify(implantation.locked_layout, null, 2),
    '',
    '=== CONTRAINTES SPATIALES À VÉRIFIER (s\'appuyer sur les champs "zone"/"reason" en texte, pas sur zone_id seul) ===',
    JSON.stringify(implantation.spatial_constraints || {}, null, 2),
    '',
    '=== VISIBILITÉ ATTENDUE DEPUIS LA PHOTO PRINCIPALE ===',
    JSON.stringify(implantation.main_photo_visibility || {}, null, 2),
    '',
    '=== DÉCISIONS SUR LE MOBILIER RÉSIDUEL (KEEP/REMOVE déjà validées, ne pas re-questionner) ===',
    JSON.stringify(implantation.residual_furniture_decisions || [], null, 2),
  ].join('\n');

  const images = [photoPrincipale, imageGeneree];
  const controle = await callVisionJSON(prompt, images, 3000);

  console.log(`[PipelineVides] Contrôle post-génération — statut: ${controle.controle_status} — next_step: ${controle.next_step}`);
  return controle;
}

/**
 * Exécute la chaîne complète.
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
  let implantation = await etapeB(analyseA, photoPrincipale, photosComplementaires, activeMicroModules);

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

  // ── Validateur déterministe de cohérence géométrique (code, pas prompt) ──
  // S'exécute AVANT toute synthèse/génération. Si le LOCKED_LAYOUT contient
  // une incohérence structurelle (ex. deux meubles "face_to_face" sur le même
  // mur), on ne l'envoie jamais à GPT Image : on redemande une seule fois à B
  // de corriger, avec le détail exact du problème. Si ça échoue encore,
  // l'implantation est bloquée plutôt que transmise contradictoire.
  let controleGeometrique = validerCoherenceGeometrique(implantation);
  if (!controleGeometrique.valide) {
    console.log(`[PipelineVides] Validateur géométrique — échec, recalcul de B demandé:`, controleGeometrique.erreurs);
    implantation = await etapeB(
      analyseA,
      photoPrincipale,
      photosComplementaires,
      activeMicroModules,
      controleGeometrique.erreurs.join('\n')
    );

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

    controleGeometrique = validerCoherenceGeometrique(implantation);
    if (!controleGeometrique.valide) {
      console.log(`[PipelineVides] Validateur géométrique — échec persistant après recalcul, blocage:`, controleGeometrique.erreurs);
      return {
        status: 'INCOHERENCE_GEOMETRIQUE',
        etape: 'B',
        raison: 'Le LOCKED_LAYOUT reste géométriquement incohérent après une tentative de recalcul.',
        demandes: controleGeometrique.erreurs,
        analyse: analyseA,
        implantation,
      };
    }
  }

  // ── Synthèse ──
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

module.exports = { buildPromptBienVide, controlerGeneration };

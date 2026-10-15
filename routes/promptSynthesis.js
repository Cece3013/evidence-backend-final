const axios = require('axios');

// Corrections du 15/10/2026 (validées, étape 2 — conservation du mobilier) :
// A.  Règles impératives 1 (conservation stricte des meubles, chaises comprises)
//     et 3 (table basse conservée si présente, ajoutée seulement si absente).
// B1. Les cinq règles sont ajoutées MOT POUR MOT par le code à la fin du prompt
//     final : GPT-4o ne les réécrit plus.
// B2. La partie rédigée par GPT-4o fait 1 200 à 2 400 caractères.
// B3. Consignes de conservation renforcées pour la rédaction.
// B4. Contrôle automatique des contradictions : une nouvelle rédaction si
//     besoin ; si la contradiction persiste, la génération est BLOQUÉE (erreur).
// Le modèle (gpt-4o) et les réglages de génération sont inchangés.

/**
 * Règles impératives issues des retours de validation.
 * Elles sont ajoutées intégralement, par le code, à la fin de TOUS les prompts
 * finaux, indépendamment du contenu de la bibliothèque.
 */
const REGLES_IMPERATIVES = `
1. MOBILIER EXISTANT — CONSERVATION STRICTE
Tous les meubles principaux présents sur la photo sont conservés à l'identique : canapés, fauteuils, tables basses, tables à manger, chaises, meubles TV, bibliothèques et rangements.
Pour chacun, conserver exactement : la forme, la couleur, les matériaux, la finition, les proportions, le piètement et l'emplacement.
Ne jamais remplacer un meuble principal par un autre modèle, même plus moderne ; ne jamais le redessiner, le recolorer ni le déplacer ; ne jamais lui ajouter de tiroir, de poignée, d'étagère ou de porte.
Chaises : conserver le nombre exact et chaque modèle tel qu'il est. Si les chaises sont différentes entre elles, les garder différentes : ne pas les remplacer par un ensemble assorti et ne pas en ajouter.
Seuls les petits meubles d'appoint secondaires réellement encombrants peuvent être retirés. Des accessoires décoratifs cohérents (coussins, plaids, plantes, vases, livres, bougies, luminaires) peuvent être ajoutés.
Conserver la couleur et la teinte exactes des murs, peintures et papiers peints, même foncés : ne jamais les éclaircir ni les repeindre.

2. DÉPERSONNALISATION COMPLÈTE
Retirer systématiquement de la scène : photographies de famille, portraits encadrés,
posters, affiches, dessins d'enfants, diplômes, souvenirs de voyage, collections
personnelles et tout objet permettant d'identifier les occupants.
Les murs peuvent recevoir une décoration neutre et impersonnelle à la place.

3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Salon : si une table basse est présente sur la photo, elle est conservée à l'identique (forme, couleur, matériau, piètement, emplacement) ; ne jamais la remplacer ni en ajouter une seconde.
Si aucune table basse n'est présente, en ajouter une, de taille adaptée, devant l'assise principale, uniquement si l'espace et la circulation le permettent.

4. LUMIÈRE NATURELLE
Lorsqu'une fenêtre ou une porte-fenêtre est assombrie par un volet, un store ou des
rideaux fermés, les présenter ouverts ou dégagés lorsque cela est physiquement plausible
afin de maximiser la lumière naturelle. Ne jamais modifier la taille, la position ou la
forme de l'ouverture.
Appliquer à CHAQUE fenêtre et porte-fenêtre visible, y compris secondaire ou en
arrière-plan : volet roulant baissé ou store descendu, présenté relevé.

5. DÉFAUTS RÉELS DU BÂTI
Ne jamais réparer, masquer ou effacer numériquement un défaut réel visible du bâti ou
d'un élément fixe : fissure, trace, dégradation, poutre abîmée, défaut de mur, etc.
Le home staging valorise le bien mais ne masque pas son état réel.
`.trim();

const TITRE_REGLES = 'RÈGLES NON NÉGOCIABLES — PRIORITAIRES SUR TOUT CE QUI PRÉCÈDE :';

/** Prompt final = texte rédigé par GPT-4o + les cinq règles, mot pour mot. */
function assemblerPromptFinal(texteRedige) {
  return `${texteRedige.trim()}\n\n${TITRE_REGLES}\n${REGLES_IMPERATIVES}`;
}

// ---------------------------------------------------------------------------
// B4 — Contrôle des contradictions
// On cherche, dans le texte rédigé par GPT-4o, des phrases qui créent,
// ajoutent ou remplacent un meuble que l'analyse a repéré sur la photo.
// ---------------------------------------------------------------------------

// Texte en minuscules, sans accents, apostrophes unifiées (pour comparer).
function normaliser(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

// Familles de meubles principaux : comment les reconnaître dans l'analyse,
// et comment ils peuvent être nommés dans le texte rédigé.
const FAMILLES = [
  { nom: 'canapé', analyse: /canape|sofa|banquette/, texte: "(?:canape|sofa|banquette)s?" },
  { nom: 'fauteuil', analyse: /fauteuil/, texte: 'fauteuils?' },
  { nom: 'table basse', analyse: /table basse|table de salon/, texte: 'tables? basses?' },
  { nom: 'table à manger', analyse: /table (a|de) manger|table de (la )?salle a manger|table (de )?repas/, texte: "tables? (?:a manger|de (?:la )?salle a manger|de repas)" },
  { nom: 'chaises', analyse: /chaise/, texte: 'chaises?' },
  { nom: 'meuble TV', analyse: /meuble (tv|tele)|meuble de television/, texte: "meubles? (?:tv|tele|de television)" },
  { nom: 'bibliothèque', analyse: /bibliotheque/, texte: 'bibliotheques?' },
];

const VERBES_CREATION = "(?:ajout\\w*|integr\\w*|install\\w*|remplac\\w*|cre[eé]\\w*|choisi\\w*|prevoi\\w*|place[rz]?|dispose[rz]?|positionne[rz]?)";
const DETERMINANTS = "(?:une?|des|de|d'|deux|trois|quatre|cinq|six|\\d+|le|la|les|l')";
const NEGATION = /\b(ne|n'|sans|jamais|aucune?|ni|pas)\b/;

/** Retourne la liste des phrases contradictoires trouvées (vide si aucune). */
function detecterContradictions(texteRedige, analysis) {
  const meubles = normaliser((analysis?.meublesPrincipauxAConserver || []).join(' | '));
  const texte = normaliser(texteRedige);
  const trouvees = [];

  for (const f of FAMILLES) {
    if (!f.analyse.test(meubles)) continue; // meuble absent de la photo : l'ajouter est permis

    const motifs = [
      // « ajoute une table basse », « intègre une nouvelle table à manger », « remplace les chaises »…
      new RegExp(`${VERBES_CREATION}\\s+${DETERMINANTS}?\\s*(?:nouv\\w*\\s+)?(?:\\w+\\s+)?${f.texte}\\b`, 'g'),
      // « nouveau canapé », « nouvelles chaises »
      new RegExp(`\\bnouv\\w*\\s+${f.texte}\\b`, 'g'),
      // « chaises modernes / assorties / contemporaines », « canapé moderne »…
      new RegExp(`\\b${f.texte}\\s+(?:\\w+\\s+)?(?:modernes?|assortie?s?|contemporaine?s?|neuve?s?)\\b`, 'g'),
      // « 4 à 6 chaises »
      new RegExp(`\\b(?:\\d+|deux|trois|quatre|cinq|six)\\s+a\\s+(?:\\d+|deux|trois|quatre|cinq|six|huit)\\s+${f.texte}\\b`, 'g'),
    ];

    for (const motif of motifs) {
      let r;
      while ((r = motif.exec(texte)) !== null) {
        // Début de la phrase : si elle contient une négation juste avant
        // (« ne remplace jamais le canapé »), ce n'est pas une contradiction.
        const avant = texte.slice(Math.max(0, r.index - 40), r.index);
        const debutPhrase = avant.split(/[.;:!?\n]/).pop();
        if (NEGATION.test(debutPhrase)) continue;
        // Formules de conservation (« conserve la table à manger existante… »)
        const suite = texte.slice(r.index, r.index + r[0].length + 25);
        if (/existant|d'origine|a l'identique|actuel/.test(suite) && !/remplac/.test(r[0])) continue;
        trouvees.push(`${f.nom} : « ${r[0]} »`);
      }
    }
  }
  return [...new Set(trouvees)];
}

// ---------------------------------------------------------------------------

function construireInstructions({ analysis, referenceRules, roomPrompt, microTexts, roomType, commentaireClient }) {
  return `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : transformer une documentation de home staging très détaillée en UN SEUL prompt d'exécution compact, destiné au modèle gpt-image-2 via l'API d'édition d'image.

CONTRAINTES DE SORTIE :
- Entre 1200 et 2400 caractères.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré par priorités décroissantes, dans cet ordre strict :
  PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective et CHAQUE meuble de « meublesPrincipauxAConserver » : nomme-le avec sa description (couleur, matière, piètement ; nombre et modèles pour les chaises) et indique qu'il est conservé strictement à l'identique, à sa place.
  PRIORITÉ 2 — désencombrer et dépersonnaliser : ce qu'il faut retirer précisément.
  PRIORITÉ 3 — matérialiser la fonction de la pièce et améliorer la projection immobilière.
  PRIORITÉ 4 — style, textiles, voilages, tapis, luminaires, plantes, accessoires, ambiance et lumière.
- Intègre les éléments concrets de l'analyse (noms des meubles, objets à retirer, atouts) plutôt que des formules génériques.
- Termine par une courte ligne sur le rendu attendu (photoréaliste, lumière naturelle conservée).
- N'invente aucun élément absent de la documentation ou de l'analyse.

CONSERVATION DU MOBILIER (impératif) :
- Pour chaque meuble listé dans « meublesPrincipauxAConserver », n'écris JAMAIS d'instruction qui le crée, l'ajoute, le remplace, le modernise, le recolore, le redessine ou le déplace.
- Les suggestions de mobilier des modules (canapé, fauteuil, table basse, table à manger, chaises, meuble TV, bibliothèque) ne s'appliquent QUE si ce meuble est absent de la photo. S'il est présent, seuls des textiles et accessoires peuvent l'accompagner.
- N'emploie pas de formules comme « nouvelle table », « chaises modernes », « 4 à 6 chaises » ou « ajoute une table basse » pour un meuble déjà présent.
- Tu peux retirer les petits meubles d'appoint réellement encombrants et ajouter des accessoires décoratifs cohérents.

AMBITION ESTHÉTIQUE (à conserver) :
La conservation porte uniquement sur l'architecture et les meubles principaux. Reste ambitieux et précis sur tout le reste : désencombrement net, harmonisation des couleurs et matières, textiles (coussins, plaids), voilages, tapis, luminaires, plantes, décoration soignée et luminosité naturelle mise en valeur. Le résultat doit rester une transformation home staging nettement visible et valorisante.

RÈGLES NON NÉGOCIABLES :
Les cinq règles ci-dessous seront AJOUTÉES AUTOMATIQUEMENT, mot pour mot, à la fin de ton texte.
Ne les recopie pas. Ton texte ne doit jamais les contredire.

=== RÈGLES NON NÉGOCIABLES (pour information) ===
${REGLES_IMPERATIVES}

Réponds UNIQUEMENT avec le texte du prompt, sans guillemets, sans titre, sans commentaire.

=== ANALYSE DE LA PHOTO ===
${JSON.stringify(analysis, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À prendre en compte si elle reste compatible avec les règles non négociables et l'esprit du home staging.)` : ''}

=== RÈGLES GÉNÉRALES (référence) ===
${referenceRules}

=== MODULE DE LA PIÈCE : ${roomType} (référence) ===
${roomPrompt}

${microTexts.length ? '=== AJUSTEMENTS SPÉCIFIQUES DÉTECTÉS ===\n' + microTexts.join('\n\n') : ''}`;
}

async function appelerGpt4o(contenu) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      max_tokens: 1800,
      messages: [{ role: 'user', content: contenu }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000,
    }
  );
  return response.data.choices[0].message.content.trim();
}

/**
 * Transforme la bibliothèque de prompts (longue) + l'analyse de la photo
 * en un prompt d'exécution compact et hiérarchisé pour le modèle d'image,
 * puis ajoute les cinq règles impératives mot pour mot.
 */
async function synthesizePrompt(params) {
  const { analysis, referenceRules, roomPrompt, microTexts, roomType } = params;
  const instructions = construireInstructions(params);

  let texteRedige;
  try {
    texteRedige = await appelerGpt4o(instructions);
  } catch (err) {
    console.error('[PromptSynthesis] Erreur:', err.response?.data || err.message);
    // Repli (inchangé) : version longue + règles impératives
    return [referenceRules, roomPrompt, ...microTexts, TITRE_REGLES, REGLES_IMPERATIVES].join('\n\n');
  }

  // B4 — contrôle des contradictions, une nouvelle rédaction si nécessaire
  let contradictions = detecterContradictions(texteRedige, analysis);
  if (contradictions.length) {
    console.warn(`[PromptSynthesis] CONTRADICTION DÉTECTÉE (${roomType}) — nouvelle rédaction demandée :\n- ${contradictions.join('\n- ')}`);
    const correction = `${instructions}

=== CORRECTION OBLIGATOIRE ===
Ta version précédente contenait des instructions qui contredisent la conservation du mobilier existant :
- ${contradictions.join('\n- ')}
Réécris le prompt complet sans ces instructions : ces meubles sont présents sur la photo et doivent être conservés à l'identique.`;
    try {
      texteRedige = await appelerGpt4o(correction);
    } catch (err) {
      console.error('[PromptSynthesis] Erreur (nouvelle rédaction):', err.response?.data || err.message);
      throw new Error(`Rédaction du prompt impossible après une contradiction : ${contradictions.join(' ; ')}`);
    }
    contradictions = detecterContradictions(texteRedige, analysis);
    if (contradictions.length) {
      console.error(`[PromptSynthesis] CONTRADICTION PERSISTANTE (${roomType}) — génération bloquée :\n- ${contradictions.join('\n- ')}\n${texteRedige}`);
      throw new Error(`Prompt contradictoire après 2 rédactions (génération bloquée) : ${contradictions.join(' ; ')}`);
    }
    console.log(`[PromptSynthesis] Contradiction corrigée à la 2e rédaction (${roomType}).`);
  }

  const prompt = assemblerPromptFinal(texteRedige);
  console.log(`[PromptSynthesis] Prompt synthétisé : ${texteRedige.length} caractères rédigés + règles = ${prompt.length} caractères`);
  // Diagnostic : prompt final exact envoyé au modèle d'image
  console.log(`[PromptSynthesis] PROMPT FINAL (${roomType}) :\n${prompt}`);
  return prompt;
}

module.exports = { synthesizePrompt, detecterContradictions, assemblerPromptFinal, REGLES_IMPERATIVES };

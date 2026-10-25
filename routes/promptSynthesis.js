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
// Correction du 16/10/2026 (validée — table basse des salons) :
// - Règle 3 réécrite : un guéridon / une table d'appoint n'est jamais une table
//   basse ; table basse ajoutée devant le canapé si absente, style adapté au
//   logement, jamais forcée dans un espace manifestement trop petit.
// - La rédaction et le contrôle s'appuient sur le champ d'analyse
//   « tableBasseDevantCanape » (presente / absente / non_pertinent).
// - Table basse oubliée alors qu'elle est « absente » : une nouvelle rédaction ;
//   si l'oubli persiste, la génération continue (règle 3) et le journal le signale.
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
Salon — table basse :
- Une table basse est une table placée devant le canapé principal, au centre de l'espace d'assise. Un guéridon, une table d'appoint ou une petite table placée à côté d'un fauteuil ou au bout d'un canapé n'est jamais une table basse.
- Si une table basse existe déjà devant le canapé, la conserver strictement à l'identique (forme, couleur, matériau, piètement, emplacement) ; ne jamais la remplacer ni en ajouter une seconde.
- Si aucune table basse n'existe devant le canapé principal, en ajouter une devant ce canapé, élégante, dont le style et le matériau s'accordent au logement, adaptée aux dimensions de la pièce.
- La table ajoutée doit être proportionnée, ne pas gêner les circulations et renforcer la mise en valeur du coin salon. Ne jamais forcer cet ajout dans un espace manifestement trop petit.
- Ne jamais déplacer, modifier ou retirer un meuble principal existant, guéridons et tables d'appoint compris, pour permettre cet ajout.

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

  const etatTableBasse = analysis?.tableBasseDevantCanape;

  for (const f of FAMILLES) {
    let present = f.analyse.test(meubles);
    // Table basse : le champ dédié de l'analyse fait foi (un guéridon n'est pas une table basse)
    if (f.nom === 'table basse' && ['presente', 'absente', 'non_pertinent'].includes(etatTableBasse)) {
      present = etatTableBasse === 'presente';
    }
    if (!present) continue; // meuble absent de la photo : l'ajouter est permis

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

const PIECES_SALON = ['salon', 'salon_salle_a_manger'];

/**
 * Table basse oubliée : l'analyse dit « absente » (salon, hors petit espace)
 * mais le texte rédigé ne mentionne aucune table basse.
 */
function tableBasseOubliee(texteRedige, analysis, roomType) {
  if (!PIECES_SALON.includes(roomType)) return false;
  if (analysis?.tableBasseDevantCanape !== 'absente') return false;
  if ((analysis?.microModules || []).includes('petit_espace')) return false; // ne jamais forcer dans un petit espace
  return !/tables? basses?/.test(normaliser(texteRedige));
}

function consigneTableBasse(analysis, roomType) {
  if (!PIECES_SALON.includes(roomType)) return '';
  const etat = analysis?.tableBasseDevantCanape;
  if (etat === 'presente') {
    return `
TABLE BASSE (analyse : présente) :
- La table basse posée devant le canapé est conservée strictement à l'identique. N'en ajoute pas d'autre.
`;
  }
  if (etat === 'absente') {
    return `
TABLE BASSE (analyse : absente devant le canapé) :
- En PRIORITÉ 3, écris une consigne explicite : ajouter une table basse devant le canapé principal (nomme-le), élégante, proportionnée, dont le style et le matériau s'accordent au logement (bois, rotin, matière minérale… selon le module et l'ambiance), sans gêner les circulations.
- Les guéridons et tables d'appoint existants restent à leur place, à l'identique : ils ne remplacent pas la table basse.
- Ne force jamais cet ajout si l'espace devant le canapé est manifestement trop petit (tiens compte des contraintes spatiales de l'analyse).
`;
  }
  return '';
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
${consigneTableBasse(analysis, roomType)}
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
  // Option PRO « Projection modernisée » (salon, salon / salle à manger) : chemin séparé.
  // Sans cette option, le code ci-dessous (version validée) s'applique tel quel.
  if (params.mode === MODE_MODERNISE) {
    return PIECES_SALON.includes(params.roomType)
      ? synthesizePromptModernise(params) // salons : version validée le 24/10/2026, inchangée
      : synthesizePromptProjection(params); // chambres, cuisine, salle de bain (ajout du 24/10/2026)
  }
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

  // B4 — contrôle des contradictions (+ table basse oubliée), une nouvelle rédaction si nécessaire
  let contradictions = detecterContradictions(texteRedige, analysis);
  let oubli = tableBasseOubliee(texteRedige, analysis, roomType);
  if (contradictions.length || oubli) {
    if (contradictions.length) {
      console.warn(`[PromptSynthesis] CONTRADICTION DÉTECTÉE (${roomType}) — nouvelle rédaction demandée :\n- ${contradictions.join('\n- ')}`);
    }
    if (oubli) {
      console.warn(`[PromptSynthesis] TABLE BASSE OUBLIÉE (${roomType}) — analyse « absente » mais aucune table basse prévue — nouvelle rédaction demandée.`);
    }
    const points = [];
    if (contradictions.length) {
      points.push(`Ta version précédente contenait des instructions qui contredisent la conservation du mobilier existant :\n- ${contradictions.join('\n- ')}\nSupprime ces instructions : ces meubles sont présents sur la photo et doivent être conservés à l'identique.`);
    }
    if (oubli) {
      points.push(`Ta version précédente oubliait la table basse : l'analyse indique qu'il n'y en a aucune devant le canapé. Ajoute en PRIORITÉ 3 une consigne explicite d'ajout d'une table basse devant le canapé principal, proportionnée, au style accordé au logement, sans gêner les circulations ; les guéridons et tables d'appoint restent à l'identique.`);
    }
    const correction = `${instructions}

=== CORRECTION OBLIGATOIRE ===
${points.join('\n\n')}
Réécris le prompt complet en tenant compte de ces corrections.`;
    try {
      texteRedige = await appelerGpt4o(correction);
    } catch (err) {
      console.error('[PromptSynthesis] Erreur (nouvelle rédaction):', err.response?.data || err.message);
      if (contradictions.length) {
        throw new Error(`Rédaction du prompt impossible après une contradiction : ${contradictions.join(' ; ')}`);
      }
      // Oubli seul : on garde la première rédaction (règle 3 ajoutée à la fin)
      console.warn(`[PromptSynthesis] TABLE BASSE OUBLIÉE PERSISTANTE (${roomType}) — nouvelle rédaction impossible, génération poursuivie (règle 3).`);
    }
    contradictions = detecterContradictions(texteRedige, analysis);
    if (contradictions.length) {
      console.error(`[PromptSynthesis] CONTRADICTION PERSISTANTE (${roomType}) — génération bloquée :\n- ${contradictions.join('\n- ')}\n${texteRedige}`);
      throw new Error(`Prompt contradictoire après 2 rédactions (génération bloquée) : ${contradictions.join(' ; ')}`);
    }
    if (oubli) {
      oubli = tableBasseOubliee(texteRedige, analysis, roomType);
      if (oubli) {
        console.warn(`[PromptSynthesis] TABLE BASSE OUBLIÉE PERSISTANTE (${roomType}) — génération poursuivie grâce à la règle 3 (à surveiller).`);
      } else {
        console.log(`[PromptSynthesis] Table basse ajoutée à la 2e rédaction (${roomType}).`);
      }
    } else {
      console.log(`[PromptSynthesis] Contradiction corrigée à la 2e rédaction (${roomType}).`);
    }
  }

  const prompt = assemblerPromptFinal(texteRedige);
  console.log(`[PromptSynthesis] Prompt synthétisé : ${texteRedige.length} caractères rédigés + règles = ${prompt.length} caractères`);
  // Diagnostic : prompt final exact envoyé au modèle d'image
  console.log(`[PromptSynthesis] PROMPT FINAL (${roomType}) :\n${prompt}`);
  return prompt;
}

// ===========================================================================
// OPTION PRO « PROJECTION MODERNISÉE » (validée le 24/10/2026)
// Biens habités PRO, salon et salon / salle à manger, sur choix de l'agent.
// Règles 1 et 3 remplacées ; règles 2, 4 et 5 reprises mot pour mot.
// ===========================================================================

const MODE_MODERNISE = 'projection_modernisee';

const REGLE_1_MODERNISEE = `1. MOBILIER — PROJECTION MODERNISÉE
Les meubles principaux (canapés, fauteuils, tables basses, table à manger, chaises, meuble TV, rangements mobiles) sont remplacés par un mobilier contemporain, chaleureux et réaliste.
Chaque meuble de remplacement garde la fonction et l'emplacement du meuble d'origine, avec des proportions adaptées à la pièce ; l'organisation de l'espace (coin salon, coin repas) reste la même.
Ne jamais encombrer les circulations, ni masquer une fenêtre, une porte ou un radiateur.
Conserver les éléments intégrés et fixes : bibliothèques et placards intégrés, cuisine, cheminée, radiateurs.
Les murs peuvent recevoir une peinture neutre (blanc cassé, beige, greige) sans jamais masquer un défaut réel ; les sols, plafonds et menuiseries restent inchangés.`;

const REGLE_3_MODERNISEE = `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Salon : une table basse contemporaine, proportionnée, devant le canapé principal, sans gêner les circulations. Ne jamais forcer cet ajout dans un espace manifestement trop petit.`;

// Règles 2, 4 et 5 : extraites telles quelles de REGLES_IMPERATIVES (aucune réécriture)
const BLOCS_REGLES = REGLES_IMPERATIVES.split(/\n\n(?=\d\. )/);
const REGLES_IMPERATIVES_MODERNISEES = [
  REGLE_1_MODERNISEE,
  BLOCS_REGLES.find((b) => b.startsWith('2. ')),
  REGLE_3_MODERNISEE,
  BLOCS_REGLES.find((b) => b.startsWith('4. ')),
  BLOCS_REGLES.find((b) => b.startsWith('5. ')),
].join('\n\n');

function construireInstructionsModernisees({ analysis, referenceRules, roomPrompt, microTexts, roomType, commentaireClient }) {
  return `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : transformer une documentation de home staging très détaillée en UN SEUL prompt d'exécution compact, destiné au modèle gpt-image-2 via l'API d'édition d'image.

L'agent immobilier a choisi l'option « PROJECTION MODERNISÉE » : le mobilier et la décoration actuels sont remplacés par un aménagement contemporain, dans le logement réel.

CONTRAINTES DE SORTIE :
- Entre 1200 et 2400 caractères.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré par priorités décroissantes, dans cet ordre strict :
  PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective, les ouvertures, les sols, les plafonds et les éléments intégrés ; les murs peuvent recevoir une peinture neutre.
  PRIORITÉ 2 — désencombrer et dépersonnaliser : ce qu'il faut retirer précisément.
  PRIORITÉ 3 — remplacer chaque meuble principal actuel par un équivalent contemporain, à la même place et pour la même fonction (nomme le meuble d'origine et son remplaçant), et matérialiser la fonction de la pièce.
  PRIORITÉ 4 — style, textiles, voilages, tapis, luminaires, plantes, accessoires, ambiance et lumière.
- Intègre les éléments concrets de l'analyse (meubles actuels et leur position, objets à retirer, atouts) plutôt que des formules génériques.
- Termine par une courte ligne sur le rendu attendu (photoréaliste, lumière naturelle conservée).
- N'invente aucun élément d'architecture absent de la photo.

PROJECTION MODERNISÉE (impératif) :
- Le champ « meublesPrincipauxAConserver » de l'analyse décrit ici le mobilier ACTUEL : chacun de ces meubles est remplacé par un équivalent contemporain, chaleureux et réaliste, même fonction, même emplacement, proportions adaptées.
- L'organisation de la pièce ne change pas : coin salon et coin repas restent aux mêmes endroits. Ne bloque ni les circulations, ni les fenêtres, ni les portes, ni les radiateurs.
- Conserve les éléments intégrés et fixes (bibliothèques et placards intégrés, cuisine, cheminée, radiateurs).
- Les murs peuvent recevoir une peinture neutre (blanc cassé, beige, greige), sans masquer un défaut réel.
- Coin repas : une table contemporaine avec un nombre de chaises adapté à sa taille et à l'espace.
- Salon : une table basse contemporaine devant le canapé, sauf si l'espace est manifestement trop petit.

AMBITION ESTHÉTIQUE :
Le résultat doit être une projection modernisée nettement visible, chaleureuse et vendeuse : mobilier contemporain cohérent, harmonie des couleurs et matières, textiles, voilages, tapis, luminaires, plantes, décoration soignée et luminosité naturelle mise en valeur, tout en restant crédible dans le logement réel.

RÈGLES NON NÉGOCIABLES :
Les cinq règles ci-dessous seront AJOUTÉES AUTOMATIQUEMENT, mot pour mot, à la fin de ton texte.
Ne les recopie pas. Ton texte ne doit jamais les contredire.

=== RÈGLES NON NÉGOCIABLES (pour information) ===
${REGLES_IMPERATIVES_MODERNISEES}

Réponds UNIQUEMENT avec le texte du prompt, sans guillemets, sans titre, sans commentaire.

=== ANALYSE DE LA PHOTO ===
${JSON.stringify(analysis, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À prendre en compte si elle reste compatible avec les règles non négociables et l'esprit du home staging.)` : ''}

=== RÈGLES GÉNÉRALES (référence) ===
${referenceRules}

=== MODULE DE LA PIÈCE : ${roomType} — PROJECTION MODERNISÉE (référence) ===
${roomPrompt}

${microTexts.length ? '=== AJUSTEMENTS SPÉCIFIQUES DÉTECTÉS ===\n' + microTexts.join('\n\n') : ''}`;
}

/** Table basse oubliée en mode modernisé (salon, hors petit espace). */
function tableBasseOublieeModernise(texteRedige, analysis, roomType) {
  if (!PIECES_SALON.includes(roomType)) return false;
  if ((analysis?.microModules || []).includes('petit_espace')) return false;
  return !/tables? basses?/.test(normaliser(texteRedige));
}

async function synthesizePromptModernise(params) {
  const { analysis, referenceRules, roomPrompt, microTexts, roomType } = params;
  const instructions = construireInstructionsModernisees(params);
  console.log(`[PromptSynthesis] Option PROJECTION MODERNISÉE (${roomType})`);

  let texteRedige;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model: 'gpt-4o', max_tokens: 1800, messages: [{ role: 'user', content: instructions }] },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 90000 }
    );
    texteRedige = response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[PromptSynthesis] Erreur (modernisé):', err.response?.data || err.message);
    return [referenceRules, roomPrompt, ...microTexts, TITRE_REGLES, REGLES_IMPERATIVES_MODERNISEES].join('\n\n');
  }

  // Seul contrôle propre à ce mode : la table basse du salon.
  if (tableBasseOublieeModernise(texteRedige, analysis, roomType)) {
    console.warn(`[PromptSynthesis] TABLE BASSE OUBLIÉE (modernisé, ${roomType}) — nouvelle rédaction demandée.`);
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: 'gpt-4o', max_tokens: 1800, messages: [{ role: 'user', content: `${instructions}\n\n=== CORRECTION OBLIGATOIRE ===\nTa version précédente oubliait la table basse contemporaine devant le canapé. Réécris le prompt complet en l'ajoutant en PRIORITÉ 3.` }] },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 90000 }
      );
      const corrige = response.data.choices[0].message.content.trim();
      if (tableBasseOublieeModernise(corrige, analysis, roomType)) {
        console.warn(`[PromptSynthesis] TABLE BASSE OUBLIÉE PERSISTANTE (modernisé, ${roomType}) — génération poursuivie grâce à la règle 3 (à surveiller).`);
      }
      texteRedige = corrige;
    } catch (err) {
      console.warn('[PromptSynthesis] Nouvelle rédaction impossible (modernisé) — 1re rédaction conservée :', err.response?.data || err.message);
    }
  }

  const prompt = `${texteRedige.trim()}\n\n${TITRE_REGLES}\n${REGLES_IMPERATIVES_MODERNISEES}`;
  console.log(`[PromptSynthesis] Prompt synthétisé : ${texteRedige.length} caractères rédigés + règles = ${prompt.length} caractères`);
  console.log(`[PromptSynthesis] PROMPT FINAL (${roomType}, modernisé) :\n${prompt}`);
  return prompt;
}

// ===========================================================================
// AJOUT DU 24/10/2026 — CHAMBRES (projection modernisée),
// CUISINE et SALLE DE BAIN (projection rénovée), biens habités PRO.
// Les salons gardent leur version ci-dessus, inchangée.
// ===========================================================================

const PIECES_CHAMBRE = ['chambre_parentale', 'chambre_enfant', 'chambre_ado'];
const PIECES_RENOVATION = ['cuisine', 'salle_bain'];

// Mention incrustée sur les images de projection rénovée (décision du 24/10/2026)
const MENTION_RENOVATION = 'Projection de rénovation – travaux non inclus';

const REGLE_1_CHAMBRE = `1. MOBILIER — PROJECTION MODERNISÉE
Les meubles principaux de la chambre (lit et tête de lit, tables de chevet, commode, armoire non intégrée, bureau, chaise, fauteuil) sont remplacés par un mobilier contemporain, chaleureux et réaliste.
Chaque meuble de remplacement garde la fonction et l'emplacement du meuble d'origine, avec des proportions adaptées à la pièce ; le lit reste au même endroit, dans la même orientation.
Ne jamais encombrer les circulations, ni masquer une fenêtre, une porte ou un radiateur.
Conserver les éléments intégrés et fixes : placards et dressings intégrés, cheminée, radiateurs.
Les murs peuvent recevoir une peinture neutre (blanc cassé, beige, greige) sans jamais masquer un défaut réel ; les sols, plafonds et menuiseries restent inchangés.`;

const REGLE_3_CHAMBRE = `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Chambre : un lit contemporain fait avec soin, au linge harmonieux, avec des chevets de part et d'autre lorsque l'espace le permet.`;

// 25/10/2026 : chambres enfant et ado — identité de la pièce et taille du lit adaptée
const LIGNES_COMMUNES_CHAMBRE = `Chaque autre meuble garde la fonction et l'emplacement du meuble d'origine, avec des proportions adaptées à la pièce.
Ne jamais encombrer les circulations, ni masquer une fenêtre, une porte ou un radiateur.
Conserver les éléments intégrés et fixes : placards et dressings intégrés, cheminée, radiateurs.
Les murs peuvent recevoir une peinture neutre (blanc cassé, beige, greige) ou douce, sans jamais masquer un défaut réel ; les sols, plafonds et menuiseries restent inchangés.`;

const REGLE_1_ENFANT = `1. MOBILIER — PROJECTION MODERNISÉE (CHAMBRE D'ENFANT)
Les meubles principaux (lit, tables de chevet, commode, armoire non intégrée, bureau, chaise) sont remplacés par un mobilier d'enfant contemporain, chaleureux et réaliste.
Le lit reste au même emplacement et dans la même orientation ; il est adapté à une chambre d'enfant : lit simple ou lit cabane, même si la photo montre un lit double.
${LIGNES_COMMUNES_CHAMBRE}`;

const REGLE_1_ADO = `1. MOBILIER — PROJECTION MODERNISÉE (CHAMBRE D'ADOLESCENT)
Les meubles principaux (lit, tables de chevet, commode, armoire non intégrée, bureau, chaise) sont remplacés par un mobilier contemporain adapté à un adolescent, chaleureux et réaliste.
Le lit reste au même emplacement et dans la même orientation ; lit simple, ou lit de 140 cm si la place le permet.
${LIGNES_COMMUNES_CHAMBRE}`;

const REGLE_3_ENFANT = `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Chambre d'enfant : la pièce doit être immédiatement reconnaissable comme une chambre d'enfant (lit d'enfant, rangements à jouets, livres d'enfants, décoration douce et ludique), jamais comme une chambre d'adulte.`;

const REGLE_3_ADO = `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Chambre d'adolescent : la pièce doit être immédiatement reconnaissable comme une chambre d'adolescent (bureau d'étude bien visible, rangements, décoration jeune et graphique), jamais comme une chambre parentale.`;

const REGLE_1_CUISINE = `1. CUISINE — PROJECTION RÉNOVÉE
Montrer la cuisine entièrement refaite, à implantation identique : évier, plaques de cuisson, four, réfrigérateur et meubles restent aux mêmes emplacements, avec les mêmes linéaires et les mêmes volumes.
Sont rénovés : façades, poignées, plan de travail, crédence, électroménager visible, robinetterie, luminaires, murs, sol et plafond.
Évier, robinetterie et électroménager (plaques, four, hotte, réfrigérateur) sont remplacés par des modèles neufs et contemporains, au même emplacement.
Coin repas éventuel : table et chaises contemporaines au même emplacement, en nombre adapté à l'espace.
Ne jamais déplacer, agrandir ni créer de fenêtre, de porte ou d'ouverture ; ne jamais modifier les volumes ni l'angle de vue.
La rénovation reste réaliste, réalisable et cohérente avec le standing du logement : pas une cuisine de catalogue.`;

const REGLE_1_SDB = `1. SALLE DE BAIN — PROJECTION RÉNOVÉE
Montrer la salle de bain entièrement refaite, à implantation identique : baignoire ou douche, vasque, WC et bidet éventuel restent aux mêmes emplacements.
UNE BAIGNOIRE RESTE UNE BAIGNOIRE. UNE DOUCHE RESTE UNE DOUCHE. Ne jamais transformer l'une en l'autre.
Les sanitaires (baignoire, receveur de douche, WC, lavabo, bidet) sont remplacés par des modèles neufs, blancs et contemporains, de même type et au même emplacement. Aucun sanitaire coloré ou daté ne doit subsister.
Sont rénovés : revêtements muraux et sol, meuble vasque, sanitaires, robinetterie, paroi, miroir, luminaires et plafond.
Ne jamais déplacer, agrandir ni créer de fenêtre, de porte ou d'ouverture ; ne jamais modifier les volumes ni l'angle de vue.
La rénovation reste réaliste, réalisable et cohérente avec le standing du logement : pas une salle de bain de catalogue.`;

const REGLE_3_RENOVATION = {
  cuisine: `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Cuisine : plan de travail dégagé, mis en scène avec quelques accessoires choisis.`,
  salle_bain: `3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Salle de bain : linge de toilette soigné et quelques accessoires choisis.`,
};

// « On rénove tout » (décision du 24/10/2026) : la règle 5 devient « rénovation complète ».
const REGLE_5_RENOVATION = `5. RÉNOVATION COMPLÈTE
Tous les éléments rénovés (murs, sol, plafond, crédence, revêtements, équipements) sont présentés refaits à neuf, sans trace d'usure ni de dégradation.
Les fenêtres et les portes gardent exactement leur taille, leur forme et leur position ; seul leur état peut être rafraîchi.`;

const BLOC_REGLE = (n) => BLOCS_REGLES.find((b) => b.startsWith(`${n}. `));

/** Les cinq règles de l'option, selon la pièce. Règles 2 et 4 toujours reprises mot pour mot. */
function reglesProjection(roomType) {
  if (roomType === 'chambre_enfant') {
    return [REGLE_1_ENFANT, BLOC_REGLE(2), REGLE_3_ENFANT, BLOC_REGLE(4), BLOC_REGLE(5)].join('\n\n');
  }
  if (roomType === 'chambre_ado') {
    return [REGLE_1_ADO, BLOC_REGLE(2), REGLE_3_ADO, BLOC_REGLE(4), BLOC_REGLE(5)].join('\n\n');
  }
  if (PIECES_CHAMBRE.includes(roomType)) {
    return [REGLE_1_CHAMBRE, BLOC_REGLE(2), REGLE_3_CHAMBRE, BLOC_REGLE(4), BLOC_REGLE(5)].join('\n\n');
  }
  const regle1 = roomType === 'cuisine' ? REGLE_1_CUISINE : REGLE_1_SDB;
  return [regle1, BLOC_REGLE(2), REGLE_3_RENOVATION[roomType], BLOC_REGLE(4), REGLE_5_RENOVATION].join('\n\n');
}

// Consignes ajoutées uniquement pour les chambres enfant et ado (25/10/2026)
const CONSIGNES_AGE = {
  chambre_enfant: `
- CHAMBRE D'ENFANT : la pièce doit être immédiatement reconnaissable comme une chambre d'enfant, jamais comme une chambre d'adulte. Lit d'enfant (lit simple ou lit cabane) au même emplacement et dans la même orientation, même si la photo montre un lit double. Linge de lit doux à motifs discrets, coussins ludiques, étagère avec livres d'enfants et jouets en bois, panier à jouets, tapis rond doux, coin lecture ou petit bureau, guirlande lumineuse ou suspension ludique, illustrations douces (animaux, nature). Palette pastel : sauge, bleu poudré, rose poudré, ocre doux, bois clair. Jamais de personnages ni de licences.`,
  chambre_ado: `
- CHAMBRE D'ADOLESCENT : la pièce doit être immédiatement reconnaissable comme une chambre d'adolescent, jamais comme une chambre parentale. Lit simple, ou lit de 140 cm si la place le permet, au même emplacement et dans la même orientation. Bureau d'étude bien visible avec chaise de bureau, lampe et étagères de livres ; décoration jeune et graphique (affiches graphiques neutres, tableau d'affichage, tapis graphique) ; un objet de loisir discret (casque audio, guitare ou skateboard mural). Palette plus affirmée : bleu canard, vert sapin, terracotta, gris anthracite, bois naturel.`,
};

function construireInstructionsProjection({ analysis, referenceRules, roomPrompt, microTexts, roomType, commentaireClient }) {
  const renovation = PIECES_RENOVATION.includes(roomType);
  const regles = reglesProjection(roomType);
  const nomPiece = { cuisine: 'la cuisine', salle_bain: 'la salle de bain' }[roomType] || 'la chambre';

  const option = renovation
    ? `L'agent immobilier a choisi l'option « PROJECTION RÉNOVÉE » : montrer ${nomPiece} entièrement refaite, à implantation identique, pour aider les acheteurs à se projeter dans les travaux.`
    : `L'agent immobilier a choisi l'option « PROJECTION MODERNISÉE » : le mobilier et la décoration actuels de la chambre sont remplacés par un aménagement contemporain, dans le logement réel.`;

  const priorite1 = renovation
    ? `PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective, les fenêtres et les portes, et l'IMPLANTATION exacte de ${nomPiece} (chaque équipement à sa place).`
    : `PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective, les ouvertures, les sols, les plafonds, les éléments intégrés, et l'emplacement et l'orientation du lit ; les murs peuvent recevoir une peinture neutre.`;

  const priorite3 = renovation
    ? `PRIORITÉ 3 — décrire précisément la rénovation : ce qui est refait et avec quelles finitions, équipement par équipement, à la même place.`
    : `PRIORITÉ 3 — remplacer chaque meuble principal actuel par un équivalent contemporain, à la même place et pour la même fonction (nomme le meuble d'origine et son remplaçant).`;

  const imperatif = renovation
    ? `PROJECTION RÉNOVÉE (impératif) :
- Tout est rénové : ${roomType === 'cuisine' ? 'façades, poignées, plan de travail, crédence, électroménager visible, robinetterie, luminaires, murs, sol et plafond' : 'revêtements muraux et sol, meuble vasque, sanitaires, robinetterie, paroi, miroir, luminaires et plafond'}. Aucune trace d'usure ni de dégradation sur les éléments rénovés.
- L'implantation ne change pas : chaque équipement reste exactement à sa place, mêmes linéaires, mêmes volumes.${roomType === 'salle_bain' ? '\n- Une baignoire reste une baignoire, une douche reste une douche.\n- Les sanitaires (baignoire, receveur de douche, WC, lavabo, bidet) sont REMPLACÉS par des modèles neufs, blancs et contemporains, de même type et au même emplacement : aucun sanitaire coloré ou daté ne subsiste.' : '\n- Évier, robinetterie et électroménager (plaques, four, hotte, réfrigérateur) sont REMPLACÉS par des modèles neufs et contemporains, au même emplacement.\n- Coin repas éventuel : table et chaises contemporaines au même emplacement.'}
- Ne déplace, n'agrandis et ne crée aucune fenêtre, porte ou ouverture.
- La rénovation reste réaliste, réalisable et cohérente avec le standing du logement.`
    : `PROJECTION MODERNISÉE (impératif) :
- Le champ « meublesPrincipauxAConserver » de l'analyse décrit ici le mobilier ACTUEL : chacun de ces meubles est remplacé par un équivalent contemporain, chaleureux et réaliste, même fonction, même emplacement, proportions adaptées.
- Le lit reste au même endroit, dans la même orientation. Ne bloque ni les circulations, ni les fenêtres, ni les portes, ni les radiateurs.
- Conserve les éléments intégrés et fixes (placards et dressings intégrés, cheminée, radiateurs).
- Les murs peuvent recevoir une peinture neutre (blanc cassé, beige, greige), sans masquer un défaut réel.${CONSIGNES_AGE[roomType] || ''}`;

  return `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : transformer une documentation de home staging très détaillée en UN SEUL prompt d'exécution compact, destiné au modèle gpt-image-2 via l'API d'édition d'image.

${option}

CONTRAINTES DE SORTIE :
- Entre 1200 et 2400 caractères.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré par priorités décroissantes, dans cet ordre strict :
  ${priorite1}
  PRIORITÉ 2 — désencombrer et dépersonnaliser : ce qu'il faut retirer précisément.
  ${priorite3}
  PRIORITÉ 4 — style, textiles, luminaires, plantes, accessoires, ambiance et lumière.
- Intègre les éléments concrets de l'analyse plutôt que des formules génériques.
- Termine par une courte ligne sur le rendu attendu (photoréaliste, lumière naturelle conservée).
- N'invente aucun élément d'architecture absent de la photo.

${imperatif}

PRIORITÉ DE L'OPTION :
Dans les règles générales de référence ci-dessous, les passages qui demandent de conserver le mobilier, la cuisine, la salle de bain ou les revêtements ne s'appliquent PAS à cette option. Leurs consignes d'architecture, de lumière, de circulation, de style et de réalisme restent valables.

AMBITION ESTHÉTIQUE :
Le résultat doit être une projection nettement visible, chaleureuse et vendeuse, tout en restant crédible dans le logement réel.

RÈGLES NON NÉGOCIABLES :
Les cinq règles ci-dessous seront AJOUTÉES AUTOMATIQUEMENT, mot pour mot, à la fin de ton texte.
Ne les recopie pas. Ton texte ne doit jamais les contredire.

=== RÈGLES NON NÉGOCIABLES (pour information) ===
${regles}

Réponds UNIQUEMENT avec le texte du prompt, sans guillemets, sans titre, sans commentaire.

=== ANALYSE DE LA PHOTO ===
${JSON.stringify(analysis, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À prendre en compte si elle reste compatible avec les règles non négociables.)` : ''}

=== RÈGLES GÉNÉRALES (référence) ===
${referenceRules}

=== MODULE DE LA PIÈCE : ${roomType} — ${renovation ? 'PROJECTION RÉNOVÉE' : 'PROJECTION MODERNISÉE'} (référence) ===
${roomPrompt}

${microTexts.length ? '=== AJUSTEMENTS SPÉCIFIQUES DÉTECTÉS ===\n' + microTexts.join('\n\n') : ''}`;
}

async function synthesizePromptProjection(params) {
  const { referenceRules, roomPrompt, microTexts, roomType } = params;
  const regles = reglesProjection(roomType);
  const instructions = construireInstructionsProjection(params);
  console.log(`[PromptSynthesis] Option ${PIECES_RENOVATION.includes(roomType) ? 'PROJECTION RÉNOVÉE' : 'PROJECTION MODERNISÉE'} (${roomType})`);

  let texteRedige;
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model: 'gpt-4o', max_tokens: 1800, messages: [{ role: 'user', content: instructions }] },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 90000 }
    );
    texteRedige = response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[PromptSynthesis] Erreur (projection):', err.response?.data || err.message);
    return [referenceRules, roomPrompt, ...microTexts, TITRE_REGLES, regles].join('\n\n');
  }

  const prompt = `${texteRedige.trim()}\n\n${TITRE_REGLES}\n${regles}`;
  console.log(`[PromptSynthesis] Prompt synthétisé : ${texteRedige.length} caractères rédigés + règles = ${prompt.length} caractères`);
  console.log(`[PromptSynthesis] PROMPT FINAL (${roomType}, projection) :\n${prompt}`);
  return prompt;
}

module.exports = {
  synthesizePrompt,
  reglesProjection,
  MENTION_RENOVATION,
  PIECES_RENOVATION,
  PIECES_CHAMBRE,
  detecterContradictions,
  tableBasseOubliee,
  assemblerPromptFinal,
  REGLES_IMPERATIVES,
  REGLES_IMPERATIVES_MODERNISEES,
  MODE_MODERNISE,
};

const axios = require('axios');

/**
 * Règles impératives issues des retours de validation.
 * Elles doivent apparaître dans TOUS les prompts finaux,
 * indépendamment du contenu de la bibliothèque.
 */
const REGLES_IMPERATIVES = `
1. MOBILIER EXISTANT — INTERDICTION ABSOLUE DE MODIFICATION
Les meubles présents sur la photo ne doivent subir AUCUNE transformation :
ne jamais ajouter de tiroir, de poignée, d'étagère ou de porte à un meuble existant ;
ne jamais changer ses dimensions, ses matériaux, sa finition ou sa couleur.
Un meuble conservé doit rester strictement identique à l'original.

2. DÉPERSONNALISATION COMPLÈTE
Retirer systématiquement de la scène : photographies de famille, portraits encadrés,
posters, affiches, dessins d'enfants, diplômes, souvenirs de voyage, collections
personnelles et tout objet permettant d'identifier les occupants.
Les murs peuvent recevoir une décoration neutre et impersonnelle à la place.

3. MATÉRIALISER LA FONCTION DE LA PIÈCE
Chaque espace doit être immédiatement identifiable par son usage.
Pour un salon : la présence d'une table basse devant l'assise principale est
OBLIGATOIRE, même de petite taille. Sans elle, l'espace n'est pas lisible comme un salon.
`.trim();

/**
 * Transforme la bibliothèque de prompts (longue) + l'analyse de la photo
 * en un prompt d'exécution compact et hiérarchisé pour gpt-image-2.
 */
async function synthesizePrompt({ analysis, referenceRules, roomPrompt, microTexts, roomType, commentaireClient }) {
  const instructions = `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : transformer une documentation de home staging très détaillée en UN SEUL prompt d'exécution compact, destiné au modèle gpt-image-2 via l'API d'édition d'image.

CONTRAINTES DE SORTIE :
- Entre 1400 et 2400 caractères maximum.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré par priorités décroissantes, dans cet ordre strict :
  PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective et les meubles principaux identifiés, SANS AUCUNE MODIFICATION de ces meubles.
  PRIORITÉ 2 — désencombrer et dépersonnaliser : ce qu'il faut retirer précisément.
  PRIORITÉ 3 — matérialiser la fonction de la pièce et améliorer la projection immobilière.
  PRIORITÉ 4 — style, textiles, accessoires, ambiance.
- Intègre les éléments concrets de l'analyse (noms des meubles, objets à retirer, atouts) plutôt que des formules génériques.
- Termine par une courte ligne sur le rendu attendu (photoréaliste, lumière naturelle conservée).
- N'invente aucun élément absent de la documentation ou de l'analyse.

OBLIGATION ABSOLUE :
Les trois règles ci-dessous doivent être reprises intégralement et explicitement dans le prompt final.
Elles priment sur toute autre considération et ne doivent jamais être résumées ni omises.

=== RÈGLES NON NÉGOCIABLES ===
${REGLES_IMPERATIVES}

Réponds UNIQUEMENT avec le texte du prompt final, sans guillemets, sans titre, sans commentaire.

=== ANALYSE DE LA PHOTO ===
${JSON.stringify(analysis, null, 2)}
${commentaireClient ? `\n=== DEMANDE PARTICULIÈRE DU CLIENT ===\n${commentaireClient}\n(À prendre en compte si elle reste compatible avec les règles non négociables et l'esprit du home staging.)` : ''}

=== RÈGLES GÉNÉRALES (référence) ===
${referenceRules}

=== MODULE DE LA PIÈCE : ${roomType} (référence) ===
${roomPrompt}

${microTexts.length ? '=== AJUSTEMENTS SPÉCIFIQUES DÉTECTÉS ===\n' + microTexts.join('\n\n') : ''}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 1400,
        messages: [{ role: 'user', content: instructions }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000,
      }
    );

    const prompt = response.data.choices[0].message.content.trim();
    console.log(`[PromptSynthesis] Prompt synthétisé : ${prompt.length} caractères`);
    return prompt;
  } catch (err) {
    console.error('[PromptSynthesis] Erreur:', err.response?.data || err.message);
    // Repli : version longue + règles impératives
    return [referenceRules, roomPrompt, ...microTexts, REGLES_IMPERATIVES].join('\n\n');
  }
}

module.exports = { synthesizePrompt };

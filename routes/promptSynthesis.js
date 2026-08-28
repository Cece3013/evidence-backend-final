
const axios = require('axios');

/**
 * Transforme la bibliothèque de prompts (longue) + l'analyse de la photo
 * en un prompt d'exécution compact et hiérarchisé pour gpt-image-2.
 */
async function synthesizePrompt({ analysis, referenceRules, roomPrompt, microTexts, roomType }) {
  const instructions = `Tu es un ingénieur prompt spécialisé en génération d'image immobilière.

Ta mission : transformer une documentation de home staging très détaillée en UN SEUL prompt d'exécution compact, destiné au modèle gpt-image-2 via l'API d'édition d'image.

CONTRAINTES DE SORTIE :
- Entre 1200 et 2200 caractères maximum.
- Rédigé en français, à l'impératif, en instructions directes.
- Structuré par priorités décroissantes, dans cet ordre strict :
  PRIORITÉ 1 — conserver l'architecture, les volumes, la perspective et les meubles principaux identifiés.
  PRIORITÉ 2 — désencombrer : ce qu'il faut retirer précisément.
  PRIORITÉ 3 — améliorer la projection immobilière : circulations, mise en valeur des atouts.
  PRIORITÉ 4 — style, textiles, accessoires, ambiance.
- Intègre les éléments concrets de l'analyse (noms des meubles, objets à retirer, atouts) plutôt que des formules génériques.
- Termine par une courte ligne sur le rendu attendu (photoréaliste, lumière naturelle conservée).
- N'invente aucun élément absent de la documentation ou de l'analyse.

Réponds UNIQUEMENT avec le texte du prompt final, sans guillemets, sans titre, sans commentaire.

=== ANALYSE DE LA PHOTO ===
${JSON.stringify(analysis, null, 2)}

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
        max_tokens: 1200,
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
    // Repli : on renvoie la version longue plutôt que d'échouer
    return [referenceRules, roomPrompt, ...microTexts].join('\n\n');
  }
}

module.exports = { synthesizePrompt };


const axios = require('axios');

/**
 * Analyse une photo de pièce habitée et détecte les caractéristiques
 * nécessitant l'application de micro-modules.
 * Retourne un tableau de clés de micro-modules, ex: ['petit_espace', 'piece_sombre']
 */
async function analyzePhoto(imageUrl) {
  const instructions = `Tu analyses une photo d'une pièce d'habitation pour un service de home staging immobilier.

Évalue ces 4 critères et réponds UNIQUEMENT avec un objet JSON, sans texte autour, sans balises markdown :

{
  "petit_espace": true/false,
  "piece_sombre": true/false,
  "piece_encombree": true/false,
  "decoration_datee": true/false
}

Critères :
- petit_espace : la pièce paraît petite ou étroite, la circulation semble contrainte
- piece_sombre : luminosité naturelle faible, ambiance sombre, peu de lumière
- piece_encombree : nombreux objets visibles, surfaces chargées, désordre apparent
- decoration_datee : mobilier, papier peint, couleurs ou style visiblement démodés

Sois mesuré : ne réponds true que si le critère est nettement visible.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const raw = response.data.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const detected = Object.keys(parsed).filter((key) => parsed[key] === true);
    console.log(`[AnalyzePhoto] Micro-modules détectés: ${detected.join(', ') || 'aucun'}`);
    return detected;
  } catch (err) {
    console.error('[AnalyzePhoto] Erreur analyse:', err.response?.data || err.message);
    // En cas d'échec, on continue sans micro-module plutôt que de bloquer la génération
    return [];
  }
}

module.exports = { analyzePhoto };

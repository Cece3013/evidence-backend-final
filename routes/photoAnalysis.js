
const axios = require('axios');

/**
 * Analyse riche d'une photo de pièce habitée.
 * Retourne un objet structuré décrivant ce qu'il faut conserver, supprimer,
 * les contraintes spatiales et les micro-modules à activer.
 */
async function analyzePhotoRich(imageUrl, roomType) {
  const instructions = `Tu es un home stager immobilier expérimenté. Tu analyses une photo d'une pièce HABITÉE avant une intervention de home staging virtuel.

Le type de pièce annoncé par le client est : "${roomType}".

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown :

{
  "typePieceObserve": "ce que tu vois réellement (peut différer du type annoncé)",
  "photoExploitable": true/false,
  "raisonNonExploitable": "vide si exploitable",
  "meublesPrincipauxAConserver": ["liste courte des meubles structurants à garder tels quels"],
  "objetsASupprimer": ["objets personnels, encombrants ou démodés à retirer"],
  "coinRepas": "conserver" | "creer" | "non_pertinent",
  "contraintesSpatiales": ["circulations, radiateurs, ouvertures à ne pas bloquer"],
  "atoutsAMettreEnValeur": ["cheminée, parquet, grandes fenêtres, vue, hauteur sous plafond..."],
  "risqueErreurSpatiale": "faible" | "moyen" | "eleve",
  "standingObserve": "simple" | "intermediaire" | "haut_de_gamme",
  "microModules": ["petit_espace" et/ou "piece_sombre" et/ou "piece_encombree" et/ou "decoration_datee"]
}

Règles :
- photoExploitable = false uniquement si la photo est floue, trop sombre pour distinguer la pièce, ou cadrée de façon inutilisable.
- microModules : n'inclus un critère que s'il est nettement visible.
- Sois précis et concret dans les listes, pas générique.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 900,
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
        timeout: 60000,
      }
    );

    const raw = response.data.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    console.log(`[PhotoAnalysis] Pièce: ${parsed.typePieceObserve} — micro-modules: ${(parsed.microModules || []).join(', ') || 'aucun'} — risque spatial: ${parsed.risqueErreurSpatiale}`);
    return parsed;
  } catch (err) {
    console.error('[PhotoAnalysis] Erreur:', err.response?.data || err.message);
    // Analyse minimale de secours : la génération continue sans blocage
    return {
      typePieceObserve: roomType,
      photoExploitable: true,
      meublesPrincipauxAConserver: [],
      objetsASupprimer: [],
      coinRepas: 'non_pertinent',
      contraintesSpatiales: [],
      atoutsAMettreEnValeur: [],
      risqueErreurSpatiale: 'moyen',
      standingObserve: 'intermediaire',
      microModules: [],
    };
  }
}

module.exports = { analyzePhotoRich };

const axios = require('axios');

// Correction du 13/10/2026 (validée) :
// 1. La photo envoyée à l'analyse est une version allégée en JPG de 1 200 px
//    (même méthode que les biens vides), pour éviter les échecs de
//    téléchargement côté OpenAI (« Error while downloading file »).
// 2. En cas d'échec : une nouvelle tentative, puis ARRÊT (erreur levée) au lieu
//    de continuer avec une analyse vide. Le générateur passe alors la photo en
//    « Erreur » dans Notion (après ses propres essais).
// Correction du 15/10/2026 (validée, étape 2 — point B5) :
// l'analyse liste TOUS les meubles principaux (dont les chaises : nombre exact
// et modèles) avec une courte description, et ne met jamais un meuble
// principal dans les objets à supprimer. Modèle (gpt-4o) et réglages inchangés.
const NOMBRE_TENTATIVES = 2;
const PAUSE_ENTRE_TENTATIVES_MS = 3000;

function versionAllegee(url) {
  if (typeof url !== 'string' || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/w_1200,q_auto:good,f_jpg/');
}

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
  "meublesPrincipauxAConserver": ["TOUS les meubles principaux visibles : canapés, fauteuils, tables basses, tables à manger, chaises, meubles TV, bibliothèques, rangements — chacun avec une courte description (couleur, matière, piètement). Pour les chaises : nombre exact, et préciser si elles sont différentes, ex. « 2 chaises différentes : 1 en velours bleu, 1 en bois cintré »"],
  "objetsASupprimer": ["objets personnels, accessoires et petits meubles d'appoint encombrants à retirer — jamais un meuble principal"],
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
- meublesPrincipauxAConserver : liste chaque meuble principal séparément ; n'oublie aucune chaise, même partiellement visible ou au premier plan.
- Un meuble principal ne figure jamais dans objetsASupprimer.
- Sois précis et concret dans les listes, pas générique.`;

  const urlAnalyse = versionAllegee(imageUrl);
  let derniereErreur = null;

  for (let tentative = 1; tentative <= NOMBRE_TENTATIVES; tentative++) {
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
                { type: 'image_url', image_url: { url: urlAnalyse } },
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
      // Diagnostic (journal uniquement) : analyse complète, pour vérifier les meubles repérés
      console.log(`[PhotoAnalysis] ANALYSE COMPLÈTE (${roomType}) :\n${JSON.stringify(parsed, null, 2)}`);
      return parsed;
    } catch (err) {
      derniereErreur = err;
      console.error(`[PhotoAnalysis] Erreur (tentative ${tentative}/${NOMBRE_TENTATIVES}):`, err.response?.data || err.message);
      if (tentative < NOMBRE_TENTATIVES) {
        await new Promise((r) => setTimeout(r, PAUSE_ENTRE_TENTATIVES_MS));
      }
    }
  }

  // Plus d'analyse de secours vide : sans analyse, on ne génère pas
  // (sinon les meubles existants ne sont plus protégés).
  const detail = derniereErreur?.response?.data?.error?.message || derniereErreur?.message || 'erreur inconnue';
  throw new Error(`Analyse de la photo impossible après ${NOMBRE_TENTATIVES} tentatives : ${detail}`);
}

module.exports = { analyzePhotoRich };

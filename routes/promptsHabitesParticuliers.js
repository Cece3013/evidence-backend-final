const { GLOBAL_HOME_STAGING_RULES_HABITES_PARTICULIERS } = require('./globalRulesHabitesParticuliers');
const roomPrompts = require('./roomPromptsHabitesParticuliers');
const microModules = require('./microModulesHabitesParticuliers');
const { analyzePhoto } = require('./analyzePhoto');

/**
 * Construit le prompt complet pour un bien habité (particulier).
 * @param {string} roomType - clé de la pièce (ex: 'salon', 'cuisine', 'chambre_parentale')
 * @param {string} imageUrl - URL Cloudinary de la photo à analyser
 * @returns {Promise<{prompt: string, detectedModules: string[]}>}
 */
async function buildPromptHabitesParticuliers(roomType, imageUrl) {
  const roomPrompt = roomPrompts[roomType];

  if (!roomPrompt) {
    console.error(`[PromptsHabites] Type de pièce inconnu: "${roomType}"`);
    throw new Error(`Type de pièce non reconnu : ${roomType}`);
  }

  // Détection automatique des micro-modules à appliquer
  const detectedModules = await analyzePhoto(imageUrl);

  const microTexts = detectedModules
    .map((key) => microModules[key])
    .filter(Boolean);

  const parts = [
    GLOBAL_HOME_STAGING_RULES_HABITES_PARTICULIERS,
    roomPrompt,
    ...microTexts,
  ];

  const prompt = parts.join('\n\n');

  console.log(`[PromptsHabites] Prompt construit — pièce: ${roomType}, micro-modules: ${detectedModules.join(', ') || 'aucun'}`);

  return { prompt, detectedModules };
}

module.exports = { buildPromptHabitesParticuliers };

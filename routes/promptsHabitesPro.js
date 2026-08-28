const { GLOBAL_HOME_STAGING_RULES_HABITES_PRO } = require('./globalRulesHabitesPro');
const roomPrompts = require('./roomPromptsHabitesPro');
const microModules = require('./microModulesHabitesParticuliers');
const { analyzePhoto } = require('./analyzePhoto');

/**
 * Construit le prompt complet pour un bien habité (client PRO).
 * @param {string} roomType - clé de la pièce (ex: 'salon', 'cuisine', 'jardin')
 * @param {string} imageUrl - URL Cloudinary de la photo à analyser
 * @returns {Promise<{prompt: string, detectedModules: string[]}>}
 */
async function buildPromptHabitesPro(roomType, imageUrl) {
  const roomPrompt = roomPrompts[roomType];

  if (!roomPrompt) {
    console.error(`[PromptsHabitesPro] Type de pièce inconnu: "${roomType}"`);
    throw new Error(`Type de pièce non reconnu : ${roomType}`);
  }

  const detectedModules = await analyzePhoto(imageUrl);

  const microTexts = detectedModules
    .map((key) => microModules[key])
    .filter(Boolean);

  const parts = [
    GLOBAL_HOME_STAGING_RULES_HABITES_PRO,
    roomPrompt,
    ...microTexts,
  ];

  const prompt = parts.join('\n\n');

  console.log(`[PromptsHabitesPro] Prompt construit — pièce: ${roomType}, micro-modules: ${detectedModules.join(', ') || 'aucun'}`);

  return { prompt, detectedModules };
}

module.exports = { buildPromptHabitesPro };

const { GLOBAL_HOME_STAGING_RULES_HABITES_PRO } = require('./globalRulesHabitesPro');
const roomPrompts = require('./roomPromptsHabitesPro');
const microModules = require('./microModulesHabitesParticuliers');
const { analyzePhotoRich } = require('./photoAnalysis');
const { synthesizePrompt } = require('./promptSynthesis');

async function buildPromptHabitesPro(roomType, imageUrl) {
  const roomPrompt = roomPrompts[roomType];
  if (!roomPrompt) {
    console.error(`[PromptsHabitesPro] Type de pièce inconnu: "${roomType}"`);
    throw new Error(`Type de pièce non reconnu : ${roomType}`);
  }

  const analysis = await analyzePhotoRich(imageUrl, roomType);
  const detectedModules = analysis.microModules || [];
  const microTexts = detectedModules.map((k) => microModules[k]).filter(Boolean);

  const prompt = await synthesizePrompt({
    analysis,
    referenceRules: GLOBAL_HOME_STAGING_RULES_HABITES_PRO,
    roomPrompt,
    microTexts,
    roomType,
  });

  return { prompt, detectedModules, analysis };
}

module.exports = { buildPromptHabitesPro };

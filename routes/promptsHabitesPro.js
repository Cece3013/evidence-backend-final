const { GLOBAL_HOME_STAGING_RULES_HABITES_PRO } = require('./globalRulesHabitesPro');
const roomPrompts = require('./roomPromptsHabitesPro');
const roomPromptsModernise = require('./roomPromptsHabitesProModernise');
const microModules = require('./microModulesHabitesParticuliers');
const { analyzePhotoRich } = require('./photoAnalysis');
const { synthesizePrompt } = require('./promptSynthesis');

// options.mode = 'projection_modernisee' : option PRO choisie par l'agent
// (salon et salon / salle à manger uniquement). Sans option : version validée, inchangée.
async function buildPromptHabitesPro(roomType, imageUrl, options = {}) {
  const modernise = options.mode === 'projection_modernisee' && Boolean(roomPromptsModernise[roomType]);
  const roomPrompt = modernise ? roomPromptsModernise[roomType] : roomPrompts[roomType];
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
    ...(modernise ? { mode: 'projection_modernisee' } : {}),
  });

  return { prompt, detectedModules, analysis };
}

module.exports = { buildPromptHabitesPro };

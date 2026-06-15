const { GLOBAL_HOME_STAGING_RULES } = require('./globalRules');
const roomPrompts = require('./roomPrompts');
const negativePrompts = require('./negativePrompts');

function getRoomType(roomTypeId, roomSubTypeId) {
  if (roomTypeId === 'chambre') {
    if (roomSubTypeId === 'bebe') return 'chambre_bebe';
    if (roomSubTypeId === 'enfant') return 'chambre_enfant';
    if (roomSubTypeId === 'ado') return 'chambre_ado';
    return 'chambre_adulte';
  }
  // Les clés correspondent exactement à roomPrompts.js
  const map = {
    salon: 'salon',
    cuisine: 'cuisine',
    salle_manger: 'salon', // fallback salon si pas de clé salle_manger
    bureau: 'salon',       // fallback salon si pas de clé bureau
    entree: 'salon',       // fallback salon si pas de clé entree
    salle_bain: 'salle_bain',
    buanderie: 'salon',    // fallback
    suite_parentale: 'chambre_adulte',
    terrasse: 'terrasse',
  };
  return map[roomTypeId] || 'salon';
}

function buildPrompt({ roomTypeId, roomSubTypeId, roomSize = 'medium', variant = 1 }) {
  const roomType = getRoomType(roomTypeId, roomSubTypeId);

  const roomData = roomPrompts[roomType] || roomPrompts['salon'];
  const layout = variant === 2 ? roomData.variant2 : roomData.variant1;

  const prompt = `${GLOBAL_HOME_STAGING_RULES}\n\n${layout}`;

  const roomNegative = negativePrompts[roomType] || '';
  const negative_prompt = `${negativePrompts.global}, ${roomNegative}`;

  return { prompt, negative_prompt };
}

module.exports = { buildPrompt, getRoomType };

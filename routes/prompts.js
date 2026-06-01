const { GLOBAL_HOME_STAGING_RULES } = require('./globalRules');
const roomPrompts = require('./roomPrompts');
const negativePrompts = require('./negativePrompts');

function getRoomType(roomTypeId, roomSubTypeId) {
  if (roomTypeId === 'chambre') {
    if (roomSubTypeId === 'bebe') return 'baby_bedroom';
    if (roomSubTypeId === 'enfant') return 'child_bedroom';
    if (roomSubTypeId === 'ado') return 'teen_bedroom';
    return 'adult_bedroom';
  }
  const map = {
    salon: 'living_room',
    cuisine: 'kitchen',
    salle_manger: 'dining_room',
    bureau: 'home_office',
    entree: 'entrance',
    salle_bain: 'bathroom',
    buanderie: 'laundry_room',
    suite_parentale: 'master_suite',
    terrasse: 'terrace',
  };
  return map[roomTypeId] || 'living_room';
}

function getTerraceSize(roomSize) {
  if (roomSize === 'small') return 'terrace_small';
  if (roomSize === 'large') return 'terrace_large';
  return 'terrace_small';
}

function buildPrompt({ roomTypeId, roomSubTypeId, roomSize = 'medium', variant = 1 }) {
  let roomType = getRoomType(roomTypeId, roomSubTypeId);
  
  if (roomType === 'terrace') {
    roomType = getTerraceSize(roomSize);
  }

  const roomData = roomPrompts[roomType] || roomPrompts['living_room'];
  const layout = variant === 2 ? roomData.variant2 : roomData.variant1;

  const prompt = `${GLOBAL_HOME_STAGING_RULES}

${layout}`;

  const roomNegative = negativePrompts[roomType] || '';
  const negative_prompt = `${negativePrompts.global}, ${roomNegative}`;

  return { prompt, negative_prompt };
}

module.exports = { buildPrompt, getRoomType };
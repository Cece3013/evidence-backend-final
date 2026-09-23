// backend/routes/notionHelpers.js
// Petites fonctions partagées pour parler à Notion (appels directs axios,
// comme dans le reste du backend). Toutes les lectures de listes passent
// par queryAll, qui lit TOUTES les pages de résultats (Notion : 100 max par page).
const axios = require('axios');

function headers() {
  return {
    'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

// Toutes les pages de résultats
async function queryAll(databaseId, body = {}) {
  const results = [];
  let cursor;
  do {
    const payload = { ...body, page_size: 100 };
    if (cursor) payload.start_cursor = cursor;
    const res = await axios.post(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      payload,
      { headers: headers() }
    );
    results.push(...res.data.results);
    cursor = res.data.has_more ? res.data.next_cursor : undefined;
  } while (cursor);
  return results;
}

// Une seule page de résultats (quand on veut volontairement en limiter le nombre)
async function queryPage(databaseId, body = {}) {
  const res = await axios.post(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    body,
    { headers: headers() }
  );
  return res.data.results;
}

async function getPage(pageId) {
  const res = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, { headers: headers() });
  return res.data;
}

async function patchPage(pageId, properties) {
  await axios.patch(`https://api.notion.com/v1/pages/${pageId}`, { properties }, { headers: headers() });
}

async function createPage(databaseId, properties) {
  const res = await axios.post(
    'https://api.notion.com/v1/pages',
    { parent: { database_id: databaseId }, properties },
    { headers: headers() }
  );
  return res.data;
}

// Texte complet d'une colonne de type Texte
function lireTexte(prop) {
  return (prop?.rich_text || []).map((t) => t.plain_text).join('');
}

// Référence dossier "STG-89" à partir de la colonne "Référence Dossier"
function lireReference(properties) {
  const ref = properties?.['Référence Dossier']?.unique_id;
  return ref ? `${ref.prefix || ''}-${ref.number}` : null;
}

module.exports = { queryAll, queryPage, getPage, patchPage, createPage, lireTexte, lireReference };

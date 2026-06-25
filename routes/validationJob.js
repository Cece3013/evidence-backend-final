const axios = require('axios');
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function updatePhotoStatus(databaseId, photoPage) {
  if (photoPage.properties['Validé']?.checkbox === true &&
      photoPage.properties['Statut']?.select?.name !== 'Validé' &&
      photoPage.properties['Statut']?.select?.name !== 'Envoyé') {
    await notion.pages.update({
      page_id: photoPage.id,
      properties: { "Statut": { select: { name: "Validé" } } },
    });
    console.log(`[ValidationJob] Photo ${photoPage.id} → Validé`);
  }
}

async function checkProjectComplete(databaseId, relationProperty, parentPage, parentDbId, statusProperty, parentLabel) {
  // Récupérer toutes les photos liées à ce parent
  const photosRes = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: relationProperty,
      relation: { contains: parentPage.id },
    },
  });

  const photos = photosRes.results;
  if (photos.length === 0) return false;

  const allValidated = photos.every(p =>
    p.properties['Statut']?.select?.name === 'Validé' ||
    p.properties['Statut']?.select?.name === 'Envoyé'
  );

  if (!allValidated) return false;

  // Marquer toutes les photos comme "Envoyé"
  for (const photo of photos) {
    if (photo.properties['Statut']?.select?.name !== 'Envoyé') {
      await notion.pages.update({
        page_id: photo.id,
        properties: { "Statut": { select: { name: "Envoyé" } } },
      });
    }
  }

  console.log(`[ValidationJob] ✅ ${parentLabel} ${parentPage.id} entièrement validé → Envoyé`);
  return true;
}

async function runValidationCheck() {
  console.log('[ValidationJob] Démarrage vérification...');

  try {
    // 1. Vérifier les photos particuliers : mettre à jour le statut si cochées
    const particuliersPhotos = await notion.databases.query({
      database_id: process.env.NOTION_PHOTOS_DATABASE_ID,
      filter: { property: 'Validé', checkbox: { equals: true } },
    });

    for (const photo of particuliersPhotos.results) {
      await updatePhotoStatus(process.env.NOTION_PHOTOS_DATABASE_ID, photo);
    }

    // 2. Vérifier les photos PRO : mettre à jour le statut si cochées
    const proPhotos = await notion.databases.query({
      database_id: process.env.NOTION_PHOTOS_PRO_DATABASE_ID,
      filter: { property: 'Validé', checkbox: { equals: true } },
    });

    for (const photo of proPhotos.results) {
      await updatePhotoStatus(process.env.NOTION_PHOTOS_PRO_DATABASE_ID, photo);
    }

    console.log('[ValidationJob] Vérification terminée.');
  } catch (err) {
    console.error('[ValidationJob] Erreur:', err.response?.data || err.message);
  }
}

module.exports = { runValidationCheck };

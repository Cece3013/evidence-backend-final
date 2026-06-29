const axios = require('axios');

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function queryDatabase(databaseId, filter) {
  const res = await axios.post(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    filter ? { filter } : {},
    { headers: NOTION_HEADERS }
  );
  return res.data.results;
}

async function updatePage(pageId, properties) {
  await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    { properties },
    { headers: NOTION_HEADERS }
  );
}

async function retrievePage(pageId) {
  const res = await axios.get(
    `https://api.notion.com/v1/pages/${pageId}`,
    { headers: NOTION_HEADERS }
  );
  return res.data;
}

async function updatePhotoStatus(databaseId, photoPage) {
  if (photoPage.properties['Validé']?.checkbox === true &&
      photoPage.properties['Statut']?.select?.name !== 'Validé' &&
      photoPage.properties['Statut']?.select?.name !== 'Envoyé') {
    await updatePage(photoPage.id, { "Statut": { select: { name: "Validé" } } });
    console.log(`[ValidationJob] Photo ${photoPage.id} → Validé`);
  }
}

async function checkProjectComplete(databaseId, relationProperty, parentPage) {
  const photos = await queryDatabase(databaseId, {
    property: relationProperty,
    relation: { contains: parentPage.id },
  });

  if (photos.length === 0) return false;

  return photos.every(p => p.properties['Statut']?.select?.name === 'Validé');
}

async function sendClientEmail(parentPage, type) {
  let email, name;

  if (type === 'particulier') {
    email = parentPage.properties['Email']?.email;
    name = parentPage.properties['Nom du Client']?.title?.[0]?.plain_text || 'cher client';
  } else {
    const relationId = parentPage.properties['Nom entreprise']?.relation?.[0]?.id;
    if (relationId) {
      const subPage = await retrievePage(relationId);
      email = subPage.properties['Email']?.email;
      name = subPage.properties['Nom entreprise']?.title?.[0]?.plain_text || 'cher client';
    }
  }

  if (!email) {
    console.log('[ValidationJob] Email introuvable, envoi annulé.');
    return;
  }

  try {
    await axios.post('https://api.resend.com/emails', {
      from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
      to: email,
      subject: '✨ Vos photos sont prêtes !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
          <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 24px;">
            <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${name},</h2>
            <p style="color: #555; line-height: 1.6;">Toutes vos photos ont été validées et sont maintenant disponibles ${type === 'pro' ? "dans votre espace professionnel" : "dans l'application"}.</p>
          </div>
        </div>
      `,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`[ValidationJob] ✅ Email envoyé à ${email}`);
  } catch (err) {
    console.error('[ValidationJob] Erreur email:', err.message);
  }
}

async function runValidationCheck() {
  console.log('[ValidationJob] Démarrage vérification...');

  try {
    const particuliersPhotos = await queryDatabase(process.env.NOTION_PHOTOS_DATABASE_ID, {
      property: 'Validé', checkbox: { equals: true },
    });
    for (const photo of particuliersPhotos) {
      await updatePhotoStatus(process.env.NOTION_PHOTOS_DATABASE_ID, photo);
    }

    const proPhotos = await queryDatabase(process.env.NOTION_PHOTOS_PRO_DATABASE_ID, {
      property: 'Validé', checkbox: { equals: true },
    });
    for (const photo of proPhotos) {
      await updatePhotoStatus(process.env.NOTION_PHOTOS_PRO_DATABASE_ID, photo);
    }
    const clients = await queryDatabase(process.env.NOTION_DATABASE_ID, {
     property: 'Statut', select: { does_not_equal: 'Terminé' },
    });

    for (const client of clients) {
      const isComplete = await checkProjectComplete(
        process.env.NOTION_PHOTOS_DATABASE_ID, 'Nom du Client', client
      );
      if (isComplete) {
        await sendClientEmail(client, 'particulier');
        await updatePage(client.id, { "Statut": { select: { name: "Terminé" } } });
      }
    }

    const projects = await queryDatabase(process.env.NOTION_PRO_PROJECTS_DATABASE_ID, {
      property: 'Statut', select: { does_not_equal: 'Livré' },
    });

    for (const project of projects) {
      const isComplete = await checkProjectComplete(
        process.env.NOTION_PHOTOS_PRO_DATABASE_ID, 'Projet', project
      );
      if (isComplete) {
        await sendClientEmail(project, 'pro');
        await updatePage(project.id, { "Statut": { select: { name: "Livré" } } });
      }
    }

    console.log('[ValidationJob] Vérification terminée.');
  } catch (err) {
    console.error('[ValidationJob] Erreur:', err.response?.data || err.message);
  }
}

module.exports = { runValidationCheck };

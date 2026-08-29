// backend/routes/clientAuth.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Codes de connexion en mémoire : { email: { code, expiresAt, attempts } }
global.clientCodes = global.clientCodes || {};

const CODE_VALIDITY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Récupère toutes les fiches client Notion correspondant à un email
 * (comparaison insensible à la casse)
 */
async function findClientPages(email) {
  const query = await axios.post(
    `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
    {
      page_size: 100,
      sorts: [{ property: 'Date de commande', direction: 'descending' }],
    },
    { headers: NOTION_HEADERS }
  );

  const target = email.toLowerCase().trim();
  return query.data.results.filter((p) => {
    const mail = p.properties['Email']?.email;
    return mail && mail.toLowerCase().trim() === target;
  });
}

// ─── POST /api/auth/send-code ────────────────────────────────────────────────
router.post('/auth/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  const normalized = email.toLowerCase().trim();

  try {
    const pages = await findClientPages(normalized);

    if (pages.length === 0) {
      return res.status(404).json({
        error: "Aucune commande trouvée pour cet email. Vérifiez l'adresse utilisée lors de votre commande.",
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    global.clientCodes[normalized] = {
      code,
      expiresAt: Date.now() + CODE_VALIDITY_MS,
      attempts: 0,
    };

    const clientName = pages[0].properties['Nom du Client']?.title?.[0]?.plain_text || '';

    await axios.post('https://api.resend.com/emails', {
      from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
      to: normalized,
      subject: `Votre code de connexion : ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
          <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center;">
            <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${clientName || ''},</h2>
            <p style="color: #555; line-height: 1.6;">Voici votre code de connexion :</p>
            <p style="font-size: 34px; font-weight: bold; letter-spacing: 10px; color: #b88a44; margin: 24px 0;">
              ${code}
            </p>
            <p style="color: #888; font-size: 12px;">
              Ce code est valable 10 minutes.<br/>
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
          </div>
        </div>
      `,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[ClientAuth] Code envoyé à ${normalized}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[ClientAuth] Erreur send-code:', err.response?.data || err.message);
    res.status(500).json({ error: "Impossible d'envoyer le code." });
  }
});

// ─── POST /api/auth/verify-code ──────────────────────────────────────────────
router.post('/auth/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email et code requis.' });
  }

  const normalized = email.toLowerCase().trim();
  const entry = global.clientCodes[normalized];

  if (!entry) {
    return res.status(400).json({ error: 'Aucun code en cours. Demandez un nouveau code.' });
  }

  if (Date.now() > entry.expiresAt) {
    delete global.clientCodes[normalized];
    return res.status(400).json({ error: 'Code expiré. Demandez un nouveau code.' });
  }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    delete global.clientCodes[normalized];
    return res.status(429).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
  }

  if (entry.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Code incorrect.' });
  }

  delete global.clientCodes[normalized];

  try {
    const pages = await findClientPages(normalized);
    const name = pages[0]?.properties['Nom du Client']?.title?.[0]?.plain_text || normalized.split('@')[0];

    console.log(`[ClientAuth] Connexion réussie : ${normalized}`);
    res.json({
      success: true,
      userId: normalized,
      email: normalized,
      name,
    });
  } catch (err) {
    console.error('[ClientAuth] Erreur verify-code:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// ─── GET /api/orders/client/:email ───────────────────────────────────────────
router.get('/orders/client/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email || '');
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  try {
    const pages = await findClientPages(email);

    // Photos de tous les dossiers du client
    const photosQuery = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PHOTOS_DATABASE_ID}/query`,
      { page_size: 100 },
      { headers: NOTION_HEADERS }
    );

    const orders = pages
      .filter((p) => p.properties['Paiement réussi']?.checkbox === true)
      .map((p) => {
        const props = p.properties;
        const ref = props['Référence Dossier']?.unique_id;
        const reference = ref ? `${ref.prefix || ''}-${ref.number}` : '—';
        const typePrestation = props['Type de prestation']?.select?.name || '';
        const isHabite = typePrestation.toLowerCase().includes('habité');

        // Rapport PDF
        const pdfProp = props['Rapport PDF'];
        let pdfUrl = null;
        if (pdfProp?.url) pdfUrl = pdfProp.url;
        else if (pdfProp?.files?.length) {
          pdfUrl = pdfProp.files[0].file?.url || pdfProp.files[0].external?.url || null;
        }

        // Photos liées à ce dossier
        const photos = photosQuery.data.results.filter((ph) =>
          ph.properties['Nom du Client']?.relation?.some((r) => r.id === p.id)
        );

        const apres = photos
          .filter((ph) => ph.properties['Type']?.select?.name === 'Après')
          .map((ph) => ({
            url: ph.properties['URL photo']?.url || null,
            piece: ph.properties['Pièce']?.select?.name || '—',
            valide: ph.properties['Validé']?.checkbox === true,
          }))
          .filter((ph) => ph.url);

        const apresValidees = apres.filter((ph) => ph.valide);
        const pretALivrer = isHabite
          ? !!pdfUrl
          : apres.length > 0 && apresValidees.length === apres.length;

        return {
          orderId: reference,
          reference,
          isHabite,
          formulaLabel: props['Formule']?.select?.name || '',
          createdAt: props['Date de commande']?.date?.start || null,
          pdfUrl: isHabite && pretALivrer ? pdfUrl : null,
          photos: !isHabite && pretALivrer ? apresValidees : [],
          pretALivrer,
        };
      });

    res.json({ orders });
  } catch (err) {
    console.error('[ClientAuth] Erreur orders:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors du chargement des commandes.' });
  }
});

module.exports = router;

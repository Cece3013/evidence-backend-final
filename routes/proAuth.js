const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Stockage temporaire des codes en mémoire (email -> { code, expiresAt })
global.proAuthCodes = global.proAuthCodes || {};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── POST /api/pro/auth/send-code ─────────────────────────────────────────────
router.post('/send-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requis.' });
  }

  try {
    // 1. Vérifier que l'email correspond à un abonnement PRO actif dans Notion
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_DATABASE_ID}/query`,
      {
        filter: {
          property: 'Email',
          email: { equals: email.toLowerCase().trim() },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      }
    );

    const results = response.data.results;
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Aucun abonnement trouvé avec cet email.' });
    }

    // 2. Générer le code et le stocker temporairement (10 min)
    const code = generateCode();
    global.proAuthCodes[email.toLowerCase().trim()] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // 3. Envoyer le code par email via Resend
    await axios.post('https://api.resend.com/emails', {
      from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
      to: email,
      subject: `Votre code de connexion : ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #f8f7f4;">
          <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #c8a96e; margin: 0; font-size: 20px;">Evidence Home Staging</h1>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 32px; text-align: center;">
            <p style="color: #555; margin-bottom: 16px;">Votre code de connexion :</p>
            <p style="font-size: 32px; font-weight: bold; color: #1a1a1a; letter-spacing: 4px; margin: 16px 0;">${code}</p>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">Ce code expire dans 10 minutes.</p>
          </div>
        </div>
      `,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[ProAuth] Code envoyé à ${email}`);
    res.json({ success: true, message: 'Code envoyé.' });

  } catch (err) {
    console.error('[ProAuth] Erreur send-code:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du code.' });
  }
});

// ─── POST /api/pro/auth/verify-code ───────────────────────────────────────────
router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'Email et code requis.' });
  }

  const stored = global.proAuthCodes[normalizedEmail];

  if (!stored || stored.code !== code) {
    return res.status(401).json({ error: 'Code invalide.' });
  }

  if (Date.now() > stored.expiresAt) {
    delete global.proAuthCodes[normalizedEmail];
    return res.status(401).json({ error: 'Code expiré, veuillez en demander un nouveau.' });
  }

  // Code valide → supprimer et générer le token de session
  delete global.proAuthCodes[normalizedEmail];

  const token = jwt.sign(
    { email: normalizedEmail },
    process.env.JWT_SECRET || 'evidence-secret-temp',
    { expiresIn: '30d' }
  );

  console.log(`[ProAuth] ✅ Connexion réussie: ${normalizedEmail}`);
  res.json({ success: true, token });
});
// ─── GET /api/pro/auth/me ──────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'evidence-secret-temp');
    const email = decoded.email;

    const response = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_DATABASE_ID}/query`,
      {
        filter: {
          property: 'Email',
          email: { equals: email },
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      }
    );

    const results = response.data.results;
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Abonnement non trouvé.' });
    }

    const page = results[0].properties;
    const offerId = page['Offre']?.select?.name || '';

    res.json({
      companyName: page['Nom entreprise']?.title?.[0]?.plain_text || '—',
      email: page['Email']?.email || email,
      phone: page['Téléphone']?.phone_number || '—',
      address: page['Adresse']?.rich_text?.[0]?.plain_text || '—',
      siret: page['SIRET']?.rich_text?.[0]?.plain_text || '—',
      offerId,
      offerName: offerId === 'pro_starter' ? 'PRO Starter'
               : offerId === 'pro_business' ? 'PRO Business'
               : 'PRO Agency',
      status: page['Statut']?.select?.name || '—',
      subscriptionDate: page['Date souscription']?.date?.start || '—',
    });

  } catch (err) {
    console.error('[ProAuth] Erreur /me:', err.response?.data || err.message);
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
});
// ─── GET /api/pro/auth/invoices ────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'evidence-secret-temp');
    const email = decoded.email;

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 1. Trouver le client Stripe par email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) {
      return res.json({ invoices: [] });
    }

    const customerId = customers.data[0].id;

    // 2. Récupérer ses factures
    const invoices = await stripe.invoices.list({ customer: customerId, limit: 12 });

    const formatted = invoices.data.map(inv => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      date: new Date(inv.created * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      number: inv.number,
    }));

    res.json({ invoices: formatted });

  } catch (err) {
    console.error('[ProAuth] Erreur /invoices:', err.message);
    res.status(401).json({ error: 'Erreur lors de la récupération des factures.' });
  }
});
module.exports = router;

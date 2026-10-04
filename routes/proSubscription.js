const express = require('express');
const axios = require('axios');
const router = express.Router();

// Prix Stripe des abonnements, choisis par le SERVEUR à partir de l'offre
// (la page web ne peut plus imposer un prix). Pour passer en mode réel :
// créer les 3 abonnements dans Stripe en mode live, puis renseigner ces
// 3 variables dans Railway (aucune modification de code).
const PRIX_PRO = {
  pro_starter: process.env.STRIPE_PRICE_PRO_STARTER || 'price_1TjdIzBtigY0O7pljXLznLIs',
  pro_business: process.env.STRIPE_PRICE_PRO_BUSINESS || 'price_1TjdJIBtigY0O7plmAViGr2c',
  pro_agency: process.env.STRIPE_PRICE_PRO_AGENCY || 'price_1TjdJbBtigY0O7plhTK1GXe4',
};
const SITE_URL = 'https://evidence-platform-pied.vercel.app';

router.post('/subscribe', async (req, res) => {
  const { companyName, siret, email, phone, address, offerId, subscriptionDate, cgvAcceptees } = req.body;
  const priceId = PRIX_PRO[offerId];

  if (!priceId || !companyName || !siret || !email || !phone || !address) {
    return res.status(400).json({ error: 'Données manquantes' });
  }
  // Acceptation des CGV obligatoire (case cochée sur la page d'inscription)
  if (cgvAcceptees !== true) {
    return res.status(400).json({ error: 'Merci d\'accepter les conditions générales de vente.' });
  }

  try {
    console.log('[ProSubscription] Nouvelle demande abonnement:', { companyName, offerId, email });

    const stripeCustomerResponse = await axios.post(
      'https://api.stripe.com/v1/customers',
      `email=${encodeURIComponent(email)}&description=${encodeURIComponent(companyName)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const customerId = stripeCustomerResponse.data.id;

    const checkoutSessionResponse = await axios.post(
      'https://api.stripe.com/v1/checkout/sessions',
      new URLSearchParams({
        'payment_method_types[0]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        customer: customerId,
        success_url: `${SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/inscription`,
        // Preuve de l'acceptation des CGV, conservée dans Stripe
        'metadata[cgvAcceptees]': new Date().toISOString(),
        'subscription_data[metadata][cgvAcceptees]': new Date().toISOString(),
      }),
      {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const checkoutUrl = checkoutSessionResponse.data.url;
    const sessionId = checkoutSessionResponse.data.id;

    const notionPayload = {
      parent: { database_id: process.env.NOTION_PRO_DATABASE_ID },
      properties: {
        'Nom entreprise': { title: [{ text: { content: companyName } }] },
        'SIRET': { rich_text: [{ text: { content: siret } }] },
        'Email': { email: email },
        'Téléphone': { phone_number: phone },
        'Adresse': { rich_text: [{ text: { content: address } }] },
        'Offre': { select: { name: offerId } },
        'Date souscription': { date: { start: subscriptionDate } },
        'Statut': { select: { name: 'En attente paiement' } },
        'Session stripe': { rich_text: [{ text: { content: sessionId } }] },
      },
    };

    await axios.post('https://api.notion.com/v1/pages', notionPayload, {
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      },
    });

    res.json({ success: true, checkoutUrl, sessionId });

  } catch (error) {
    console.error('[ProSubscription Error]:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.error?.message || 'Erreur lors de la création de l\'abonnement',
    });
  }
});

// ─── GET /api/pro/subscription/:sessionId ─────────────────────────────────────
router.get('/subscription/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_PRO_DATABASE_ID}/query`,
      {
        filter: {
          property: 'Session stripe',
          rich_text: { equals: sessionId },
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
      return res.status(404).json({ error: 'Abonnement non trouvé' });
    }

    const page = results[0].properties;
    const offerId = page['Offre']?.select?.name || '';

    res.json({
      companyName: page['Nom entreprise']?.title?.[0]?.plain_text || '—',
      siret: page['SIRET']?.rich_text?.[0]?.plain_text || '—',
      email: page['Email']?.email || '—',
      phone: page['Téléphone']?.phone_number || '—',
      address: page['Adresse']?.rich_text?.[0]?.plain_text || '—',
      offerId,
      offerName: offerId === 'pro_starter' ? 'PRO Starter' 
               : offerId === 'pro_business' ? 'PRO Business' 
               : 'PRO Agency',
      subscriptionDate: page['Date souscription']?.date?.start || '—',
      status: page['Statut']?.select?.name || '—',
      price: offerId === 'pro_starter' ? 49 
           : offerId === 'pro_business' ? 99 
           : 199,
    });

  } catch (error) {
    console.error('[ProSubscription GET Error]:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

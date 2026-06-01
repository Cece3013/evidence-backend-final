const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/subscribe', async (req, res) => {
  const { priceId, companyName, siret, email, phone, address, offerId, subscriptionDate } = req.body;

  if (!priceId || !companyName || !siret || !email || !phone || !address || !offerId) {
    return res.status(400).json({ error: 'Données manquantes' });
  }

  try {
    console.log('[ProSubscription] Nouvelle demande abonnement:', { companyName, offerId, email });

    // 1. Créer le client Stripe
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
    console.log('[Stripe] Client créé:', customerId);

    // 2. Créer la session de checkout pour l'abonnement
    const checkoutSessionResponse = await axios.post(
      'https://api.stripe.com/v1/checkout/sessions',
      new URLSearchParams({
        payment_method_types: 'card',
        line_items__0__price: priceId,
        line_items__0__quantity: 1,
        mode: 'subscription',
        customer: customerId,
        success_url: 'https://evidence-homestaging.fr/pro-account?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://evidence-homestaging.fr/offers',
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
    console.log('[Stripe] Checkout créé:', sessionId);

    // 3. Envoyer les données à Notion
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
        'Session Stripe': { rich_text: [{ text: { content: sessionId } }] },
      },
    };

    await axios.post(
      'https://api.notion.com/v1/pages',
      notionPayload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        },
      }
    );

    console.log('[Notion] Abonnement PRO créé');

    // 4. Répondre avec l'URL de checkout
    res.json({
      success: true,
      checkoutUrl: checkoutUrl,
      sessionId: sessionId,
    });

  } catch (error) {
    console.error('[ProSubscription Error]:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.error?.message || 'Erreur lors de la création de l\'abonnement',
    });
  }
});

module.exports = router;
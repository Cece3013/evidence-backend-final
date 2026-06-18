const express = require('express');
const Stripe = require('stripe');
const axios = require('axios');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Webhook] ❌ Signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Répondre immédiatement à Stripe
  res.json({ received: true });

  // Traiter l'événement
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const sessionId = session.id;
    console.log('[Webhook] ✅ Paiement réussi pour session:', sessionId);

   try {
      await updateNotionSubscriptionStatus(sessionId, 'Actif');
    } catch (err) {
      console.error('[Webhook] Erreur mise à jour Notion:', err.message);
      console.error('[Webhook] Détails:', JSON.stringify(err.response?.data || err));
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    console.log('[Webhook] ❌ Paiement échoué');
  }
}),

async function updateNotionSubscriptionStatus(sessionId, newStatus) {
  // 1. Chercher la fiche Notion PRO via le sessionId
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
    console.log('[Webhook] Aucune fiche Notion trouvée pour cette session');
    return;
  }

  const pageId = results[0].id;

  // 2. Mettre à jour le statut
  await axios.patch(
    `https://api.notion.com/v1/pages/${pageId}`,
    {
      properties: {
        'Statut': { select: { name: newStatus } },
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

  console.log('[Webhook] ✅ Statut Notion mis à jour:', newStatus);
}

module.exports = router;

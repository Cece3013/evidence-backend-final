// backend/routes/payments.js
const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Montants en centimes
const FORMULA_PRICES = {
  // Biens vides — projection immobilière
  decouverte:       { amount: 3900,  label: 'Découverte — 2 photos aménagées',   maxPhotos: 2, type: 'vide' },
  essentielle:      { amount: 8900,  label: 'Essentielle — 5 photos aménagées',  maxPhotos: 5, type: 'vide' },
  performance:      { amount: 13900, label: 'Performance — 8 photos aménagées',  maxPhotos: 8, type: 'vide' },
  // Biens habités — analyse et home staging
  essentiel_habite: { amount: 7900,  label: 'Essentiel — 2 pièces',              maxRooms: 2,  type: 'habite' },
  premium_habite:   { amount: 15900, label: 'Premium — 5 pièces',                maxRooms: 5,  type: 'habite' },
};

const OPTION_PRICES = {
  photo_supplementaire:  { amount: 1200, label: 'Photo supplémentaire',   multiple: true  },
  optimisation_annonce:  { amount: 4900, label: 'Optimisation Annonce',   multiple: false },
  pack_vente_acceleree:  { amount: 6900, label: 'Pack Vente Accélérée',   multiple: false },
};

/**
 * Calcule le montant total (formule + options) en centimes.
 * options attendu : [{ id: 'photo_supplementaire', quantity: 3 }, { id: 'optimisation_annonce' }]
 */
function computeTotal(formula, options = []) {
  let total = formula.amount;
  const details = [];

  for (const opt of options) {
    const option = OPTION_PRICES[opt.id];
    if (!option) continue;
    const qty = option.multiple ? Math.max(1, parseInt(opt.quantity) || 1) : 1;
    total += option.amount * qty;
    details.push(`${option.label}${qty > 1 ? ` x${qty}` : ''}`);
  }

  return { total, details };
}

// ─── POST /api/payments/create-intent ────────────────────────────────────────────
router.post('/create-intent', async (req, res, next) => {
  try {
    const { formulaId, metadata = {}, options = [] } = req.body;
    const formula = FORMULA_PRICES[formulaId];
    if (!formula) {
      console.error(`[Payments] Formule inconnue reçue: "${formulaId}"`);
      return res.status(400).json({ error: 'Formule inconnue.' });
    }

    const { total, details } = computeTotal(formula, options);
    const orderId = `ORD-${uuidv4().split('-')[0].toUpperCase()}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        orderId,
        formulaId,
        formulaLabel: formula.label,
        options: details.join(', ') || 'aucune',
        createdAt: new Date().toISOString(),
      },
      description: `EVIDENCE Home Staging — ${formula.label}`,
      statement_descriptor_suffix: 'EV HOMESTAGING',
    });

    console.log(`[Payments] Intent créé — ${formulaId} (${total / 100}€) — options: ${details.join(', ') || 'aucune'}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
      amount: total,
      formulaLabel: formula.label,
    });
  } catch (err) {
    console.error('[Payments] Erreur create-intent:', err.message);
    next(err);
  }
});

// ─── POST /api/payments/confirm ──────────────────────────────────────────────────
router.post('/confirm', async (req, res, next) => {
  try {
    const { orderId, paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Paiement non confirmé.' });
    }

    const { metadata, amount } = paymentIntent;
    const priceTTC = amount / 100;
    const priceHT  = parseFloat((priceTTC / 1.20).toFixed(2));
    const tva      = parseFloat((priceTTC - priceHT).toFixed(2));

    const invoice = {
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString(),
      clientName:  metadata.clientName  || 'Client',
      clientEmail: metadata.clientEmail || paymentIntent.receipt_email || '',
      formulaName: FORMULA_PRICES[metadata.formulaId]?.label || metadata.formulaId,
      options:     metadata.options || 'aucune',
      roomType:    `${metadata.roomType || ''}${metadata.multiVue === 'true' ? ' · Multi-vue' : ''}`,
      decoStyle:   metadata.decoStyle || '',
      photoCount:  parseInt(metadata.photoCount || '0'),
      multiVue:    metadata.multiVue === 'true',
      priceHT,
      tva,
      priceTTC,
    };

    console.log(`[Payments] Paiement confirmé — ${orderId} — ${priceTTC}€`);
    res.json({ invoice, orderId });
  } catch (err) {
    console.error('[Payments] Erreur confirm:', err.message);
    next(err);
  }
});

// ─── GET /api/payments/formulas ──────────────────────────────────────────────────
// Permet au web et au mobile de récupérer les tarifs à jour sans les coder en dur
router.get('/formulas', (req, res) => {
  res.json({
    formulas: Object.entries(FORMULA_PRICES).map(([id, f]) => ({
      id,
      label: f.label,
      price: f.amount / 100,
      maxPhotos: f.maxPhotos || null,
      maxRooms: f.maxRooms || null,
      type: f.type,
    })),
    options: Object.entries(OPTION_PRICES).map(([id, o]) => ({
      id,
      label: o.label,
      price: o.amount / 100,
      multiple: o.multiple,
    })),
  });
});

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `EHS-${year}-${seq}`;
}

module.exports = router;

// backend/routes/payments.js
const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FORMULA_PRICES = {
  essentiel:      { amount: 990,  label: 'Essentiel — 6 photos',    maxPhotos: 6  },
  essentiel_plus: { amount: 1990, label: 'Essentiel+ — 15 photos',  maxPhotos: 15 },
  premium:        { amount: 4900, label: 'Premium — 3 pièces',      maxRooms: 3   },
  premium_plus:   { amount: 9900, label: 'Premium+ — 6 pièces',     maxRooms: 6   },
};

// ─── POST /api/payments/create-intent ────────────────────────────────────────────
router.post('/create-intent', async (req, res, next) => {
  try {
    const { formulaId, metadata } = req.body;
    const formula = FORMULA_PRICES[formulaId];
    if (!formula) return res.status(400).json({ error: 'Formule inconnue.' });

    const orderId = `ORD-${uuidv4().split('-')[0].toUpperCase()}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: formula.amount,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        orderId,
        formulaId,
        formulaLabel: formula.label,
        createdAt: new Date().toISOString(),
      },
      description: `EVIDENCE Home Staging — ${formula.label}`,
      statement_descriptor_suffix: 'EV HOMESTAGING',
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
    });
  } catch (err) {
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

    // Invoice data returned to app for display
    const invoice = {
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString(),
      clientName:  metadata.clientName  || 'Client',
      clientEmail: metadata.clientEmail || paymentIntent.receipt_email || '',
      formulaName: FORMULA_PRICES[metadata.formulaId]?.label || metadata.formulaId,
      roomType:    `${metadata.roomType}${metadata.multiVue === 'true' ? ' · Multi-vue' : ''}`,
      decoStyle:   metadata.decoStyle || '',
      photoCount:  parseInt(metadata.photoCount || '0'),
      multiVue:    metadata.multiVue === 'true',
      priceHT,
      tva,
      priceTTC,
      pdfUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/invoices/${orderId}.pdf`,
    };

    res.json({ invoice, orderId });
  } catch (err) {
    next(err);
  }
});

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `EHS-${year}-${seq}`;
}

module.exports = router;

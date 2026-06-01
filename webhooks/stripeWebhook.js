const express = require('express');
const Stripe = require('stripe');
const { Resend } = require('resend');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  res.json({ received: true });
});

async function sendInvoiceEmail(data) {
  if (!resend) {
    console.log('[Email] Resend non configure');
    return;
  }
  try {
    await resend.emails.send({
      from: 'facturation@evidence-homestaging.fr',
      to: data.toEmail,
      subject: 'Votre facture EVIDENCE Home Staging',
      html: '<p>Merci pour votre commande.</p>',
    });
  } catch (err) {
    console.error('[Email error]', err.message);
  }
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return 'EHS-' + year + '-' + seq;
}

module.exports = router;

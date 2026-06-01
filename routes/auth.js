// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Store codes en mémoire (code + expiration 10 min)
const codes = new Map();

// ─── POST /api/auth/send-code ─────────────────────────────────────────────────
router.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  codes.set(email.toLowerCase(), { code, expires });

  try {
    await resend.emails.send({
      from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
      to: email,
      subject: 'Votre code de connexion Evidence',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto;">
          <div style="background: #1a1a1a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: #C8A96E; font-size: 18px; font-weight: 500; margin: 0;">Evidence Home Staging</h1>
          </div>
          <div style="background: #fff; padding: 32px; border: 0.5px solid #e0e0d8; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="font-size: 14px; color: #555; margin-bottom: 24px;">Votre code de connexion :</p>
            <div style="background: #f5f5f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 600; letter-spacing: 10px; color: #1a1a1a;">${code}</span>
            </div>
            <p style="font-size: 12px; color: #888;">Ce code expire dans 10 minutes.</p>
          </div>
        </div>
      `,
    });
    console.log('[Auth] Code envoyé à :', email);
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Erreur envoi code :', err.message);
    res.status(500).json({ error: 'Impossible d\'envoyer le code.' });
  }
});

// ─── POST /api/auth/verify-code ───────────────────────────────────────────────
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email et code requis.' });

  const stored = codes.get(email.toLowerCase());
  if (!stored) return res.status(400).json({ error: 'Code expiré ou inexistant.' });
  if (Date.now() > stored.expires) {
    codes.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Code expiré.' });
  }
  if (stored.code !== code) return res.status(400).json({ error: 'Code incorrect.' });

  codes.delete(email.toLowerCase());

  // Chercher les infos client dans les commandes existantes
  const order = global.habitedOrders?.find(o => o.clientEmail?.toLowerCase() === email.toLowerCase());
  const name = order?.clientName || email.split('@')[0];

  res.json({
    success: true,
    userId: email.toLowerCase(),
    email: email.toLowerCase(),
    name,
  });
});

// ─── GET /api/orders/client/:email ────────────────────────────────────────────
// Retourne toutes les commandes d'un client
router.get('/client-orders/:email', (req, res) => {
  const email = req.params.email.toLowerCase();
  const orders = (global.habitedOrders || []).filter(
    o => o.clientEmail?.toLowerCase() === email
  );
  res.json({ orders });
});

module.exports = router;
// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripeWebhook = require('./webhooks/stripeWebhook');
const paymentsRouter = require('./routes/payments');
const ordersRouter = require('./routes/orders');
const aiRouter = require('./routes/ai');
const invoicesRouter = require('./routes/invoices');
const notionRoutes = require('./routes/notion');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const stagingRouter = require('./routes/staging');
const proSubscriptionRouter = require('./routes/proSubscription');

const app = express();

// ─── Trust proxy (requis pour Railway / reverse proxy) ───────────────────────────
app.set('trust proxy', 1);

// ─── Security ────────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));

// ─── Stripe webhook MUST use raw body ────────────────────────────────────────────
app.use('/webhooks', stripeWebhook);

// ─── JSON body parser for all other routes ───────────────────────────────────────
app.use(express.json({ limit: '25mb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
});

const freeTrialLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.FREE_TRIAL_REQUESTS_PER_IP || '1'),
  keyGenerator: (req) => req.ip,
  message: {
    error: 'Essai gratuit déjà utilisé.',
    retryAfter: '24h',
    upsell: 'Découvrez nos formules payantes pour des résultats illimités.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────────
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/ai', aiRouter);
app.use('/api/staging', stagingRouter);
app.use('/api/ai/free-trial', freeTrialLimiter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/notion', notionRoutes);
app.use('/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders/client', authRouter);
app.use('/api/pro', proSubscriptionRouter);

// ─── Health check ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// ─── Error handler ────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));

module.exports = app;
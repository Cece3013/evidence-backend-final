// backend/routes/orders.js
const express = require('express');
const router  = express.Router();

// In-memory store (replace with Firestore / PostgreSQL in production)
const orders = new Map();
// Store global pour commandes biens habités (accessible depuis admin)
global.habitedOrders = global.habitedOrders || [];
// ─── GET /api/orders/:orderId ─────────────────────────────────────────────────
router.get('/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  res.json(order);
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { orderId, ...data } = req.body;
  orders.set(orderId, { orderId, ...data, createdAt: new Date().toISOString() });
  res.json({ orderId, status: 'created' });
});

// ─── PATCH /api/orders/:orderId/status ───────────────────────────────────────
router.patch('/:orderId/status', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  order.status = req.body.status;
  order.updatedAt = new Date().toISOString();
  if (req.body.resultUrl)   order.resultUrl   = req.body.resultUrl;
  if (req.body.pdfUrl)      order.pdfUrl      = req.body.pdfUrl;
  if (req.body.score)       order.score       = req.body.score;
  if (req.body.regenCount !== undefined) order.regenCount = req.body.regenCount;
  orders.set(req.params.orderId, order);
  res.json(order);
});

// ─── POST /api/orders/:orderId/regen ─────────────────────────────────────────
// Increments regen counter — regeneration is free/unlimited, no charge
router.post('/:orderId/regen', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  order.regenCount = (order.regenCount || 0) + 1;
  order.lastRegenAt = new Date().toISOString();
  orders.set(req.params.orderId, order);
  res.json({ orderId: req.params.orderId, regenCount: order.regenCount, message: 'Régénération gratuite lancée.' });
});

module.exports = router;


// ─────────────────────────────────────────────────────────────────────────────────
// backend/routes/invoices.js
// ─────────────────────────────────────────────────────────────────────────────────
const express2  = require('express');
const AWS       = require('aws-sdk');
const router2   = express2.Router();
const s3        = new AWS.S3({ region: process.env.AWS_REGION });

// ─── GET /api/invoices/:invoiceId/pdf  (signed S3 URL) ───────────────────────
router2.get('/:invoiceId/pdf', async (req, res, next) => {
  try {
    const key    = `invoices/${req.params.invoiceId}.pdf`;
    const params = { Bucket: process.env.S3_BUCKET, Key: key, Expires: 3600 };
    const url    = s3.getSignedUrl('getObject', params);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/invoices/user/:userId ──────────────────────────────────────────
// Returns list of invoice metadata for account screen
router2.get('/user/:userId', async (req, res) => {
  // In production: query Firestore/DB for user invoices
  res.json({ invoices: [] });
});
// ─── POST /api/orders/habite ──────────────────────────────────────────────────
// Enregistre une commande bien habité avec les infos client
router.post('/habite', (req, res) => {
  const order = {
    orderId: req.body.orderId || `ORD-${Date.now()}`,
    clientName: req.body.clientName,
    clientEmail: req.body.clientEmail,
    formulaLabel: req.body.formulaLabel,
    propertyType: req.body.propertyType,
    roomCount: req.body.roomCount,
    photoUrls: req.body.photoUrls || [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    pdfUrl: null,
  };
  global.habitedOrders.push(order);
  console.log('[Orders] Commande bien habité enregistrée :', order.orderId);
  res.json({ success: true, orderId: order.orderId });
});
module.exports = router2;

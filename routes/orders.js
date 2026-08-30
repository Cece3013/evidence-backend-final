// backend/routes/orders.js
// Les commandes sont désormais gérées dans Notion.
// Ce routeur est conservé pour compatibilité mais ne contient plus de logique active.
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Les commandes sont gérées via Notion.' });
});

module.exports = router;

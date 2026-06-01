const express = require('express');
const router = express.Router();
const axios = require('axios');

const NOTION_BASE = 'https://api.notion.com/v1';
const headers = {
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

// Créer un client dans Notion
router.post('/clients', async (req, res) => {
  const { name, email, formulaId, propertyType, roomCount } = req.body;
  try {
    const response = await axios.post(`${NOTION_BASE}/pages`, {
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        Nom: { title: [{ text: { content: name || 'Client' } }] },
        Email: { email: email || '' },
        Formule: { select: { name: formulaId || 'essentiel' } },
        TypeBien: { select: { name: propertyType || 'Appartement' } },
        Pièces: { rich_text: [{ text: { content: roomCount || '' } }] },
        Statut: { select: { name: 'Nouveau' } },
        Date: { date: { start: new Date().toISOString() } },
      },
    }, { headers });
    res.json({ success: true, pageId: response.data.id });
  } catch (err) {
    console.error('[Notion error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Mettre à jour le statut d'un client
router.patch('/clients/:pageId', async (req, res) => {
  const { pageId } = req.params;
  const { statut, pdfUrl } = req.body;
  try {
    await axios.patch(`${NOTION_BASE}/pages/${pageId}`, {
      properties: {
        Statut: { select: { name: statut } },
        ...(pdfUrl && { PDF: { url: pdfUrl } }),
      },
    }, { headers });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
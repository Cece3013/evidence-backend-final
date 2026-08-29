// backend/routes/admin.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');
const router = express.Router();

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY;

const NOTION_HEADERS = {
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Middleware protection accès admin
function requireAdmin(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).send('Accès refusé.');
  }
  next();
}

// ─── GET /admin — Page HTML admin ────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evidence — Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f0; color: #1a1a1a; }
    .topbar { background: #1a1a1a; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .topbar h1 { color: #C8A96E; font-size: 16px; font-weight: 500; }
    .topbar span { color: rgba(255,255,255,0.4); font-size: 12px; }
    .container { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    .section-title { font-size: 10px; font-weight: 600; color: #888; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px; }
    .card { background: #fff; border: 0.5px solid #e0e0d8; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .order-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 0.5px solid #f0f0e8; }
    .order-row:last-child { border-bottom: none; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: #C8A96E22; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; color: #C8A96E; flex-shrink: 0; }
    .order-info { flex: 1; }
    .order-name { font-size: 13px; font-weight: 500; }
    .order-meta { font-size: 11px; color: #888; margin-top: 2px; }
    .badge { font-size: 9px; padding: 3px 8px; border-radius: 20px; font-weight: 600; }
    .badge-wait { background: #fdf6ec; color: #b8892e; }
    .badge-done { background: #edf7ee; color: #3a7a3e; }
    .upload-zone { border: 1.5px dashed #d0d0c8; border-radius: 10px; padding: 32px; text-align: center; background: #fafaf8; cursor: pointer; transition: border-color 0.2s; }
    .upload-zone:hover, .upload-zone.drag { border-color: #C8A96E; background: #fdf8f0; }
    .upload-zone p { font-size: 13px; color: #888; margin-top: 8px; }
    .upload-zone strong { font-size: 14px; color: #1a1a1a; }
    select { width: 100%; padding: 10px 12px; border: 0.5px solid #d0d0c8; border-radius: 8px; font-size: 13px; margin-bottom: 12px; background: #fff; }
    .btn { width: 100%; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
    .btn-primary { background: #1a1a1a; color: #C8A96E; }
    .btn-primary:hover { background: #2a2a2a; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .notif { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 12px; background: #f5f5f0; border-radius: 8px; font-size: 11px; color: #888; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #C8A96E; flex-shrink: 0; }
    .success { background: #edf7ee; color: #3a7a3e; border-radius: 8px; padding: 12px; font-size: 13px; text-align: center; margin-top: 12px; display: none; }
    .error { background: #fdf0f0; color: #a33a3a; border-radius: 8px; padding: 12px; font-size: 13px; text-align: center; margin-top: 12px; display: none; }
    #file-name { font-size: 12px; color: #C8A96E; margin-top: 8px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Evidence — Admin</h1>
    <span>Accès privé</span>
  </div>

  <div class="container">

    <p class="section-title">Commandes biens habités</p>
    <div class="card" id="orders-list">
      <div style="font-size:13px;color:#888;text-align:center;padding:16px;">Chargement...</div>
    </div>

    <p class="section-title">Envoyer un rapport PDF</p>
    <div class="card">
      <select id="client-select">
        <option value="">Sélectionnez un client...</option>
      </select>

      <div class="upload-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
        <div style="font-size:32px;">📄</div>
        <strong>Glissez le PDF ici</strong>
        <p>ou cliquez pour choisir le fichier</p>
        <div id="file-name"></div>
      </div>
      <input type="file" id="file-input" accept=".pdf" style="display:none">

      <div style="height:12px;"></div>
      <button class="btn btn-primary" id="send-btn" onclick="sendPdf()" disabled>
        Envoyer au client
      </button>

      <div class="notif">
        <div class="dot"></div>
        Email automatique + rapport visible sur la page de suivi du client
      </div>

      <div class="success" id="success-msg">PDF envoyé avec succès !</div>
      <div class="error" id="error-msg">Erreur lors de l'envoi. Réessayez.</div>
    </div>

  </div>

  <script>
    const ADMIN_KEY = new URLSearchParams(window.location.search).get('key');
    let selectedFile = null;

    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') setFile(file);
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) setFile(e.target.files[0]);
    });

    function setFile(file) {
      selectedFile = file;
      document.getElementById('file-name').textContent = file.name;
      checkReady();
    }

    document.getElementById('client-select').addEventListener('change', checkReady);

    function checkReady() {
      const hasClient = document.getElementById('client-select').value !== '';
      const hasFile = selectedFile !== null;
      document.getElementById('send-btn').disabled = !(hasClient && hasFile);
    }

    async function loadOrders() {
      try {
        const res = await fetch('/admin/orders?key=' + ADMIN_KEY);
        const data = await res.json();
        const list = document.getElementById('orders-list');
        const select = document.getElementById('client-select');

        if (!data.orders || data.orders.length === 0) {
          list.innerHTML = '<div style="font-size:13px;color:#888;text-align:center;padding:16px;">Aucune commande</div>';
          return;
        }

        list.innerHTML = data.orders.map(o => {
          const initials = (o.clientName || 'CL').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
          return \`<div class="order-row">
            <div class="avatar">\${initials}</div>
            <div class="order-info">
              <div class="order-name">\${o.clientName || 'Client'}</div>
              <div class="order-meta">\${o.reference} · \${o.formule || ''} · \${formatDate(o.dateCommande)}</div>
            </div>
            <span class="badge \${o.pdfLivre ? 'badge-done' : 'badge-wait'}">\${o.pdfLivre ? 'Livré' : 'En attente'}</span>
          </div>\`;
        }).join('');

        const enAttente = data.orders.filter(o => !o.pdfLivre);
        select.innerHTML = '<option value="">Sélectionnez un client...</option>' +
          enAttente.map(o => \`<option value="\${o.pageId}">\${o.clientName || 'Client'} — \${o.reference}</option>\`).join('');
      } catch(e) {
        console.error(e);
        document.getElementById('orders-list').innerHTML =
          '<div style="font-size:13px;color:#a33a3a;text-align:center;padding:16px;">Erreur de chargement</div>';
      }
    }

    async function sendPdf() {
      const pageId = document.getElementById('client-select').value;
      if (!pageId || !selectedFile) return;

      const btn = document.getElementById('send-btn');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours...';

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
          const res = await fetch('/admin/send-pdf?key=' + ADMIN_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId, pdfBase64: base64, fileName: selectedFile.name })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('success-msg').style.display = 'block';
            document.getElementById('error-msg').style.display = 'none';
            selectedFile = null;
            document.getElementById('file-name').textContent = '';
            loadOrders();
          } else {
            throw new Error(data.error || 'Erreur inconnue');
          }
        } catch(err) {
          document.getElementById('error-msg').style.display = 'block';
          document.getElementById('success-msg').style.display = 'none';
          document.getElementById('error-msg').textContent = 'Erreur : ' + err.message;
        }
        btn.disabled = false;
        btn.textContent = 'Envoyer au client';
      };
      reader.readAsDataURL(selectedFile);
    }

    function formatDate(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    loadOrders();
  </script>
</body>
</html>`);
});

// ─── GET /admin/orders — Commandes biens habités payées, depuis Notion ────────
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const query = await axios.post(
      `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`,
      {
        page_size: 100,
        sorts: [{ property: 'Date de commande', direction: 'descending' }],
      },
      { headers: NOTION_HEADERS }
    );

    const orders = query.data.results
      .filter((p) => {
        const props = p.properties;
        const paye = props['Paiement réussi']?.checkbox === true;
        const type = props['Type de prestation']?.select?.name || '';
        return paye && type.toLowerCase().includes('habité');
      })
      .map((p) => {
        const props = p.properties;
        const ref = props['Référence Dossier']?.unique_id;
        const pdfProp = props['Rapport PDF'];
        const pdfLivre = !!(pdfProp?.url || pdfProp?.files?.length);

        return {
          pageId: p.id,
          reference: ref ? `${ref.prefix || ''}-${ref.number}` : '—',
          clientName: props['Nom du Client']?.title?.[0]?.plain_text || 'Client',
          clientEmail: props['Email']?.email || null,
          formule: props['Formule']?.select?.name || '',
          dateCommande: props['Date de commande']?.date?.start || null,
          pdfLivre,
        };
      });

    res.json({ orders });
  } catch (err) {
    console.error('[Admin] Erreur orders:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur lors du chargement des commandes.' });
  }
});

// ─── POST /admin/send-pdf ─────────────────────────────────────────────────────
router.post('/send-pdf', requireAdmin, async (req, res) => {
  const { pageId, pdfBase64, fileName } = req.body;
  if (!pageId || !pdfBase64) {
    return res.status(400).json({ error: 'pageId et pdfBase64 requis.' });
  }

  try {
    // 1. Lire la fiche client dans Notion
    const page = await axios.get(`https://api.notion.com/v1/pages/${pageId}`, { headers: NOTION_HEADERS });
    const props = page.data.properties;
    const clientName = props['Nom du Client']?.title?.[0]?.plain_text || 'Client';
    const clientEmail = props['Email']?.email || null;
    const ref = props['Référence Dossier']?.unique_id;
    const reference = ref ? `${ref.prefix || ''}-${ref.number}` : 'dossier';

    // 2. Upload du PDF sur Cloudinary (signé)
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `rapport-${reference}`;
    const folder = 'evidence-homestaging/rapports';
    const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const form = new FormData();
    form.append('file', Buffer.from(pdfBase64, 'base64'), { filename: fileName || 'rapport.pdf' });
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('timestamp', timestamp);
    form.append('api_key', process.env.CLOUDINARY_API_KEY);
    form.append('signature', signature);

    const cloudRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
      form,
      { headers: form.getHeaders(), maxBodyLength: Infinity }
    );

    const pdfUrl = cloudRes.data.secure_url;
    console.log('[Admin] PDF uploadé :', pdfUrl);

    // 3. Enregistrer le PDF dans Notion
    await axios.patch(
      `https://api.notion.com/v1/pages/${pageId}`,
      {
        properties: {
          'Rapport PDF': {
            files: [{ name: fileName || 'rapport.pdf', external: { url: pdfUrl } }],
          },
          'PDF livré': { checkbox: true },
        },
      },
      { headers: NOTION_HEADERS }
    );
    console.log('[Admin] Notion mis à jour —', reference);

    // 4. Email au client
    if (clientEmail) {
      const suiviUrl = `https://evidence-platform-pied.vercel.app/commande/suivi/${reference}`;
      await axios.post('https://api.resend.com/emails', {
        from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
        to: clientEmail,
        subject: 'Votre rapport home staging est prêt !',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
            <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
              <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
            </div>
            <div style="background: #fff; border-radius: 12px; padding: 24px;">
              <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${clientName},</h2>
              <p style="color: #555; line-height: 1.6;">
                Votre rapport home staging personnalisé est prêt. Nos experts ont analysé votre bien et préparé des recommandations détaillées pour optimiser votre vente.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${pdfUrl}" style="background: #b88a44; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; display: inline-block;">
                  Télécharger mon rapport PDF
                </a>
              </div>
              <p style="color: #888; font-size: 12px; text-align: center;">
                Vous pouvez aussi le retrouver à tout moment sur votre page de suivi :<br/>
                <a href="${suiviUrl}" style="color: #8c6b34;">${suiviUrl}</a>
              </p>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">Référence : ${reference}</p>
            </div>
          </div>
        `,
      }, {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('[Admin] Email envoyé à :', clientEmail);
    }

    res.json({ success: true, pdfUrl });
  } catch (err) {
    console.error('[Admin] Erreur send-pdf:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

module.exports = router;

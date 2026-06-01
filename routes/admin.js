// backend/routes/admin.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY;

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

    <p class="section-title">Commandes en attente</p>
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
        Email automatique + PDF visible dans l'espace client
      </div>

      <div class="success" id="success-msg">PDF envoyé avec succès !</div>
      <div class="error" id="error-msg">Erreur lors de l'envoi. Réessayez.</div>
    </div>

  </div>

  <script>
    const ADMIN_KEY = new URLSearchParams(window.location.search).get('key');
    let selectedFile = null;

    // Drag & drop
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
          list.innerHTML = '<div style="font-size:13px;color:#888;text-align:center;padding:16px;">Aucune commande en attente</div>';
          return;
        }

        list.innerHTML = data.orders.map(o => {
          const initials = (o.clientName || 'CL').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
          return \`<div class="order-row">
            <div class="avatar">\${initials}</div>
            <div class="order-info">
              <div class="order-name">\${o.clientName || 'Client'}</div>
              <div class="order-meta">\${o.formulaLabel || ''} · \${o.roomCount || ''} pièces · reçu le \${formatDate(o.createdAt)}</div>
            </div>
            <span class="badge \${o.pdfUrl ? 'badge-done' : 'badge-wait'}">\${o.pdfUrl ? 'Livré' : 'En attente'}</span>
          </div>\`;
        }).join('');

        select.innerHTML = '<option value="">Sélectionnez un client...</option>' +
          data.orders.map(o => \`<option value="\${o.orderId}">\${o.clientName || 'Client'} — \${o.formulaLabel || ''}</option>\`).join('');
      } catch(e) {
        console.error(e);
      }
    }

    async function sendPdf() {
      const orderId = document.getElementById('client-select').value;
      if (!orderId || !selectedFile) return;

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
            body: JSON.stringify({ orderId, pdfBase64: base64, fileName: selectedFile.name })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('success-msg').style.display = 'block';
            document.getElementById('error-msg').style.display = 'none';
            loadOrders();
          } else {
            throw new Error(data.error);
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

// ─── GET /admin/orders — Liste commandes biens habités ────────────────────────
router.get('/orders', requireAdmin, (req, res) => {
  // On importe le store orders depuis orders.js
  // Pour l'instant on retourne depuis le module orders
  const ordersRoute = require('./orders');
  // On accède directement à la Map via un helper
  res.json({ orders: global.habitedOrders || [] });
});

// ─── POST /admin/send-pdf ─────────────────────────────────────────────────────
router.post('/send-pdf', requireAdmin, async (req, res) => {
  const { orderId, pdfBase64, fileName } = req.body;
  if (!orderId || !pdfBase64) {
    return res.status(400).json({ error: 'orderId et pdfBase64 requis.' });
  }

  try {
    // 1. Upload PDF sur Cloudinary
    const cloudRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
      {
        file: `data:application/pdf;base64,${pdfBase64}`,
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
        folder: 'evidence-homestaging/rapports',
        public_id: `rapport-${orderId}`,
      }
    );
    const pdfUrl = cloudRes.data.secure_url;
    console.log('[Cloudinary] PDF uploadé :', pdfUrl);

    // 2. Récupérer les infos de la commande
    const order = global.habitedOrders?.find(o => o.orderId === orderId);
    const clientEmail = order?.clientEmail || null;
    const clientName = order?.clientName || 'Client';

    // 3. Marquer la commande comme livrée
    if (order) {
      order.pdfUrl = pdfUrl;
      order.status = 'delivered';
      order.deliveredAt = new Date().toISOString();
    }

    // 4. Envoyer email au client via Resend
    if (clientEmail) {
      await resend.emails.send({
        from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
        to: clientEmail,
        subject: 'Votre rapport home staging est prêt !',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: #1a1a1a; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #C8A96E; font-size: 20px; font-weight: 500; margin: 0;">Evidence Home Staging</h1>
            </div>
            <div style="background: #fff; padding: 32px; border: 0.5px solid #e0e0d8; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; color: #1a1a1a;">Bonjour ${clientName},</p>
              <p style="font-size: 14px; color: #555; margin-top: 12px; line-height: 1.6;">
                Votre rapport home staging personnalisé est prêt. Nos experts ont analysé votre bien et vous ont préparé des recommandations détaillées pour optimiser votre vente.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${pdfUrl}" style="background: #1a1a1a; color: #C8A96E; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
                  Télécharger mon rapport PDF
                </a>
              </div>
              <p style="font-size: 12px; color: #888; text-align: center;">
                Le rapport est également disponible dans votre espace client sur l'application.
              </p>
            </div>
          </div>
        `,
      });
      console.log('[Resend] Email envoyé à :', clientEmail);
    }

    res.json({ success: true, pdfUrl });
  } catch (err) {
    console.error('[Admin send-pdf error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
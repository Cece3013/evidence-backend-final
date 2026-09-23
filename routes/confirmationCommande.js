// backend/routes/confirmationCommande.js
// Confirmation d'une commande particulier payée (site).
// Appelée par DEUX chemins, pour ne jamais perdre une commande :
//  - le webhook Stripe (fiable même si le client ferme son navigateur) ;
//  - la page de confirmation du site (/api/payments/finalize).
// Le premier arrivé fait le travail ; le second voit "Paiement réussi" déjà
// coché dans Notion et ne refait rien (pas de double email).
const axios = require('axios');
const { getPage, patchPage, queryAll } = require('./notionHelpers');

const SITE_URL = 'https://evidence-platform-pied.vercel.app';

function buildSuiviUrl(reference, suiviCode) {
  if (!reference || !suiviCode) return null;
  return `${SITE_URL}/commande/suivi/${reference}?code=${suiviCode}`;
}

// Évite que le webhook et la page de confirmation traitent la même commande
// exactement au même instant.
const enCours = new Set();

async function envoyerEmailConfirmation(m, isHabite, suiviUrl) {
  const boutonSuivi = suiviUrl
    ? `<div style="text-align: center; margin: 28px 0;">
         <a href="${suiviUrl}" style="background: #b88a44; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 14px;">
           Suivre ma commande
         </a>
       </div>`
    : '';

  await axios.post('https://api.resend.com/emails', {
    from: 'Evidence Home Staging <contact@evidence-homestaging.fr>',
    to: m.clientEmail,
    subject: 'Votre commande Evidence Home Staging a bien été reçue',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f7f4; padding: 32px;">
        <div style="background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #c8a96e; margin: 0; font-size: 22px;">Evidence Home Staging</h1>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 24px;">
          <h2 style="color: #1a1a1a; font-size: 18px;">Bonjour ${m.clientName || 'cher client'},</h2>
          <p style="color: #555; line-height: 1.6;">
            Nous avons bien reçu votre commande ainsi que vos ${m.photoCount} photo(s).
          </p>
          <p style="color: #555; line-height: 1.6;">
            ${isHabite
              ? "Notre équipe analyse votre bien et vous enverra votre rapport personnalisé sous 48 à 72h."
              : "Vos visuels sont en cours de préparation et vous seront livrés sous 12h."}
          </p>
          ${boutonSuivi}
          <p style="color: #888; font-size: 12px; margin-top: 24px;">
            Référence : ${m.referenceDossier}<br/>
            Formule : ${m.formulaLabel || ''}<br/>
            Conservez ce lien, il vous permettra de récupérer vos fichiers.
          </p>
        </div>
      </div>
    `,
  }, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * session : la session Stripe Checkout (déjà récupérée auprès de Stripe).
 * Retourne { traite: true } si le travail a été fait maintenant,
 * { traite: false, raison } sinon (déjà fait, pas payé, pas une commande site…).
 */
async function confirmerPaiementCommande(session) {
  const m = session.metadata || {};

  if (!m.notionPageId) return { traite: false, raison: 'pas une commande du site' };
  if (session.payment_status !== 'paid') return { traite: false, raison: 'paiement non confirmé' };
  if (enCours.has(m.notionPageId)) return { traite: false, raison: 'déjà en cours de traitement' };

  enCours.add(m.notionPageId);
  try {
    // Source de vérité : la case "Paiement réussi" dans Notion
    const page = await getPage(m.notionPageId);
    if (page.properties['Paiement réussi']?.checkbox === true) {
      return { traite: false, raison: 'déjà confirmée' };
    }

    await patchPage(m.notionPageId, { 'Paiement réussi': { checkbox: true } });
    console.log(`[Confirmation] Paiement confirmé — ${m.referenceDossier}`);

    const isHabite = m.isHabite === 'true';

    // Bien vide : les photos "Avant" passent dans la file d'attente du générateur
    if (!isHabite) {
      const photos = await queryAll(process.env.NOTION_PHOTOS_DATABASE_ID, {
        filter: {
          and: [
            { property: 'Nom du Client', relation: { contains: m.notionPageId } },
            { property: 'Type', select: { equals: 'Avant' } },
          ],
        },
      });
      for (const photo of photos) {
        await patchPage(photo.id, { 'Statut génération': { select: { name: 'À générer' } } });
      }
      console.log(`[Confirmation] ${photos.length} photo(s) mises en file d'attente — ${m.referenceDossier}`);
    }

    try {
      await envoyerEmailConfirmation(m, isHabite, buildSuiviUrl(m.referenceDossier, m.suiviCode));
      console.log(`[Confirmation] Email envoyé à ${m.clientEmail}`);
    } catch (err) {
      console.error('[Confirmation] Erreur email:', err.response?.data || err.message);
    }

    return { traite: true };
  } finally {
    enCours.delete(m.notionPageId);
  }
}

module.exports = { confirmerPaiementCommande, buildSuiviUrl, SITE_URL };

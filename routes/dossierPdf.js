// backend/routes/dossierPdf.js
// Dossier PDF des biens habités particuliers, rempli automatiquement à partir
// du modèle Canva (modele-dossier-habite.pdf, à la racine du dépôt).
//
// Le modèle (19 pages) :
//   1        Couverture                         → recopiée telle quelle
//   2        Récapitulatif                      → informations client + plan écrits ici
//   3 à 16   2 pages par pièce (conseils, priorités) → photos posées dans les cadres
//   17-18    Shopping list                      → recopiées telles quelles
//   19       Ma visite en 2 min                 → recopiée telle quelle
//
// Seules les pièces de la commande sont reprises, dans l'ordre du modèle.
// Deux photos d'une même pièce → ses 2 pages sont dupliquées (« Chambre enfant 2 »).
// « Salon / Salle à manger » utilise les pages Salon.
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo,
  appendBezierCurve, closePath, clip, endPath } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { queryAll, getPage, lireReference } = require('./notionHelpers');

const MODELE = path.join(__dirname, '..', 'modele-dossier-habite.pdf');
const POLICE = path.join(__dirname, '..', 'GlacialIndifference-Regular.otf');

// Pages du modèle (numérotation à partir de 0)
const PAGE_COUVERTURE = 0;
const PAGE_RECAP = 1;
const PAGES_FIN = [
  { titre: 'Shopping list', pages: [16, 17] },
  { titre: 'Ma visite en 2 min', pages: [18] },
];

// Pièces, dans l'ordre du dossier : pages du modèle + titre affiché dans le plan
const PIECES = [
  { ids: ['salon', 'salon_salle_a_manger'], titre: 'Salon', pages: [2, 3] },
  { ids: ['cuisine'], titre: 'Cuisine', pages: [4, 5] },
  { ids: ['chambre_parentale'], titre: 'Chambre parentale', pages: [6, 7] },
  { ids: ['chambre_ado'], titre: 'Chambre ado', pages: [8, 9] },
  { ids: ['chambre_enfant'], titre: 'Chambre enfant', pages: [10, 11] },
  { ids: ['salle_bain'], titre: 'Salle de bain', pages: [12, 13] },
  { ids: ['balcon_terrasse'], titre: 'Balcon - Terrasse', pages: [14, 15] },
];

// Cadres photo de la page « Conseils & recommandations » (mesurés sur le modèle,
// origine en haut à gauche, en points) et rayon des coins arrondis
const CADRE_PROJECTION = { x0: 11.5, y0: 175.9, x1: 397.2, y1: 405.8, r: 12.7 };
const CADRE_ACTUELLE = { x0: 412.5, y0: 253.7, x1: 570.9, y1: 339.2, r: 12.8 };

// Page récapitulatif : fin des libellés et ligne de base de chaque information
const TAILLE_TEXTE = 10;
const COULEUR_TEXTE = rgb(0.13, 0.13, 0.13);
const BORD_DROIT_INFOS = 278; // bord intérieur du cadre « Informations client »
const INFOS = [
  { cle: 'nom', x: 137, base: 229.3 },
  { cle: 'telephone', x: 121, base: 249.6 },
  { cle: 'email', x: 101, base: 271.1 },
  { cle: 'date', x: 160, base: 336.9 },
  { cle: 'reference', x: 153, base: 363.6 },
];
// L'adresse du bien n'apparaît volontairement pas dans le dossier.

// Cadre « Plan du dossier »
const PLAN = { x: 342, xDroite: 538, haut: 222, bas: 398, taille: 11 };

// ─── Outils ──────────────────────────────────────────────────────────────────
// Convertit une ordonnée « depuis le haut » (mesures du modèle) en ordonnée PDF.
// Les pages Canva ne commencent pas à 0 (MediaBox décalée) : on en tient compte.
const hautPage = (page) => { const b = page.getMediaBox(); return b.y + b.height; };
const yPdf = (page, yHaut) => hautPage(page) - yHaut;

// Texte réduit si nécessaire pour tenir dans la largeur disponible
function ecrireAjuste(page, texte, { x, base, largeurMax, police, taille = TAILLE_TEXTE }) {
  if (!texte) return;
  let t = taille;
  while (t > 6 && police.widthOfTextAtSize(texte, t) > largeurMax) t -= 0.5;
  page.drawText(texte, { x, y: yPdf(page, base), size: t, font: police, color: COULEUR_TEXTE });
}

// Pose une image dans un cadre aux coins arrondis, en le remplissant
// entièrement (recadrage centré, comme « remplir le cadre » dans Canva)
function poserPhoto(page, image, cadre) {
  const x = cadre.x0;
  const y = yPdf(page, cadre.y1);
  const w = cadre.x1 - cadre.x0;
  const h = cadre.y1 - cadre.y0;
  const r = cadre.r;
  const k = 0.5523 * r; // approximation d'un quart de cercle

  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
    clip(),
    endPath()
  );

  const echelle = Math.max(w / image.width, h / image.height);
  const iw = image.width * echelle;
  const ih = image.height * echelle;
  page.drawImage(image, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
  page.pushOperators(popGraphicsState());
}

// Télécharge une photo (Cloudinary : convertie en JPG de taille raisonnable)
async function telechargerPhoto(url) {
  const urlOptimisee = url.includes('/upload/')
    ? url.replace('/upload/', '/upload/w_1600,c_limit,f_jpg,q_85/')
    : url;
  const res = await axios.get(urlOptimisee, { responseType: 'arraybuffer', timeout: 60000 });
  return { octets: Buffer.from(res.data), type: res.headers['content-type'] || '' };
}

async function integrerPhoto(doc, photo) {
  const estPng = photo.type.includes('png') ||
    (photo.octets[0] === 0x89 && photo.octets[1] === 0x50);
  return estPng ? doc.embedPng(photo.octets) : doc.embedJpg(photo.octets);
}

function formaterDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Construction du PDF ─────────────────────────────────────────────────────
/**
 * client : { nom, telephone, email, date, reference }
 * pieces : [{ roomType, avant: url, apres: url }] (une entrée par photo)
 * Retourne un Buffer PDF.
 */
async function construireDossier({ client, pieces }, { telecharger = telechargerPhoto } = {}) {
  const modele = await PDFDocument.load(fs.readFileSync(MODELE));
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const police = await doc.embedFont(fs.readFileSync(POLICE), { subset: false });

  // Pièces de la commande, regroupées dans l'ordre du modèle
  const sections = [];
  for (const def of PIECES) {
    const photos = pieces.filter((p) => def.ids.includes(p.roomType));
    photos.forEach((photo, i) => {
      sections.push({ def, photo, titre: photos.length > 1 ? `${def.titre} ${i + 1}` : def.titre });
    });
  }
  const inconnues = pieces.filter((p) => !PIECES.some((d) => d.ids.includes(p.roomType)));
  if (inconnues.length) {
    console.warn('[Dossier] Pièces sans pages dans le modèle (ignorées) :', inconnues.map((p) => p.roomType));
  }

  // 1. Couverture et récapitulatif
  const [couverture, recap] = await doc.copyPages(modele, [PAGE_COUVERTURE, PAGE_RECAP]);
  doc.addPage(couverture);
  doc.addPage(recap);

  // 2. Pièces : 2 pages chacune, photos dans les cadres
  const plan = [{ titre: 'Récapitulatif de votre projet', page: 2 }];
  for (const s of sections) {
    plan.push({ titre: s.titre, page: doc.getPageCount() + 1 });
    const pages = await doc.copyPages(modele, s.def.pages);
    pages.forEach((p) => doc.addPage(p));
    const pageConseils = pages[0];
    if (s.photo.apres) {
      poserPhoto(pageConseils, await integrerPhoto(doc, await telecharger(s.photo.apres)), CADRE_PROJECTION);
    }
    if (s.photo.avant) {
      poserPhoto(pageConseils, await integrerPhoto(doc, await telecharger(s.photo.avant)), CADRE_ACTUELLE);
    }
  }

  // 3. Pages de fin, identiques pour tous les dossiers
  for (const fin of PAGES_FIN) {
    plan.push({ titre: fin.titre, page: doc.getPageCount() + 1 });
    const pages = await doc.copyPages(modele, fin.pages);
    pages.forEach((p) => doc.addPage(p));
  }

  // 4. Informations client
  const valeurs = {
    nom: client.nom,
    telephone: client.telephone,
    email: client.email,
    date: formaterDate(client.date),
    reference: client.reference,
  };
  for (const champ of INFOS) {
    ecrireAjuste(recap, valeurs[champ.cle], {
      x: champ.x, base: champ.base, largeurMax: BORD_DROIT_INFOS - champ.x, police,
    });
  }
  // 5. Plan du dossier : seulement les pages réellement présentes
  const espace = Math.min(22, (PLAN.bas - PLAN.haut) / Math.max(plan.length, 1));
  const taille = espace < 16 ? 10 : PLAN.taille;
  plan.forEach((ligne, i) => {
    const base = PLAN.haut + i * espace;
    const numero = `P.${ligne.page}`;
    recap.drawText(ligne.titre, { x: PLAN.x, y: yPdf(recap, base), size: taille, font: police, color: COULEUR_TEXTE });
    recap.drawText(numero, {
      x: PLAN.xDroite - police.widthOfTextAtSize(numero, taille), y: yPdf(recap, base),
      size: taille, font: police, color: COULEUR_TEXTE,
    });
  });

  doc.setTitle(`Dossier Evidence Home Staging — ${client.reference || ''}`.trim());
  doc.setAuthor('Evidence Home Staging');
  return Buffer.from(await doc.save());
}

// ─── Données Notion d'une commande ───────────────────────────────────────────
// Associe chaque photo « Avant » à sa projection « Après » (usage interne),
// pièce par pièce, dans l'ordre d'envoi. Les projections cochées « Validé »
// sont prises en priorité.
async function chargerCommande(clientPageId) {
  const page = await getPage(clientPageId);
  const p = page.properties;
  const typePrestation = p['Type de prestation']?.select?.name || '';
  if (!typePrestation.toLowerCase().includes('habité')) {
    throw new Error("Cette commande n'est pas une commande de bien habité.");
  }

  const client = {
    nom: p['Nom du Client']?.title?.[0]?.plain_text || '',
    telephone: p['Téléphone']?.phone_number || '',
    email: p['Email']?.email || '',
    date: p['Date de commande']?.date?.start || null,
    reference: lireReference(p) || '',
  };

  const photos = await queryAll(process.env.NOTION_PHOTOS_DATABASE_ID, {
    filter: { property: 'Nom du Client', relation: { contains: clientPageId } },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
  const lire = (ph) => ({
    url: ph.properties['URL photo']?.url || null,
    roomType: (ph.properties['Pièce']?.select?.name || '').trim().toLowerCase(),
    type: ph.properties['Type']?.select?.name,
    valide: ph.properties['Validé']?.checkbox === true,
  });
  const toutes = photos.map(lire).filter((ph) => ph.url);
  const avants = toutes.filter((ph) => ph.type === 'Avant');
  const apres = toutes.filter((ph) => ph.type === 'Après');

  const pieces = [];
  const manquantes = [];
  const parPiece = {};
  for (const av of avants) (parPiece[av.roomType] = parPiece[av.roomType] || []).push(av);
  for (const [roomType, listeAvant] of Object.entries(parPiece)) {
    const candidates = apres.filter((a) => a.roomType === roomType);
    const validees = candidates.filter((a) => a.valide);
    const choix = validees.length >= listeAvant.length ? validees : candidates;
    listeAvant.forEach((av, i) => {
      const ap = choix[i] || null;
      if (!ap) manquantes.push(roomType);
      pieces.push({ roomType, avant: av.url, apres: ap ? ap.url : null });
    });
  }
  return { client, pieces, manquantes };
}

// Sans « forcer », s'arrête si une projection n'est pas encore générée
// (pdf: null + liste des pièces concernées).
async function genererDossierCommande(clientPageId, { forcer = false } = {}) {
  const { client, pieces, manquantes } = await chargerCommande(clientPageId);
  if (pieces.length === 0) throw new Error('Aucune photo trouvée pour cette commande.');
  if (manquantes.length && !forcer) return { pdf: null, reference: client.reference, manquantes };
  const pdf = await construireDossier({ client, pieces });
  return { pdf, reference: client.reference, manquantes };
}

module.exports = { construireDossier, chargerCommande, genererDossierCommande, PIECES };

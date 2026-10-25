// Mention incrustée sur les images « Projection rénovée » (cuisine, salle de bain — PRO habité).
// Décision du 24/10/2026 : « Projection de rénovation – travaux non inclus », incrustée
// discrètement en bas à droite de l'image, AVANT son envoi sur Cloudinary (elle fait donc
// partie de l'image téléchargée).
//
// Le texte est dessiné en tracés vectoriels avec la police Glacial Indifference (police de la
// marque, déjà utilisée pour les dossiers PDF) : le rendu ne dépend d'aucune police installée
// sur le serveur Railway.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fontkit = require('@pdf-lib/fontkit');

const CHEMIN_POLICE = path.join(__dirname, '..', 'GlacialIndifference-Regular.otf');
let police = null;
function chargerPolice() {
  if (!police) police = fontkit.create(fs.readFileSync(CHEMIN_POLICE));
  return police;
}

/** Tracés SVG d'un texte, ligne de base à (x, y), taille en pixels. */
function tracesTexte(texte, taille, x, y) {
  const f = chargerPolice();
  const echelle = taille / f.unitsPerEm;
  const run = f.layout(texte);
  let curseur = 0;
  const chemins = run.glyphs.map((g, i) => {
    const pos = run.positions[i];
    const d = g.path.toSVG();
    const tx = x + (curseur + pos.xOffset) * echelle;
    const ty = y - pos.yOffset * echelle;
    curseur += pos.xAdvance;
    return d ? `<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${echelle.toFixed(5)} ${(-echelle).toFixed(5)})" d="${d}"/>` : '';
  });
  return { svg: chemins.join(''), largeur: curseur * echelle };
}

/**
 * Incruste la mention sur l'image (Buffer PNG/JPG) et renvoie un Buffer PNG.
 * Taille proportionnelle à la largeur de l'image : lisible mais discrète.
 */
async function incrusterMention(bufferImage, texte) {
  const image = sharp(bufferImage);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error('Mention : dimensions de l\'image illisibles.');

  const taille = Math.max(14, Math.round(width * 0.016));
  const marge = Math.round(width * 0.015);
  const padH = Math.round(taille * 0.7);
  const padV = Math.round(taille * 0.45);

  const mesure = tracesTexte(texte, taille, 0, 0);
  const largeurBande = Math.round(mesure.largeur + padH * 2);
  const hauteurBande = Math.round(taille + padV * 2);
  const x0 = width - marge - largeurBande;
  const y0 = height - marge - hauteurBande;
  const ligneBase = y0 + padV + taille * 0.78;
  const { svg } = tracesTexte(texte, taille, x0 + padH, ligneBase);

  const calque = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="${x0}" y="${y0}" width="${largeurBande}" height="${hauteurBande}" rx="${Math.round(hauteurBande / 2)}" fill="#000000" fill-opacity="0.45"/>
  <g fill="#FFFFFF" fill-opacity="0.95">${svg}</g>
</svg>`;

  return image.composite([{ input: Buffer.from(calque), top: 0, left: 0 }]).png().toBuffer();
}

module.exports = { incrusterMention };

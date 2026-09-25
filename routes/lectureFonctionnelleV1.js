// Lecture d'implantation du lit — Biens vides — V1
// Composant spécialisé, validé : UNIQUEMENT chambre_enfant et chambre_ado,
// UNIQUEMENT pour la décision d'implantation du lit.
// Ne réactive pas les anciennes Lectures Fonctionnelles Salon/SAM archivées.
//
// Un appel d'analyse décide AVANT la génération où placer le lit, à partir de
// la géométrie visible sur la photo. Sa réponse a deux parties :
//  - ANALYSE : justification concise, pour le diagnostic uniquement
//    (page de test et journaux) — JAMAIS envoyée au modèle d'image ;
//  - IMPLANTATION DU LIT : décision courte et impérative, seule partie
//    ajoutée au prompt, juste après le module de la pièce.
// Aucune coordonnée, aucun code de mur, aucune reconstruction géométrique.

const ROOM_TYPES_AVEC_LECTURE_IMPLANTATION = ['chambre_enfant', 'chambre_ado'];

const TAILLE_LIT = {
  chambre_enfant: `Lit enfant 90×190 cm réels.
Cette taille est fixe.`,
  chambre_ado: `Choisis d'abord la taille du lit selon le volume visible de la pièce :
- 90×190 ou 90×200 par défaut ;
- 120×200 uniquement si le volume permet une circulation confortable ;
- 140×190/200 uniquement dans une chambre nettement plus grande.
Puis fige cette taille.
Elle ne doit jamais être réduite ensuite pour faciliter le placement.`,
};

const NOM_PIECE = {
  chambre_enfant: 'CHAMBRE ENFANT',
  chambre_ado: 'CHAMBRE ADO',
};

function promptLectureImplantation(roomType) {
  return `LECTURE D'IMPLANTATION — LIT — ${NOM_PIECE[roomType]}

À partir de cette unique photo, décide où placer le lit.
Raisonne uniquement sur les murs visibles sur la photo.

1. TAILLE DU LIT

${TAILLE_LIT[roomType]}

2. CONTRAINTES VISIBLES

Repère ce qui occupe chaque mur visible :
fenêtre, radiateur, porte et son ouverture, placard, trappe, pente de toit, prises.

Utilise ces repères et les proportions générales de la pièce
pour juger la place disponible.
Ne jamais inventer de mesures exactes.

3. COMPARER AU MOINS DEUX IMPLANTATIONS

Pour chaque implantation envisagée, conclure :
- COMPATIBLE : le lit tient clairement à sa taille réelle ;
- INCERTAINE : il est possible qu'il tienne, sans certitude ;
- INCOMPATIBLE : il ne tient pas à sa taille réelle.

Le lit doit tenir à sa taille réelle, avec une table de chevet si possible
et un passage suffisant, sans bloquer porte, fenêtre, radiateur, placard ni trappe.

Une implantation INCERTAINE ne peut être retenue
que s'il n'existe aucune solution clairement COMPATIBLE.

4. CHOISIR UNE SEULE IMPLANTATION

- de préférence : tête de lit contre un mur, lit perpendiculaire à ce mur ;
- lit en longueur contre un mur seulement si la géométrie l'impose
  (pièce étroite, ou mur principal occupé par une fenêtre, un radiateur, une porte ou un placard)
  ET s'il y tient réellement à sa taille réelle ;
- si une table de chevet ne tient pas à côté de la tête de lit,
  ne pas en mettre plutôt que réduire le lit.

Préserver, si la pièce le permet, au moins une zone murale ou un espace crédible pour le bureau.
Ne pas sacrifier une implantation naturelle du lit uniquement pour imposer un bureau
dans une pièce trop petite.

Ne jamais utiliser de coordonnées, de codes ou d'identifiants de murs.
Nommer les murs en langage courant
(mur de gauche, mur de droite, mur du fond, mur de la fenêtre, mur de la porte).

Réponds en deux parties, sous cette forme exacte :

ANALYSE
Contraintes observées : [courte liste]
Implantation 1 : [description] — COMPATIBLE / INCERTAINE / INCOMPATIBLE — [raison courte]
Implantation 2 : [description] — COMPATIBLE / INCERTAINE / INCOMPATIBLE — [raison courte]
Choix final : [implantation retenue et raison courte]

IMPLANTATION DU LIT
Lit : [taille réelle et figée].
Tête de lit : [mur et position générale].
Sens du lit : [perpendiculaire / longitudinal + direction du pied].
Table de chevet : [position] ou aucune si la place manque.
Zone bureau à préserver : [description simple] ou "sans objet".
Reste dégagé : [porte, fenêtre, radiateur, placard, trappe, circulation].
Le lit garde strictement ses dimensions réelles et ne doit jamais être réduit, raccourci ou déformé.`;
}

/**
 * Sépare la réponse en { analyse, decision }.
 * decision = null si la partie "IMPLANTATION DU LIT" est absente (réponse inexploitable).
 * La ligne "Zone bureau à préserver" est retirée de la décision si "sans objet".
 */
function decouperReponse(texte) {
  const brut = String(texte || '').trim();
  const titres = [...brut.matchAll(/^[ \t]*\**[ \t]*IMPLANTATION DU LIT[ \t]*\**[ \t]*:?[ \t]*$/gim)];
  if (titres.length === 0) return { analyse: brut, decision: null };

  const dernier = titres[titres.length - 1];
  const analyse = brut.slice(0, dernier.index).trim();
  let decision = brut.slice(dernier.index).trim()
    .split('\n')
    .map((l) => l.replace(/\*\*/g, '').trimEnd())
    .filter((l) => !/^\s*Zone bureau à préserver\s*:\s*["«]?\s*sans objet/i.test(l))
    .join('\n');
  decision = decision.replace(/^[ \t]*IMPLANTATION DU LIT[ \t]*:?[ \t]*/i, 'IMPLANTATION DU LIT');

  // Une décision exploitable contient au moins la tête de lit et le sens du lit
  if (!/T[êe]te de lit\s*:/i.test(decision) || !/Sens du lit\s*:/i.test(decision)) {
    return { analyse: brut, decision: null };
  }
  return { analyse, decision };
}

module.exports = {
  ROOM_TYPES_AVEC_LECTURE_IMPLANTATION,
  promptLectureImplantation,
  decouperReponse,
};

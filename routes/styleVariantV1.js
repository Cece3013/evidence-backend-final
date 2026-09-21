// STYLE_VARIANT — Biens vides — V1 — Test A/B (Salon & Salon/SAM uniquement)
// Ajouté APRÈS Noyau + Module, sans les modifier. Rotation séquentielle
// parmi 5 familles stylistiques, sans appel de classification vision
// supplémentaire (décision du 20/09/2026, point 1).

const ROOM_TYPES_AVEC_STYLE_VARIANT = ['salon', 'salon_salle_a_manger'];

// Bloc partagé, toujours inclus quelle que soit la famille — reprend
// verbatim les sections RÈGLE ANTI-RÉPÉTITION et ADAPTATION AU LOGEMENT RÉEL
// du bilan validé. La dernière phrase explicite la hiérarchie demandée :
// bien réel > cohérence d'aménagement > famille stylistique.
const BLOC_PARTAGE = `RÈGLE ANTI-RÉPÉTITION

Le STYLE_VARIANT doit empêcher la répétition automatique d'une même composition visuelle.

Ne pas reproduire systématiquement :

- canapé beige ;
- tapis en jute ;
- table basse ronde en bois ;
- table repas ronde ;
- cadre abstrait beige/vert ;
- grosse plante en pot ;
- suspension en fibres ;
- coussins terracotta ;
- même combinaison beige + bois + vert.

Faire varier réellement :

- couleur du canapé dans une gamme neutre et vendeuse ;
- forme de la table basse ;
- forme de la table repas ;
- matière du tapis ;
- type de luminaires ;
- décoration murale ;
- végétation ;
- tonalité de bois ;
- couleur secondaire ;
- type de textile.


ADAPTATION AU LOGEMENT RÉEL

Le STYLE_VARIANT ne doit pas être choisi aveuglément.

Lorsque le logement possède déjà un caractère intéressant :

- couleur murale existante ;
- parquet ;
- moulures ;
- pierre ;
- menuiserie ;
- architecture particulière ;

le style doit s'y adapter et peut reprendre cette caractéristique comme point de départ.

Exemple :

si un logement possède déjà une belle couleur bleu-gris ou vert doux,
ne pas automatiquement neutraliser tout en beige.

L'identité Évidence doit venir de la cohérence et de la qualité du rendu,
pas d'une palette unique appliquée à tous les biens.

Cette adaptation au logement réel reste prioritaire sur la famille stylistique
choisie ci-dessous : bien réel et architecture d'abord, cohérence de
l'aménagement ensuite, famille stylistique en dernier — en cas de conflit,
une caractéristique intéressante du logement l'emporte toujours sur la
famille.`;

const FAMILLE_A_NATUREL_DOUX = `FAMILLE STYLISTIQUE — A. NATUREL DOUX

Palette :
ivoire, lin, sable, beige doux.

Matières :
lin, coton, laine légère, bois clair, fibres naturelles.

Ambiance :
douce, chaleureuse, très lumineuse.

Attention :
ne pas systématiser tapis jute + grande plante + cadres abstraits.`;

const FAMILLE_B_CONTEMPORAIN_CHALEUREUX = `FAMILLE STYLISTIQUE — B. CONTEMPORAIN CHALEUREUX

Palette :
greige, taupe clair, écru, bois moyen, touches noires discrètes.

Matières :
bois, tissu texturé, métal noir léger, verre.

Ambiance :
plus graphique et contemporaine, mais toujours chaleureuse.

Mobilier :
lignes plus nettes et légèrement plus structurées.`;

const FAMILLE_C_MEDITERRANEEN_SOBRE = `FAMILLE STYLISTIQUE — C. MÉDITERRANÉEN SOBRE

Palette :
blanc cassé, sable, pierre, terre cuite très modérée, olive doux.

Matières :
bois naturel, lin, céramique, fibres naturelles.

Ambiance :
lumineuse, simple, chaleureuse.

Éviter :
effet bohème chargé,
accumulation de terracotta,
accumulation de paniers ou végétation.`;

const FAMILLE_D_ELEGANT_ORGANIQUE = `FAMILLE STYLISTIQUE — D. ÉLÉGANT ORGANIQUE

Palette :
crème, taupe, beige grisé, brun doux.

Matières :
bois moyen, textile bouclé léger, verre, céramique mate.

Ambiance :
sobre, élégante, contemporaine, organique.

Formes :
mobilier éventuellement plus arrondi ou sculptural, mais restant réaliste et accessible.`;

const FAMILLE_E_SCANDI_LUMINEUX = `FAMILLE STYLISTIQUE — E. SCANDI LUMINEUX

Palette :
ivoire, blanc chaud, gris chaud, chêne clair, touches de couleur très discrètes.

Matières :
bois clair, laine, coton, verre.

Ambiance :
épurée, lumineuse, fonctionnelle.

Décoration :
plus minimale, moins végétalisée, moins d'objets.`;

// Ordre de rotation demandé : A → B → C → D → E → A...
const ROTATION = [
  { id: 'A', texte: FAMILLE_A_NATUREL_DOUX },
  { id: 'B', texte: FAMILLE_B_CONTEMPORAIN_CHALEUREUX },
  { id: 'C', texte: FAMILLE_C_MEDITERRANEEN_SOBRE },
  { id: 'D', texte: FAMILLE_D_ELEGANT_ORGANIQUE },
  { id: 'E', texte: FAMILLE_E_SCANDI_LUMINEUX },
];

// Compteur en mémoire du process : séquentiel et reproductible tant que le
// serveur ne redémarre pas. Pas de stockage externe pour ce test A/B, comme
// demandé (solution simple, sans classificateur ni dépendance nouvelle).
// À noter : un redéploiement Railway repart de la famille A — à signaler si
// ça pose problème une fois la V1 en production réelle.
let indexRotation = 0;

function prochaineFamilleStyle() {
  const famille = ROTATION[indexRotation % ROTATION.length];
  indexRotation += 1;
  return famille;
}

/**
 * Retourne { id, texte } de la famille sélectionnée pour cet appel, et
 * avance le compteur de rotation.
 */
function construireStyleVariant() {
  const famille = prochaineFamilleStyle();
  return {
    id: famille.id,
    texte: [famille.texte, '', BLOC_PARTAGE].join('\n'),
  };
}

module.exports = {
  ROOM_TYPES_AVEC_STYLE_VARIANT,
  construireStyleVariant,
  BLOC_PARTAGE,
  FAMILLE_A_NATUREL_DOUX,
  FAMILLE_B_CONTEMPORAIN_CHALEUREUX,
  FAMILLE_C_MEDITERRANEEN_SOBRE,
  FAMILLE_D_ELEGANT_ORGANIQUE,
  FAMILLE_E_SCANDI_LUMINEUX,
};

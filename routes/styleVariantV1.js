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

Objectif : un univers très clair, doux, calme, lumineux et ton sur ton, nettement distinct
du style générique.

Palette dominante :
ivoire, lin, beige très pâle, sable clair.

Couleurs secondaires :
taupe très clair, brun naturel très discret.

Bois :
chêne blond.

Matières :
lin, coton, laine fine, verre opalin, céramique mate.

Mobilier :
formes simples et légères, arrondies ou légèrement organiques.

Luminaires :
verre opalin, papier ou tissu clair.

Décoration :
très peu d'éléments, compositions calmes, art abstrait doux ou paysage minimal.

À privilégier :
douceur, lumière, matières mates, très faible contraste, tons ton sur ton.

INTERDIT EXPLICITEMENT (jamais dans cette famille) :
vert olive dominant, terracotta, bois foncé, métal noir marqué, rotin, osier,
suspension en panier, tapis jute grossier, accumulation de plantes.

Le résultat doit être immédiatement identifiable par sa douceur, sa lumière et son très
faible contraste — jamais par des matières brutes ou des couleurs soutenues.`;

const FAMILLE_B_CONTEMPORAIN_CHALEUREUX = `FAMILLE STYLISTIQUE — B. CONTEMPORAIN CHALEUREUX

Palette dominante :
greige, taupe, crème, brun moyen.

Couleurs secondaires :
noir doux, brun chocolat, bronze discret.

Bois :
noyer clair ou bois moyen.

Matières :
bois, verre, métal noir fin, textiles structurés.

Mobilier :
lignes plus nettes, silhouettes plus architecturées, tables basses plus graphiques.

Luminaires :
métal, verre ou formes géométriques simples.

Décoration :
plus structurée, art abstrait contemporain, peu de végétation.

À privilégier :
contraste modéré, mobilier plus contemporain, compositions plus graphiques.

À éviter :
ambiance bohème, rotin, paniers, jute dominant, coussins vert olive systématiques,
accumulation de matières végétales.`;

const FAMILLE_C_MEDITERRANEEN_SOBRE = `FAMILLE STYLISTIQUE — C. MÉDITERRANÉEN SOBRE

Objectif : un caractère méditerranéen réellement perceptible, mais élégant et non bohème.

Palette dominante :
blanc cassé, pierre claire, sable chaud.

Couleurs secondaires :
ocre doux, terracotta ponctuelle (touche, jamais dominante).

Bois :
bois patiné.

Matières :
céramique, matières minérales, bois patiné, lin.

Mobilier :
formes simples et artisanales, chaleureux, sans effet bohème.

Luminaires :
céramique, verre, métal patiné ou formes très simples — jamais rotin ni osier.

Décoration :
céramique, art inspiré paysage/architecture/formes naturelles, formes simples et
artisanales.

À privilégier :
chaleur solaire, simplicité, matières minérales, caractère méditerranéen affirmé mais
sobre.

INTERDIT EXPLICITEMENT (jamais dans cette famille) :
suspension en rotin ou en osier, panier décoratif dominant, jute omniprésent, coussins
vert olive automatiques, accumulation de plantes, macramé, look bohème.

Une touche olive reste possible en accent ponctuel, mais ne doit jamais devenir
l'élément principal de la composition.`;

const FAMILLE_D_ELEGANT_ORGANIQUE = `FAMILLE STYLISTIQUE — D. ÉLÉGANT ORGANIQUE

Palette dominante :
crème, taupe, beige grisé, brun chaud.

Couleurs secondaires :
chocolat, bronze, brun fumé.

Bois :
bois moyen à foncé.

Matières :
bois, verre, laine, bouclé discret, pierre claire ou céramique sculpturale.

Mobilier :
formes arrondies, volumes plus sculpturaux, lignes élégantes mais réalistes.

Luminaires :
verre, métal bronze, formes organiques contemporaines.

Décoration :
peu d'objets, objets plus sculpturaux, art abstrait plus affirmé.

À privilégier :
sophistication sobre, contraste doux, formes organiques.

À éviter :
rotin, tapis jute rustique, décoration trop champêtre, accessoires enfantins,
accumulation de petites plantes.`;

const FAMILLE_E_SCANDI_LUMINEUX = `FAMILLE STYLISTIQUE — E. SCANDI LUMINEUX

Palette dominante :
blanc chaud, ivoire, gris clair chaud, beige très pâle.

Couleurs secondaires :
bleu grisé discret, gris vert très léger, noir minimal.

Bois :
chêne très clair / frêne.

Matières :
bois clair, coton, laine, verre, métal léger.

Mobilier :
lignes droites, fonctionnelles, visuellement légères, pieds fins.

Luminaires :
métal blanc/noir fin, verre opalin, formes nordiques simples.

Décoration :
très minimale, peu de plantes, cadres graphiques simples, accessoires très limités.

À privilégier :
luminosité, sobriété, fonctionnalité, espace visuel.

À éviter :
terracotta, bois foncé, tapis jute épais, rotin massif, ambiance cocooning beige
trop chargée, accumulation d'objets décoratifs.`;

// Règle supplémentaire — différenciation obligatoire (V2). Ajoutée à chaque
// famille via BLOC_PARTAGE serait redondant : elle est ajoutée une seule
// fois, après le bloc partagé, dans construireStyleVariant().
const REGLE_DIFFERENCIATION_OBLIGATOIRE = `RÈGLE SUPPLÉMENTAIRE — DIFFÉRENCIATION OBLIGATOIRE

La famille sélectionnée doit être visuellement identifiable.

Ne pas retomber automatiquement sur la combinaison :
canapé beige, coussins vert olive, plaid vert/gris, tapis jute, table basse bois +
métal noir, luminaire en fibres, grosse plante en pot.

Si la famille choisie interdit ou décourage un de ces éléments, le remplacer par une
alternative cohérente avec cette famille.

La différence entre deux familles successives doit être perceptible immédiatement dans :
palette, matières, type de bois, luminaires, forme du mobilier, textiles, décoration.`;

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
    texte: [famille.texte, '', BLOC_PARTAGE, '', REGLE_DIFFERENCIATION_OBLIGATOIRE].join('\n'),
  };
}

module.exports = {
  ROOM_TYPES_AVEC_STYLE_VARIANT,
  construireStyleVariant,
  REGLE_DIFFERENCIATION_OBLIGATOIRE,
  BLOC_PARTAGE,
  FAMILLE_A_NATUREL_DOUX,
  FAMILLE_B_CONTEMPORAIN_CHALEUREUX,
  FAMILLE_C_MEDITERRANEEN_SOBRE,
  FAMILLE_D_ELEGANT_ORGANIQUE,
  FAMILLE_E_SCANDI_LUMINEUX,
};

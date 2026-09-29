// Salle de bain V4 — Biens vides
// Arbitrages validés le 29/09/2026 (voir document « Module Salle de bain V4 »).
//
// Chaîne : Contrôle Photo V2 → CLASSIFICATION_SDB → niveau → variante → prompt.
//   SDB_PRESENTABLE        → recommandation Valorisation douce (choix client)
//   SDB_DATEE              → recommandation Projection modernisée (choix client)
//   SDB_INCOMPLETE_OU_VIDE → projection complète à partir des indices techniques
//   PHOTO_A_REPRENDRE      → pas de génération spéculative
//
// Le modèle d'image ne reçoit qu'UN niveau et UNE variante, jamais de
// condition à évaluer. Remplace le module salle_bain V3 (conservé tel quel
// dans modulesVideV3.js, mais n'est plus utilisé par le pipeline V1).
// Pas de STYLE_VARIANT à 5 familles : la variante est déduite de la famille.

// ─── MODULE COMMUN — toujours envoyé ─────────────────────────────────────────
const MODULE_SDB_V4 = `SALLE DE BAIN — BIEN VIDE

Valoriser la salle de bain
dans un style lumineux, sobre, chaleureux et crédible.
Une salle de bain simple, propre et vendeuse,
jamais une salle de bain de luxe irréaliste.

RÈGLES NON NÉGOCIABLES

Respecter strictement la largeur, la profondeur
et les proportions visibles de la pièce.

Ne jamais agrandir, élargir, allonger ou restructurer
la salle de bain pour faire tenir l'aménagement.

Respecter l'implantation réelle :
chaque sanitaire reste à son emplacement visible.

Respecter portes, fenêtres, radiateurs,
volumes et contraintes visibles.

Ne jamais déplacer de manière incohérente
les arrivées d'eau ou évacuations visibles.

Ne jamais inventer un équipement majeur
non crédible dans la pièce.

Si l'espace est limité,
réduire ou supprimer un élément secondaire
plutôt que modifier la pièce.

Une salle de bain petite ou étroite
doit rester visiblement petite ou étroite.

Conserver la perspective et le cadrage de la photo.

Ne pas surcharger :
peu d'accessoires, choisis et utiles.`;

// ─── NIVEAUX — un seul envoyé ────────────────────────────────────────────────
const MATERIAUX_CARACTERE_SDB = `Les matériaux de caractère existants sont conservés et intégrés à la projection :
carreaux de ciment anciens, mosaïque d'époque, pierre, terrazzo de caractère,
tomettes, belle faïence artisanale, baignoire ancienne en fonte de qualité.
En cas de doute sur la valeur de caractère d'un matériau : le conserver.`;

const NIVEAU_DOUCE = `NIVEAU DE TRAITEMENT : VALORISATION DOUCE

La salle de bain est déjà correcte et présentable.
L'améliorer légèrement, sans modifier son identité générale.

À faire :
- mise en ordre et présentation soignée de l'existant ;
- linge de toilette plié ou suspendu ;
- quelques accessoires choisis ;
- miroir et luminaire actualisés si nécessaire ;
- petite décoration discrète.

Conserver tels quels :
sanitaires, meuble vasque, baignoire ou douche, paroi,
faïence murale, sol, robinetterie.`;

const NIVEAU_MODERNISEE = `NIVEAU DE TRAITEMENT : PROJECTION MODERNISÉE

La salle de bain est datée, abîmée ou vieillissante.
Montrer une rénovation crédible qui favorise la projection,
sans réinventer la pièce.

Modernisation visuelle autorisée :
- meuble vasque contemporain à l'emplacement du lavabo existant ;
- miroir et éclairage actualisés ;
- paroi vitrée sobre pour la douche ou la baignoire existante ;
- robinetterie, habillage et finitions actualisés ;
- faïence murale et sol modernisés de façon crédible
  lorsqu'ils vieillissent fortement la pièce ;
- ambiance générale claire et actuelle.

UNE BAIGNOIRE RESTE UNE BAIGNOIRE.
UNE DOUCHE RESTE UNE DOUCHE.
Chaque sanitaire garde son emplacement et son type :
ne jamais transformer une baignoire en douche, ni une douche en baignoire.

${MATERIAUX_CARACTERE_SDB}

Le résultat doit rester une rénovation réalisable,
pas une salle de bain neuve de catalogue.`;

const NIVEAU_COMPLETE = `NIVEAU DE TRAITEMENT : SALLE DE BAIN INCOMPLÈTE OU VIDE

Certains ou tous les équipements sanitaires sont absents.
Créer ou compléter une salle de bain cohérente et crédible à partir :
- des arrivées d'eau et évacuations visibles ;
- de la géométrie réelle de la pièce ;
- des ouvertures ;
- des contraintes techniques visibles.

Placer chaque équipement là où les indices techniques l'indiquent.
Ne jamais inventer une implantation sans rapport avec les indices techniques présents.
Conserver les équipements déjà en place, à leur emplacement et avec leur type.

${MATERIAUX_CARACTERE_SDB}

Le résultat doit rester une salle de bain réalisable,
pas une salle de bain de catalogue.`;

const NIVEAUX_SDB = {
  douce: NIVEAU_DOUCE,
  modernisee: NIVEAU_MODERNISEE,
  complete: NIVEAU_COMPLETE,
};

// ─── VARIANTES DÉCO — une seule envoyée ──────────────────────────────────────
// legere  : niveau 'douce' (palette, miroir, linge, accessoires, luminaire)
// complete: niveaux 'modernisee' et 'complete' (guide aussi meuble vasque,
//           revêtements, robinetterie et finitions)
const VARIANTES_SDB = {
  blanc: {
    legere: `VARIANTE DÉCO : MODERNE BLANC

Ambiance claire, lumineuse et épurée.
Palette : blanc, écru, beige très clair, gris doux.
Miroir : rectangulaire ou arrondi, sans cadre ou cadre fin clair.
Luminaire : applique simple blanche ou chromée.
Linge : blanc et écru.
Accessoires : céramique blanche, verre ; aucun bois dominant.`,
    complete: `VARIANTE DÉCO : MODERNE BLANC

Ambiance claire, lumineuse et épurée.
Palette : blanc, écru, beige très clair, gris doux.
Meuble vasque : laqué blanc mat ou gris très clair, lignes simples.
Revêtements : grands carreaux blancs ou gris très clair, joints fins.
Robinetterie : chromée ou inox brossé.
Miroir : rectangulaire ou arrondi, sans cadre ou cadre fin clair.
Luminaire : applique simple blanche ou chromée.
Linge : blanc et écru.
Accessoires : céramique blanche, verre ; aucun bois dominant.`,
  },
  bois: {
    legere: `VARIANTE DÉCO : MODERNE BOIS

Même base claire, réchauffée par du bois clair naturel.
Palette : blanc et bois clair, touches beige.
Miroir : cadre bois clair fin ou arrondi.
Luminaire : applique simple, touches bois clair ou laiton brossé discret.
Linge : écru et beige.
Accessoires : bois clair, céramique mate, une plante au plus.`,
    complete: `VARIANTE DÉCO : MODERNE BOIS

Même base claire, réchauffée par du bois clair naturel.
Palette : blanc et bois clair, touches beige.
Meuble vasque : façades en bois clair naturel (chêne clair), plan ou vasque blanc.
Revêtements : carreaux blancs ou beige très clair,
éventuellement une zone effet bois clair ou beige chaud.
Robinetterie : noir mat fin ou laiton brossé discret.
Miroir : cadre bois clair fin ou arrondi.
Luminaire : applique simple, touches bois clair ou laiton brossé discret.
Linge : écru et beige.
Accessoires : bois clair, céramique mate, une plante au plus.`,
  },
};

// Famille de style de la commande → variante SDB (mapping validé).
const VARIANTE_PAR_FAMILLE = { A: 'bois', B: 'blanc', C: 'blanc', D: 'bois', E: 'blanc' };
const VARIANTE_PAR_DEFAUT = 'blanc';

function choisirVarianteSdb({ varianteForcee, famille }) {
  if (varianteForcee && VARIANTES_SDB[varianteForcee]) return varianteForcee;
  const f = famille ? String(famille).toUpperCase() : null;
  return (f && VARIANTE_PAR_FAMILLE[f]) || VARIANTE_PAR_DEFAUT;
}

// ─── CLASSIFICATION SDB ──────────────────────────────────────────────────────
const CLASSIFICATION_SDB = `CLASSIFICATION SALLE DE BAIN — ÉVIDENCE BIENS VIDES
(appelée uniquement après PHOTO_VALIDEE, uniquement si la pièce sélectionnée est Salle de bain)

MISSION
Analyser la photo déjà validée pour déterminer l'état réel de la salle de bain visible.
Ne pas juger la qualité technique de la photo. Ne pas décider de l'aménagement final.

Choisir obligatoirement un seul statut parmi les suivants :

SDB_PRESENTABLE
Salle de bain propre, en bon état, finitions cohérentes et encore actuelles ;
une mise en valeur légère suffit.

SDB_DATEE
Salle de bain clairement datée, abîmée, dégradée ou vieillissante :
faïence ou sanitaires de couleur datée, joints noircis, éléments dépareillés,
meuble vasque usé, finitions défraîchies.

SDB_INCOMPLETE_OU_VIDE
Il s'agit clairement d'une salle de bain, mais certains ou tous les équipements
sanitaires sont absents, et les éléments techniques visibles (arrivées d'eau,
évacuations, géométrie, ouvertures) permettent une projection crédible.

PHOTO_A_REPRENDRE
La photo ne permet pas de déterminer de façon suffisamment crédible qu'il s'agit
d'une salle de bain, ou où les équipements pourraient se placer.

En cas de doute entre SDB_PRESENTABLE et SDB_DATEE : SDB_PRESENTABLE.

FORMAT DE SORTIE
Retourner exclusivement un JSON valide, sans aucun texte hors JSON :

{
  "status": "SDB_PRESENTABLE | SDB_DATEE | SDB_INCOMPLETE_OU_VIDE | PHOTO_A_REPRENDRE",
  "reason": "explication courte justifiant ce choix"
}`;

// États qui demandent un choix client (avec recommandation).
const ETATS_SDB_AVEC_CHOIX = ['SDB_PRESENTABLE', 'SDB_DATEE'];

const OPTIONS_SDB = [
  {
    id: 'valorisation_douce',
    label:
      "Améliorer légèrement la salle de bain existante : mise en ordre, linge, accessoires, miroir et luminaire, sans modifier son identité.",
  },
  {
    id: 'projection_modernisee',
    label:
      "Montrer une rénovation crédible : meuble vasque, miroir, éclairage, paroi, finitions et revêtements modernisés, en conservant l'implantation et le type de chaque sanitaire.",
  },
];

function recommandationSdb(status) {
  return status === 'SDB_DATEE' ? 'projection_modernisee' : 'valorisation_douce';
}

// Niveau effectif à partir de la classification et du choix client.
function niveauSdb(status, choix) {
  if (status === 'SDB_INCOMPLETE_OU_VIDE') return 'complete';
  if (choix === 'projection_modernisee') return 'modernisee';
  if (choix === 'valorisation_douce') return 'douce';
  return recommandationSdb(status) === 'projection_modernisee' ? 'modernisee' : 'douce';
}

// Texte « module » complet pour la SDB : commun + niveau + variante.
function construireModuleSdb(niveau, variante) {
  const v = VARIANTES_SDB[variante] || VARIANTES_SDB[VARIANTE_PAR_DEFAUT];
  const texteVariante = niveau === 'douce' ? v.legere : v.complete;
  return [MODULE_SDB_V4, '', NIVEAUX_SDB[niveau], '', texteVariante].join('\n');
}

module.exports = {
  CLASSIFICATION_SDB,
  ETATS_SDB_AVEC_CHOIX,
  OPTIONS_SDB,
  recommandationSdb,
  niveauSdb,
  choisirVarianteSdb,
  construireModuleSdb,
  MODULE_SDB_V4,
  VARIANTES_SDB,
  VARIANTE_PAR_FAMILLE,
};

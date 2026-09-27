// STYLE_VARIANT — Biens vides — V2
// Salon et Salon/SAM : V2 validée, textes inchangés.
// Chambres (parentale, enfant, ado) : déclinaisons des 5 mêmes familles,
// validées par ChatGPT, avec cadre, anti-répétition et différenciation propres
// aux chambres.
// Ajouté APRÈS Noyau + Module, sans les modifier. Une commande = une famille :
// en production, la famille est imposée (familleForcee) pour toutes les pièces.
// Cuisine et Entrée : déclinaisons validées en septembre 2026 (cadre cuisine
// selon le type : valorisation douce / projection modernisée / vide-incomplète).
// Pas de STYLE_VARIANT sur Salle de bain et Balcon/Terrasse.

const ROOM_TYPES_AVEC_STYLE_VARIANT = [
  'salon',
  'salon_salle_a_manger',
  'chambre_parentale',
  'chambre_enfant',
  'chambre_ado',
  'cuisine',
  'entree',
];

const CHAMBRES = ['chambre_parentale', 'chambre_enfant', 'chambre_ado'];

// Bloc partagé, toujours inclus quelle que soit la famille — reprend
// verbatim les sections RÈGLE ANTI-RÉPÉTITION et ADAPTATION AU LOGEMENT RÉEL
// du bilan validé. La dernière phrase explicite la hiérarchie demandée :
// bien réel > cohérence d'aménagement > famille stylistique.
// Bloc partagé Salon / Salon-SAM — texte strictement identique à la V2 validée,
// simplement découpé en deux constantes pour réutiliser l'ADAPTATION AU
// LOGEMENT RÉEL (inchangée) dans les chambres.
const ANTI_REPETITION_SALON = `RÈGLE ANTI-RÉPÉTITION

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
- type de textile.`;

const ADAPTATION_LOGEMENT_REEL = `ADAPTATION AU LOGEMENT RÉEL

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

const BLOC_PARTAGE = ANTI_REPETITION_SALON + '\n\n\n' + ADAPTATION_LOGEMENT_REEL;

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

// ═════════════════════════════════════════════════════════════════════════════
// CHAMBRES — déclinaisons validées (parentale, enfant, ado)
// Assemblage : CADRE + FAMILLE déclinée + ANTI-RÉPÉTITION CHAMBRES
//              + DIFFÉRENCIATION CHAMBRES + ADAPTATION AU LOGEMENT RÉEL
// ═════════════════════════════════════════════════════════════════════════════

const CADRE_CHAMBRE_PARENTALE = `CADRE STYLE_VARIANT — CHAMBRE PARENTALE

La famille stylistique agit uniquement sur : linge de lit, couleur secondaire, finition
de la tête de lit, chevets (finition et matière), luminaires, tapis, rideaux et voilages,
décoration murale, matières et tonalités de bois, petits accessoires.

Elle ne modifie jamais : l'emplacement du lit, ses dimensions, la circulation,
l'architecture, les ouvertures, les radiateurs, les placards, ni aucune règle du module
Chambre parentale.

Elle n'ajoute aucun meuble que le module ne prévoit pas : jamais de bureau, fauteuil
ou commode ajouté pour exprimer le style.`;

const CADRE_CHAMBRE_ENFANT = `CADRE STYLE_VARIANT — CHAMBRE ENFANT

La famille stylistique agit uniquement sur : linge de lit, palette et matières, petite
décoration murale, tapis, lampe, rangements secondaires, et la finition du bureau et
de la chaise s'ils sont présents.

Elle ne modifie jamais : la position ni l'orientation du lit, ses dimensions (90×190),
l'emplacement du bureau, la circulation, l'architecture, les ouvertures, les radiateurs.

Le rendu reste adapté à un enfant, sobre, vendeur, non caricatural, non surchargé.

Un indice enfantin discret peut être ajouté si utile, mais n'est jamais obligatoire.
Maximum : 1 ou 2 indices enfantins discrets.

Toujours éviter : accumulation de peluches, multiplication des paniers, tapis rond
systématique, plusieurs affiches, textes muraux, plantes systématiques, décoration trop
bébé, décoration trop genrée.`;

const CADRE_CHAMBRE_ADO = `CADRE STYLE_VARIANT — CHAMBRE ADO

La famille stylistique agit uniquement sur : textiles, couleurs secondaires, luminaires,
tapis, décoration murale, chevets, matières et bois, et la finition du bureau s'il est
présent.

Elle ne modifie jamais : les dimensions du lit, l'implantation, la circulation,
l'architecture, les ouvertures, les radiateurs.

Le rendu reste contemporain, crédible, ni enfantin ni hôtelier, suffisamment neutre
pour une annonce immobilière.

Toujours éviter : textes décoratifs, accumulation d'affiches, multiplication des
plantes, bureau surchargé, style trop genré ou trop personnalisé.`;

const ANTI_REPETITION_CHAMBRES = `RÈGLE ANTI-RÉPÉTITION — CHAMBRES

Ne pas reproduire automatiquement d'une génération à l'autre la même combinaison :

- linge de lit beige/écru ;
- plaid vert olive ;
- coussins vert olive ;
- tête de lit beige ;
- tapis en fibres naturelles ;
- chevets bois clair identiques ;
- lampe en fibres/rotin ;
- cadres végétaux ou paysages similaires ;
- plante en pot systématique.

La famille stylistique sélectionnée doit réellement influencer :

- le linge de lit ;
- les couleurs secondaires ;
- le type et la tonalité du bois ;
- les luminaires ;
- le tapis ;
- la décoration murale ;
- les textiles ;
- les finitions des meubles secondaires.

Ne pas ajouter artificiellement des objets uniquement pour créer de la variation.`;

const DIFFERENCIATION_CHAMBRES = `DIFFÉRENCIATION OBLIGATOIRE — CHAMBRES

La famille sélectionnée doit être visuellement identifiable dans une chambre.

À architecture et implantation identiques, une chambre :

A — Naturel Doux
ne doit pas pouvoir être confondue avec

B — Contemporain Chaleureux,
C — Méditerranéen Sobre,
D — Élégant Organique
ou
E — Scandi Lumineux.

La différence doit être perceptible principalement par :

- palette ;
- textiles ;
- bois ;
- luminaires ;
- tapis ;
- décoration murale ;
- finitions du mobilier secondaire.

IMPORTANT :

Cette différenciation ne doit JAMAIS être obtenue en modifiant :

- l'emplacement du lit ;
- son orientation ;
- ses dimensions ;
- l'emplacement du bureau ;
- la circulation ;
- l'architecture ;
- les ouvertures ;
- les éléments techniques.

STYLE_VARIANT agit sur l'ESTHÉTIQUE, jamais sur le plan d'aménagement.`;

// ─── CHAMBRE PARENTALE ───────────────────────────────────────────────────────

const STYLE_A_CHAMBRE_PARENTALE = `A — NATUREL DOUX — CHAMBRE PARENTALE

Linge de lit : lin lavé ivoire et beige très pâle, ton sur ton.
Tête de lit : lin clair ou chêne blond, lignes simples et douces.
Chevets : chêne blond, formes légères, légèrement arrondies.
Luminaires : lampes de chevet en verre opalin ou abat-jour en tissu clair.
Tapis : laine fine ou coton clair, uni.
Rideaux : voilages lin blanc cassé, très légers.
Décoration murale : une seule œuvre, art abstrait doux ou paysage minimal, tons pâles.
Interdit : vert olive dominant, terracotta, bois foncé, métal noir marqué, rotin, osier,
tapis jute grossier, accumulation de plantes.
Rendu : très clair, calme, très faible contraste.`;

const STYLE_B_CHAMBRE_PARENTALE = `B — CONTEMPORAIN CHALEUREUX — CHAMBRE PARENTALE

Linge de lit : greige et taupe, une touche brun chocolat ou noir doux (coussin ou plaid).
Tête de lit : lignes nettes et structurées, tissu taupe ou bois moyen.
Chevets : noyer clair ou bois moyen, lignes graphiques, détails en métal noir fin.
Luminaires : métal noir fin et verre, formes géométriques simples.
Tapis : uni ou légèrement texturé, greige.
Rideaux : tissu uni greige ou taupe.
Décoration murale : art abstrait contemporain, graphique et sobre.
À éviter : ambiance bohème, rotin, paniers, jute dominant, coussins vert olive
systématiques, accumulation de matières végétales.
Rendu : plus structuré, contraste modéré.`;

const STYLE_C_CHAMBRE_PARENTALE = `C — MÉDITERRANÉEN SOBRE — CHAMBRE PARENTALE

Linge de lit : lin blanc cassé et sable chaud, touche ponctuelle terracotta ou ocre doux
(coussin ou plaid, jamais dominante).
Tête de lit : bois patiné ou lin sable, formes simples et artisanales.
Chevets : bois patiné, céramique ou pierre claire.
Luminaires : céramique, verre ou métal patiné — jamais rotin ni osier.
Tapis : laine ou lin tissé à plat, ton sable.
Rideaux : lin blanc cassé.
Décoration murale : art inspiré paysage, architecture ou formes naturelles ; céramique.
Interdit : suspension ou lampe en rotin ou osier, panier décoratif dominant, jute
omniprésent, coussins vert olive automatiques, accumulation de plantes, macramé,
look bohème.
Rendu : chaleur solaire, simplicité, matières minérales, caractère méditerranéen sobre.`;

const STYLE_D_CHAMBRE_PARENTALE = `D — ÉLÉGANT ORGANIQUE — CHAMBRE PARENTALE

Linge de lit : crème et taupe, touche caramel ou brun chaud, textures laine ou bouclé
discret.
Tête de lit : formes arrondies, tissu bouclé crème ou bois moyen à foncé.
Chevets : bois moyen à foncé aux formes organiques, ou pierre claire.
Luminaires : verre fumé ou bronze, formes organiques contemporaines.
Tapis : laine, crème ou beige grisé.
Rideaux : crème, tombé ample.
Décoration murale : peu d'objets, un objet sculptural, art abstrait plus affirmé.
À éviter : rotin, tapis jute rustique, décoration champêtre, accumulation de petites
plantes.
Rendu : sophistication sobre, contraste doux.`;

const STYLE_E_CHAMBRE_PARENTALE = `E — SCANDI LUMINEUX — CHAMBRE PARENTALE

Linge de lit : blanc chaud et gris clair chaud, touche bleu grisé discret.
Tête de lit : chêne très clair ou frêne, ou tissu gris clair, lignes droites.
Chevets : chêne très clair, pieds fins, lignes droites.
Luminaires : métal blanc ou noir fin, verre opalin, formes nordiques simples.
Tapis : laine claire, unie ou à motif graphique très discret.
Rideaux : blanc chaud, légers.
Décoration murale : cadres graphiques simples, décoration très minimale.
À éviter : terracotta, bois foncé, tapis jute épais, rotin massif, ambiance cocooning
beige trop chargée.
Rendu : luminosité, sobriété, espace visuel.`;

// ─── CHAMBRE ENFANT ──────────────────────────────────────────────────────────
// Les indices enfantins sont des POSSIBILITÉS, jamais des éléments obligatoires.

const STYLE_A_CHAMBRE_ENFANT = `A — NATUREL DOUX — CHAMBRE ENFANT

La palette dominante doit rester clairement :
ivoire, lin, beige très pâle et bois blond.
Les couleurs secondaires éventuelles
restent très discrètes.
Ne pas remplacer cette palette
par du rose dominant,
du vert sauge dominant
ou du bleu dominant.

Linge de lit : ivoire, lin et beige très pâle,
majoritairement uni ou très discrètement texturé.
Éviter les motifs enfantins répétés.
Lampe : abat-jour en tissu clair ou verre opalin.
Tapis : coton clair uni.
Rangements secondaires : chêne blond, formes légères et arrondies.
Décoration murale : un ou deux cadres doux, illustration minimale aux tons pâles.
Indice enfantin possible (facultatif, jamais obligatoire) : par exemple une peluche en lin
ou coton clair.
Interdit : vert olive dominant, terracotta, bois foncé, métal noir marqué, rotin, osier,
jute grossier, accumulation de plantes.`;

const STYLE_B_CHAMBRE_ENFANT = `B — CONTEMPORAIN CHALEUREUX — CHAMBRE ENFANT

Linge de lit : greige et crème, touche brun moyen.
Lampe : pied en métal noir fin et abat-jour clair, forme simple.
Tapis : uni greige.
Rangements secondaires et finition du bureau : bois moyen, lignes nettes.
Décoration murale : une affiche graphique simple à formes géométriques, sans texte.
Indice enfantin possible (facultatif, jamais obligatoire) : par exemple un jouet en bois
aux formes simples.
À éviter : bohème, rotin, paniers, jute dominant, coussins vert olive systématiques.`;

const STYLE_C_CHAMBRE_ENFANT = `C — MÉDITERRANÉEN SOBRE — CHAMBRE ENFANT

Linge de lit : blanc cassé et sable chaud, touche ponctuelle terracotta douce ou ocre.
Lampe : céramique mate.
Tapis : coton ou lin tissé à plat, ton sable.
Rangements secondaires et finition du bureau : bois patiné, formes simples.
Décoration murale : une illustration douce inspirée nature ou paysage.
Indice enfantin possible (facultatif, jamais obligatoire) : par exemple une peluche en
tissu naturel.
Interdit : rotin, osier, paniers dominants, jute omniprésent, macramé, look bohème,
coussins vert olive automatiques.`;

const STYLE_D_CHAMBRE_ENFANT = `D — ÉLÉGANT ORGANIQUE — CHAMBRE ENFANT

Linge de lit : crème et taupe, touche caramel.
Lampe : verre ambré ou bronze doux, forme arrondie.
Tapis : laine crème.
Rangements secondaires et finition du bureau : bois moyen, angles arrondis.
Décoration murale : une forme murale douce (arche, formes organiques).
Indice enfantin possible (facultatif, jamais obligatoire) : un seul élément doux, par
exemple une peluche ton caramel.
À éviter : rotin, jute rustique, décoration champêtre, accumulation de petits objets.`;

const STYLE_E_CHAMBRE_ENFANT = `E — SCANDI LUMINEUX — CHAMBRE ENFANT

Linge de lit : blanc chaud et gris clair, touche bleu grisé ou gris vert très léger.
Lampe : métal blanc fin.
Tapis : clair, motif graphique discret.
Rangements secondaires et finition du bureau : chêne clair ou frêne, pieds fins.
Décoration murale : cadres graphiques simples au trait (formes ou animaux stylisés).
Indice enfantin possible (facultatif, jamais obligatoire) : par exemple un jouet en bois
clair.
À éviter : terracotta, bois foncé, jute épais, rotin massif, accumulation d'objets.`;

// ─── CHAMBRE ADO ─────────────────────────────────────────────────────────────

const STYLE_A_CHAMBRE_ADO = `A — NATUREL DOUX — CHAMBRE ADO

Textiles : ivoire, lin, sable clair, ton sur ton.
Finition du bureau et chevet : chêne blond, lignes simples.
Luminaires : verre opalin ou tissu clair.
Tapis : laine fine ou coton clair.
Décoration murale : une œuvre abstraite douce.
Interdit : vert olive dominant, terracotta, bois foncé, métal noir marqué, rotin, osier,
jute grossier.
Rendu : calme et lumineux, jeune adulte.`;

const STYLE_B_CHAMBRE_ADO = `B — CONTEMPORAIN CHALEUREUX — CHAMBRE ADO

Textiles : greige et taupe, touche noir doux.
Finition du bureau et chevet : bois moyen avec détails en métal noir fin.
Luminaires : lampe de bureau articulée en métal noir, formes géométriques simples.
Tapis : uni, texture structurée.
Décoration murale : affiche abstraite graphique, sans texte.
À éviter : bohème, rotin, paniers, jute dominant.
Rendu : le plus « jeune adulte » des cinq, structuré.`;

const STYLE_C_CHAMBRE_ADO = `C — MÉDITERRANÉEN SOBRE — CHAMBRE ADO

Textiles : blanc cassé et sable chaud, touche ponctuelle ocre ou terracotta.
Finition du bureau et chevet : bois patiné.
Luminaires : céramique ou verre, jamais rotin ni osier.
Tapis : tissé à plat, ton sable.
Décoration murale : image inspirée architecture ou paysage.
Interdit : rotin, osier, paniers dominants, jute omniprésent, macramé, look bohème.`;

const STYLE_D_CHAMBRE_ADO = `D — ÉLÉGANT ORGANIQUE — CHAMBRE ADO

Textiles : crème, taupe, touche caramel ou brun chaud.
Finition du bureau et chevet : bois moyen à foncé, angles arrondis.
Luminaires : bronze ou verre fumé.
Tapis : laine crème ou beige grisé.
Décoration murale : art abstrait affirmé, un objet sculptural.
À éviter : rotin, jute rustique, décoration champêtre.`;

const STYLE_E_CHAMBRE_ADO = `E — SCANDI LUMINEUX — CHAMBRE ADO

Textiles : blanc chaud, gris clair, touche bleu grisé.
Finition du bureau et chevet : chêne clair, pieds fins.
Luminaires : métal blanc ou noir fin.
Tapis : clair, motif graphique discret.
Décoration murale : cadres graphiques simples.
À éviter : terracotta, bois foncé, jute épais, accumulation d'objets.`;

const CADRES_CHAMBRES = {
  chambre_parentale: CADRE_CHAMBRE_PARENTALE,
  chambre_enfant: CADRE_CHAMBRE_ENFANT,
  chambre_ado: CADRE_CHAMBRE_ADO,
};

// Famille → pièce → déclinaison (STYLE_B_CHAMBRE_PARENTALE, etc.)
const DECLINAISONS_CHAMBRES = {
  A: { chambre_parentale: STYLE_A_CHAMBRE_PARENTALE, chambre_enfant: STYLE_A_CHAMBRE_ENFANT, chambre_ado: STYLE_A_CHAMBRE_ADO },
  B: { chambre_parentale: STYLE_B_CHAMBRE_PARENTALE, chambre_enfant: STYLE_B_CHAMBRE_ENFANT, chambre_ado: STYLE_B_CHAMBRE_ADO },
  C: { chambre_parentale: STYLE_C_CHAMBRE_PARENTALE, chambre_enfant: STYLE_C_CHAMBRE_ENFANT, chambre_ado: STYLE_C_CHAMBRE_ADO },
  D: { chambre_parentale: STYLE_D_CHAMBRE_PARENTALE, chambre_enfant: STYLE_D_CHAMBRE_ENFANT, chambre_ado: STYLE_D_CHAMBRE_ADO },
  E: { chambre_parentale: STYLE_E_CHAMBRE_PARENTALE, chambre_enfant: STYLE_E_CHAMBRE_ENFANT, chambre_ado: STYLE_E_CHAMBRE_ADO },
};

// ═════════════════════════════════════════════════════════════════════════════
// CUISINE et ENTRÉE — déclinaisons validées (septembre 2026)
// Cuisine : le cadre dépend du type de cuisine (modeCuisine) :
//   - 'douce'      : cuisine existante, Valorisation douce → ambiance seulement
//   - 'modernisee' : cuisine datée, Projection modernisée → façades comprises
//   - 'complete'   : cuisine vide ou incomplète → famille appliquée pleinement
// En mode 'douce', seule la partie AMBIANCE de la déclinaison est transmise :
// le modèle ne reçoit aucune teinte de façade, il ne peut donc pas repeindre.
// ═════════════════════════════════════════════════════════════════════════════

const PRIORITE_MATERIAUX_CARACTERE = `Les matériaux de caractère existants restent prioritaires sur la famille stylistique :
terre cuite, tomettes, plafond bois, poutres, faïence artisanale, pierre,
élément architectural fort. La famille s'y adapte et ne doit jamais effacer
ce qui fait le charme du bien.`;

const CADRE_CUISINE_DOUCE = `CADRE STYLE_VARIANT — CUISINE EXISTANTE, VALORISATION DOUCE

La famille stylistique agit uniquement, et légèrement, sur l'ambiance :
petite décoration, objets, textile éventuel, tapis éventuel, luminaire décoratif,
touches décoratives.

Elle ne modifie jamais : les façades existantes, leur couleur, les poignées,
le plan de travail, la crédence, ni l'identité principale de la cuisine.
Elle ne modifie jamais l'implantation, les ouvertures ni les volumes.

` + PRIORITE_MATERIAUX_CARACTERE;

const CADRE_CUISINE_MODERNISEE = `CADRE STYLE_VARIANT — CUISINE DATÉE, PROJECTION MODERNISÉE

La famille stylistique peut orienter : les façades, les poignées, le plan de travail,
la crédence, l'éclairage et l'ambiance générale.

Elle respecte strictement : l'implantation, les caissons et leurs emplacements,
la hotte, les ouvertures, les volumes et les matériaux de caractère.

` + PRIORITE_MATERIAUX_CARACTERE + `

BOIS DATÉ OU BOIS DE CARACTÈRE

Un bois n'est pas considéré comme daté uniquement parce qu'il est ancien ou foncé.

BOIS DE CARACTÈRE — à conserver :
- bois massif ou visuellement qualitatif ;
- veinage naturel intéressant ;
- façades travaillées ou menuiserie cohérente avec le caractère du logement ;
- bois en harmonie avec d'autres éléments existants : plafond, poutres, sol, encadrements ;
- ensemble ancien mais encore esthétique et valorisable.

BOIS DATÉ — peut être repeint dans la teinte de façade de la famille :
- finition orangée ou jaunie, ou vernis très marqué ;
- cuisine générique dont la teinte et la finition vieillissent fortement l'ensemble ;
- façades lourdes ou visuellement datées sans valeur particulière ;
- bois dont la modernisation valorise la cuisine sans supprimer un élément
  patrimonial ou caractéristique du bien.

Si les façades sont repeintes : mêmes caissons, mêmes emplacements, même hotte ;
les moulures des portes peuvent rester visibles sous la peinture.

En cas de doute : conserver le bois et moderniser autour de lui plutôt que le repeindre.`;

const CADRE_CUISINE_COMPLETE = `CADRE STYLE_VARIANT — CUISINE VIDE OU INCOMPLÈTE

La cuisine étant créée ou complétée, la famille stylistique s'applique pleinement :
façades, plan de travail, crédence, poignées, éclairage, tapis éventuel et ambiance.

Elle ne modifie jamais : l'implantation déduite des arrivées et éléments techniques
visibles, les ouvertures, les volumes ni les proportions de la pièce.

` + PRIORITE_MATERIAUX_CARACTERE;

const CADRES_CUISINE = {
  douce: CADRE_CUISINE_DOUCE,
  modernisee: CADRE_CUISINE_MODERNISEE,
  complete: CADRE_CUISINE_COMPLETE,
};

// Chaque déclinaison cuisine = { facades, ambiance }.
// facades : transmis en modes 'modernisee' et 'complete' uniquement.
const DECLINAISONS_CUISINE = {
  A: {
    facades: `A — NATUREL DOUX — CUISINE
Esprit : très clair, doux, ton sur ton, presque sans contraste.
Façades : ivoire, lin, blanc cassé chaud ou beige très pâle, finition mate.
Plan de travail : chêne blond, ou composite crème mat.
Crédence : carreau uni crème mat ou zellige ivoire, joints clairs.
Métaux et poignées : prises intégrées, bois clair ou laiton brossé très fin ; jamais de métal noir.`,
    ambiance: `A — NATUREL DOUX — AMBIANCE CUISINE
Tapis : facultatif ; si présent, tissé plat coton ou laine écru ; jamais de jute.
Luminaire : suspension en verre opalin ou céramique blanche.
Accessoires : céramique mate claire, torchon lin, une plante légère au plus.
Interdit : vert olive dominant, terracotta, bois foncé, métal noir marqué, rotin, osier, jute.`,
  },
  B: {
    facades: `B — CONTEMPORAIN CHALEUREUX — CUISINE
Esprit : lignes nettes, plus graphique, contraste modéré.
Façades : grège, taupe ou cachemire, mates ou satinées.
Plan de travail : noyer clair ou bois moyen, ou composite effet pierre gris chaud.
Crédence : carreaux rectangulaires gris chaud posés verticalement, ou panneau effet pierre.
Métaux et poignées : noir doux, profils longs et fins.`,
    ambiance: `B — CONTEMPORAIN CHALEUREUX — AMBIANCE CUISINE
Tapis : facultatif ; si présent, tissé plat graphique grège et brun.
Luminaire : suspensions métal noir fin et verre fumé.
Accessoires : peu d'objets, céramique brune, pas de plante ou une seule.
À éviter : bohème, rotin, paniers, jute, vert olive.`,
  },
  C: {
    facades: `C — MÉDITERRANÉEN SOBRE — CUISINE
Esprit : lumineux et solaire, matériaux minéraux, jamais bohème.
Façades : blanc cassé, sable chaud ou pierre claire ; ou bois patiné clair.
Plan de travail : pierre claire, béton ciré clair ou bois patiné.
Crédence : zellige blanc cassé ou sable ; une touche terracotta très ponctuelle possible, jamais dominante.
Métaux et poignées : laiton patiné, fer patiné ou boutons céramique.`,
    ambiance: `C — MÉDITERRANÉEN SOBRE — AMBIANCE CUISINE
Tapis : facultatif ; si présent, coton tissé à fines rayures sable et ocre doux ; jamais jute ni rotin.
Luminaire : suspension céramique ou verre, ou métal patiné.
Accessoires : poteries artisanales, bois d'olivier, bouteille d'huile ; une touche olive possible en accent, jamais dominante.
Interdit : rotin, osier, panier dominant, jute, macramé, look bohème.`,
  },
  D: {
    facades: `D — ÉLÉGANT ORGANIQUE — CUISINE
Esprit : plus profond et sophistiqué, contraste doux, formes arrondies.
Façades : taupe chaud, brun fumé ou crème ; ou bois moyen à foncé type noyer.
Si des façades en bois daté sont repeintes : taupe chaud ou crème uniquement, jamais bois foncé.
Plan de travail : pierre claire légèrement veinée ou quartz crème.
Crédence : la même pierre en panneau, ou carreaux crème légèrement brillants.
Métaux et poignées : bronze ou laiton vieilli, formes arrondies.`,
    ambiance: `D — ÉLÉGANT ORGANIQUE — AMBIANCE CUISINE
Tapis : le plus souvent absent ; si présent, laine unie crème ou brun doux.
Luminaire : verre soufflé ambré ou bronze, formes organiques.
Accessoires : objets sculpturaux, céramique, bois tourné, peu nombreux.
À éviter : rotin, jute, décoration champêtre, accumulation de petites plantes.`,
  },
  E: {
    facades: `E — SCANDI LUMINEUX — CUISINE
Esprit : très lumineux, fonctionnel, visuellement léger.
Façades : blanc chaud mat ou gris clair chaud ; éventuellement bleu grisé très pâle et désaturé.
Jamais de façade verte, même pâle.
Plan de travail : chêne très clair ou frêne, ou stratifié blanc.
Crédence : carreau blanc brillant, format métro ou carré, joints clairs.
Métaux et poignées : fines barres noir mat minimales, ou prises intégrées.`,
    ambiance: `E — SCANDI LUMINEUX — AMBIANCE CUISINE
Tapis : facultatif ; si présent, coton gris clair ou rayure noir et blanc discrète.
Luminaire : suspension métal blanc ou noir fin, ou verre opalin.
Accessoires : très peu, une plante au plus.
À éviter : terracotta, bois foncé, jute, rotin, accumulation d'objets.`,
  },
};

const ANTI_REPETITION_CUISINE = `RÈGLE ANTI-RÉPÉTITION — CUISINE

Ne jamais donner automatiquement à une cuisine des façades vert sauge ou vertes :
le vert n'est possible qu'en accent ponctuel olive dans la famille C.

Ne pas reproduire automatiquement d'une génération à l'autre :
- plan de travail chêne clair ;
- tapis de passage en jute ;
- pot d'herbes aromatiques ;
- planche à découper appuyée contre la crédence ;
- bande LED sous tous les meubles hauts.

Ces éléments restent possibles, mais ne doivent plus apparaître automatiquement.
Le tapis n'est jamais obligatoire et peut être absent si la cuisine ne s'y prête pas ;
s'il est présent, sa matière et son graphisme suivent la famille et il reste crédible
pour une cuisine.
Ne pas ajouter systématiquement une bande LED sous tous les meubles hauts ;
faire varier le traitement de l'éclairage selon la cuisine et la famille.

Faire varier réellement : teinte et finition des façades, matière du plan de travail,
format de la crédence, métal des poignées, présence et matière du tapis,
type de suspension.`;

const CADRE_ENTREE = `CADRE STYLE_VARIANT — ENTRÉE

La famille stylistique agit uniquement sur : la finition du mobilier prévu par le
module Entrée, le miroir, le luminaire, le textile et la décoration.

Elle n'ajoute aucun meuble ni équipement pour exprimer le style.
Elle ne réduit jamais le passage : une entrée étroite garde au maximum un meuble
peu profond, ou rien.
Elle ne modifie jamais l'architecture, les ouvertures, les portes ni les volumes.`;

const DECLINAISONS_ENTREE = {
  A: `A — NATUREL DOUX — ENTRÉE
Console, banc, miroir : console fine en chêne blond ou laquée ivoire ; banc chêne blond avec galette lin ; miroir rond ou arrondi à cadre bois clair très fin.
Textile : galette ou plaid lin écru ; tapis de passage tissé plat écru, jamais jute.
Luminaire : applique ou suspension en verre opalin.
Ambiance : très claire et calme ; un vase en céramique mate avec une branche végétale simple ou un feuillage discret, rien de plus.`,
  B: `B — CONTEMPORAIN CHALEUREUX — ENTRÉE
Console, banc, miroir : console en noyer clair à piètement métal noir fin ; banc aux lignes nettes ; miroir rectangulaire à cadre noir fin.
Textile : tapis de passage graphique grège et brun.
Luminaire : applique métal noir et verre fumé, ou lampe à poser graphique.
Ambiance : structurée ; un plateau, un livre, un objet en céramique brune ; peu ou pas de plante.`,
  C: `C — MÉDITERRANÉEN SOBRE — ENTRÉE
Console, banc, miroir : console en bois patiné ou plâtre clair ; banc bois patiné ; miroir à cadre bois naturel ou de forme arrondie simple.
Textile : tapis coton à fines rayures sable et ocre doux.
Luminaire : applique céramique blanche ou métal patiné.
Ambiance : solaire et minérale ; une jarre ou un vase en terre, une branche d'olivier en accent.
Interdit : rotin, osier, macramé, look bohème.`,
  D: `D — ÉLÉGANT ORGANIQUE — ENTRÉE
Console, banc, miroir : console aux formes arrondies en bois foncé ou pierre claire ; banc bouclette crème ; miroir organique à cadre bronze ou sans cadre.
Textile : tapis laine unie crème ou brun doux, ou absent.
Luminaire : applique verre ambré ou bronze, formes organiques.
Ambiance : sophistiquée et sobre ; un objet sculptural, une céramique, très peu d'éléments.`,
  E: `E — SCANDI LUMINEUX — ENTRÉE
Console, banc, miroir : console murale fine en frêne ; banc à pieds fins avec rangement à chaussures ; miroir rond à fin cadre noir ou blanc.
Si le module prévoit déjà un porte-manteau ou un rangement mural, sa finition est en bois clair.
Textile : tapis de passage coton gris clair ou rayure discrète.
Luminaire : applique métal blanc ou noir fin, verre opalin.
Ambiance : fonctionnelle et lumineuse ; un panier fermé en tissu, une plante au plus.`,
};

const ANTI_REPETITION_ENTREE = `RÈGLE ANTI-RÉPÉTITION — ENTRÉE

Ne pas reproduire automatiquement la combinaison :
miroir rond à cadre bois + console bois clair + panier en osier + vase avec branchages.

Faire varier réellement : forme et cadre du miroir, matière de la console,
luminaire, textile, objets décoratifs.
Ne pas ajouter artificiellement des objets uniquement pour créer de la variation.`;

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
 * Retourne { id, texte } de la famille sélectionnée pour cet appel.
 * Si familleForcee ("A" à "E") est fourni et valide, retourne directement
 * cette famille SANS avancer le compteur de rotation — c'est ce qui garantit
 * en production UNE famille par commande pour toutes les pièces.
 *
 * roomType détermine la déclinaison :
 *  - salon / salon_salle_a_manger (ou roomType absent) : texte V2 validé,
 *    strictement inchangé (famille + bloc partagé + différenciation) ;
 *  - chambres : CADRE + famille déclinée + anti-répétition chambres
 *    + différenciation chambres + adaptation au logement réel.
 *  - cuisine : CADRE selon modeCuisine ('douce' | 'modernisee' | 'complete')
 *    + déclinaison (façades seulement hors 'douce') + ambiance
 *    + anti-répétition cuisine + adaptation au logement réel ;
 *  - entrée : CADRE + déclinaison + anti-répétition entrée
 *    + adaptation au logement réel.
 */
function construireStyleVariant(familleForcee, roomType, modeCuisine = 'douce') {
  const famille = familleForcee
    ? ROTATION.find((f) => f.id === String(familleForcee).toUpperCase())
    : null;

  const familleChoisie = famille || prochaineFamilleStyle();

  if (roomType === 'cuisine') {
    // Mode inconnu → 'douce' : le cas le plus prudent (aucune façade modifiée).
    const mode = CADRES_CUISINE[modeCuisine] ? modeCuisine : 'douce';
    const declinaison = DECLINAISONS_CUISINE[familleChoisie.id];
    const parties = [CADRES_CUISINE[mode], ''];
    if (mode !== 'douce') parties.push(declinaison.facades, '');
    parties.push(declinaison.ambiance, '', ANTI_REPETITION_CUISINE, '', ADAPTATION_LOGEMENT_REEL);
    return { id: familleChoisie.id, texte: parties.join('\n') };
  }

  if (roomType === 'entree') {
    return {
      id: familleChoisie.id,
      texte: [
        CADRE_ENTREE,
        '',
        DECLINAISONS_ENTREE[familleChoisie.id],
        '',
        ANTI_REPETITION_ENTREE,
        '',
        ADAPTATION_LOGEMENT_REEL,
      ].join('\n'),
    };
  }

  if (CHAMBRES.includes(roomType)) {
    return {
      id: familleChoisie.id,
      texte: [
        CADRES_CHAMBRES[roomType],
        '',
        DECLINAISONS_CHAMBRES[familleChoisie.id][roomType],
        '',
        ANTI_REPETITION_CHAMBRES,
        '',
        DIFFERENCIATION_CHAMBRES,
        '',
        ADAPTATION_LOGEMENT_REEL,
      ].join('\n'),
    };
  }

  return {
    id: familleChoisie.id,
    texte: [familleChoisie.texte, '', BLOC_PARTAGE, '', REGLE_DIFFERENCIATION_OBLIGATOIRE].join('\n'),
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
  ADAPTATION_LOGEMENT_REEL,
  ANTI_REPETITION_CHAMBRES,
  DIFFERENCIATION_CHAMBRES,
  CADRES_CHAMBRES,
  DECLINAISONS_CHAMBRES,
};

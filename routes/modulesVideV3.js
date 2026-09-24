// Modules de pièce — Biens vides — V3
// Textes officiels validés, transmis tels quels. Ne pas réécrire, résumer
// ni compresser. Clés alignées sur les identifiants de pièce déjà utilisés
// côté frontend (ROOM_TYPES_VIDE). Pas de module "jardin" en V1.

const MODULES_VIDE_V3 = {
  salon: `SALON — BIEN VIDE

Créer uniquement un salon.

Ne pas ajouter de salle à manger
sauf si le module Salon/Salle à manger est sélectionné.

Analyser d’abord :
volume réel,
murs utilisables,
ouvertures,
radiateurs,
circulations.

Déterminer un point focal crédible.

Placer ensuite le canapé en fonction de la pièce réelle.

Le téléviseur peut être hors cadre
si sa position logique n’est pas visible.

Dans un salon petit ou étroit :
privilégier
- canapé droit 2 à 3 places ;
- table basse légère ;
- tapis adapté ;
- très peu de mobilier secondaire.

Ne jamais utiliser canapé d’angle,
méridienne ou plusieurs assises
si cela oblige visuellement à élargir la pièce
ou réduit la circulation.

Dans un volume plus généreux,
ajouter éventuellement :
fauteuil,
meuble TV,
luminaire
ou autre mobilier réellement utile.

Ne pas meubler systématiquement chaque zone vide.

Respecter strictement les proportions réelles.

Si une autre fonction est visible dans une pièce ouverte,
ne pas la réaménager comme un projet séparé.

Seul un rafraîchissement cosmétique général autorisé par le Noyau est possible.

OBJECTIF :
salon crédible,
chaleureux,
vendeur
et réellement compatible avec le volume visible.`,

  salon_salle_a_manger: `SALON / SALLE À MANGER — BIEN VIDE

Créer deux fonctions uniquement si le volume réel
permet clairement un salon ET un espace repas.

Analyser :
volume,
murs utilisables,
ouvertures,
radiateurs,
circulations,
accès éventuel à la cuisine.

Déterminer d’abord le point focal du salon,
puis placer le canapé.

SALON :
canapé proportionné,
table basse,
tapis,
mobilier secondaire uniquement si utile.

SALLE À MANGER :
table aux dimensions réalistes
avec dégagement suffisant.

Petit espace :
2 à 4 places.

Espace moyen :
environ 4 places.

Grand espace :
4 à 6 places si cela reste réellement compatible.

Créer deux zones lisibles et harmonieuses
sans les surcharger.

Ne jamais forcer une seconde fonction
si la pièce ne la permet pas.

Dans une pièce étroite,
privilégier un canapé droit 2–3 places
et un mobilier visuellement léger.

Ne jamais élargir la pièce
ou réduire les circulations
pour faire tenir le salon et la salle à manger.

Préserver particulièrement l’accès à la cuisine
lorsqu’elle est visible.`,

  chambre_parentale: `CHAMBRE PARENTALE — BIEN VIDE

Créer une chambre parentale chaleureuse,
lumineuse,
élégante
et crédible.

Respecter strictement :
architecture,
fenêtres,
portes,
radiateurs,
placards,
décrochements,
proportions
et circulations.

Le lit est le mobilier principal.

Adapter sa taille au volume réel :

petite chambre :
140×190 privilégié.

chambre moyenne :
140×190 ou 160×200.

chambre généreuse :
160×200 possible.

Ne jamais utiliser automatiquement un lit 180 cm.

Ne jamais réduire artificiellement ses dimensions.

Choisir un emplacement naturel
et réellement compatible avec la pièce.

Ajouter 1 ou 2 tables de chevet selon la place,
éclairage adapté,
linge de lit,
tapis éventuellement,
et mobilier secondaire uniquement s’il apporte une vraie fonction.

Ne pas ajouter automatiquement :
bureau,
fauteuil,
commode.

Si une finition très datée empêche la projection,
autoriser un rafraîchissement cosmétique cohérent avec le Noyau.

Créer une vraie chambre parentale vendeuse,
mais jamais une suite d’hôtel artificielle ou surdécorée.`,

  cuisine: `CUISINE — BIEN VIDE

Respecter strictement :
géométrie,
largeur,
profondeur,
retours de murs,
niches,
décrochés,
ouvertures,
circulations,
éléments techniques visibles
et proportions réelles.

Ne jamais déplacer une paroi ou un volume technique
pour faciliter l’aménagement.

Une cuisine étroite doit rester visiblement étroite.

LE MOBILIER S’ADAPTE À LA GÉOMÉTRIE.
LA GÉOMÉTRIE NE S’ADAPTE JAMAIS AU MOBILIER.


CUISINE EXISTANTE ENCORE PRÉSENTABLE

Valoriser l’existant avec une modernisation légère :
désencombrement,
harmonisation,
petites améliorations de finitions.


CUISINE EXISTANTE CLAIREMENT DATÉE

Autoriser une modernisation visuelle cohérente :

- façades ;
- poignées ;
- plan de travail ;
- crédence ;
- finitions murales ;
- éclairage si nécessaire.

Conserver :
géométrie,
contraintes techniques
et implantation crédible.

Moderniser la cuisine,
jamais la pièce.


CUISINE PARTIELLE / INCOMPLÈTE

Si l’existant est incomplet,
disparate
ou peu vendeur,
il n’est pas nécessaire de conserver chaque meuble.

Autoriser une recomposition cohérente
pour créer une cuisine complète et fonctionnelle.

Respecter strictement :
géométrie,
retours de murs,
ouvertures,
circulations,
éléments techniques
et proportions.

Recomposer le mobilier si nécessaire,
jamais la pièce.


CUISINE VIDE

Créer une cuisine complète et crédible avec :
meubles bas,
plan de travail,
évier,
cuisson,
rangements,
four,
réfrigérateur,
et meubles hauts/hotte uniquement si pertinents.

Le réfrigérateur doit être prévu dans l’aménagement.

Créer une relation fonctionnelle crédible entre :
réfrigérateur,
évier,
préparation,
cuisson,
rangements.

Îlot ou coin repas uniquement si le volume permet réellement
un dégagement confortable.

Ne jamais créer une cuisine showroom
ou d’un standing incompatible avec le logement.

Décoration légère.

Éviter :
affiches à texte,
accumulation de plantes.


TEST FINAL

Les meubles tiennent-ils réellement dans CETTE géométrie,
sans déplacer ni élargir visuellement quoi que ce soit ?`,

  salle_bain: `SALLE DE BAIN — BIEN VIDE

Valoriser la salle de bain
dans un style lumineux,
chaleureux,
sobre
et crédible.

Respecter strictement :
dimensions,
murs,
fenêtres,
sanitaires,
radiateurs,
arrivées visibles,
équipements fixes,
circulation,
perspective
et cadrage.

Conserver les sanitaires et équipements principaux
à leurs emplacements réels
lorsque leur position est clairement visible.

Une salle de bain petite ou étroite
doit rester visiblement petite ou étroite.

Moderniser les finitions ne doit jamais :
- élargir visuellement la pièce ;
- déplacer les sanitaires ;
- modifier les proportions des ouvertures ;
- inventer une nouvelle configuration.

Autoriser un rafraîchissement crédible des revêtements
lorsqu’ils vieillissent fortement la pièce.

Créer une salle de bain :
simple,
propre,
lumineuse
et vendeuse.

Pas une salle de bain de luxe irréaliste.

Ajouter seulement quelques éléments utiles :
miroir,
linge,
petits accessoires,
végétation discrète si pertinente.

Ne pas surcharger.`,

  chambre_enfant: `CHAMBRE ENFANT — BIEN VIDE

Créer une chambre enfant douce,
lumineuse,
chaleureuse
et vendeuse.

Respecter strictement :
architecture,
fenêtres,
portes,
radiateurs,
proportions
et circulations.

LIT ENFANT — EMPLACEMENT

Utiliser un lit enfant 90×190 cm
aux proportions réalistes.
Ne jamais modifier ces dimensions.

Avant de placer le lit, analyser :
- les murs réellement exploitables ;
- la fenêtre ;
- le radiateur ;
- la porte ;
- les placards ;
- la circulation ;
- les proportions réelles de la pièce.

Comparer les différentes implantations crédibles
avant de choisir la position la plus naturelle du lit.

Le lit ne doit PAS être automatiquement plaqué
dans sa longueur contre un mur latéral.

Lorsque la géométrie le permet, privilégier :
- la tête de lit contre un mur principal ;
- le lit développé perpendiculairement à ce mur ;
- un ou deux côtés du lit dégagés
  lorsque cela reste crédible.

Le placement contre un mur latéral reste possible
lorsque la taille ou la configuration réelle de la pièce
le justifie clairement.

Ne jamais forcer une autre disposition
si elle réduit la circulation
ou gêne une ouverture,
un radiateur,
une porte,
un placard
ou un rangement.

Avant de retenir un emplacement,
vérifier qu’un lit de dimensions réelles 90×190 cm
peut physiquement y tenir
sans réduction, raccourcissement,
déformation ou miniaturisation.

Les dimensions 90×190 sont une contrainte fixe.

Si le lit ne tient pas réellement
avec les dégagements nécessaires,
rejeter cet emplacement
et choisir une autre implantation crédible.

Ne jamais adapter la taille du lit
pour conserver un emplacement choisi.

Ordre de décision :
1. conserver strictement le lit 90×190 ;
2. vérifier qu’il tient réellement ;
3. vérifier ouvertures, radiateur, porte, placards et circulation ;
4. seulement ensuite valider l’emplacement.

LA CRÉDIBILITÉ DE L’AMÉNAGEMENT
PRIME SUR LA VARIÉTÉ.

Ajouter seulement selon la place :
petite table de chevet,
rangement léger,
tapis,
éclairage,
quelques textiles
et quelques indices enfantins discrets.

Éviter :
- accumulation de peluches ;
- multiplication des paniers ;
- tapis rond systématique ;
- plusieurs affiches enfantines ;
- textes muraux automatiques ;
- plantes systématiques ;
- décoration trop bébé ;
- décoration trop genrée.

INDICES ENFANTINS — SOBRIÉTÉ

Le rendu doit évoquer une chambre d’enfant
sans accumulation décorative.

Maximum :
2 indices enfantins clairement visibles
dans toute la pièce,
toutes catégories confondues.

Exemples d’indices enfantins :
- peluche ;
- jouet ;
- illustration enfantine ;
- objet décoratif ludique ;
- panier à motif enfantin ;
- petite maison ou figurine.

Ne pas chercher à représenter toutes ces catégories.
Une chambre peut n’avoir qu’un seul indice enfantin
si cela suffit.

Éviter notamment :
- plusieurs peluches ;
- plusieurs paniers ;
- plusieurs affiches enfantines ;
- accumulation de jouets ;
- multiplication d’objets décoratifs ludiques.

Le mobilier fonctionnel neutre
(bureau, bibliothèque, rangement, lampe)
ne compte pas comme indice enfantin.

NEUTRALITÉ

La chambre doit rester neutre et largement projetable
pour une annonce immobilière.

Éviter une palette fortement genrée.

Le rose ou le bleu peuvent apparaître
comme petite touche secondaire
si la famille stylistique le permet,
mais ne doivent pas devenir
la couleur dominante de la chambre.

La chambre doit suggérer clairement sa fonction
sans devenir une mise en scène enfantine trop personnalisée.`,

  chambre_ado: `CHAMBRE ADO — BIEN VIDE

Créer une chambre adolescente actuelle,
chaleureuse,
fonctionnelle
et crédible.

Respecter strictement :
architecture,
ouvertures,
radiateurs,
proportions,
perspective
et circulations.

Analyser la pièce avant de choisir l’implantation.


LIT

Utiliser un lit aux dimensions réelles
avec priorité à la compacité visuelle.

Petite ou moyenne chambre :
90×190 ou 90×200 par défaut.

120×200 uniquement si le volume
permet une circulation confortable.

140×190/200 uniquement
dans une chambre nettement plus grande.

Ne jamais :
raccourcir,
élargir,
miniaturiser
ou surdimensionner le lit
pour améliorer la composition.

Ajouter un bureau
si la place réelle le permet.

Sinon ne pas le forcer.

Ajouter éventuellement :
petite table de chevet,
rangement léger,
tapis,
éclairage,
quelques accessoires sobres.

Créer une ambiance ado :
ni enfantine,
ni chambre d’hôtel.

Éviter :
textes décoratifs systématiques,
accumulation d’affiches,
multiplication des plantes,
bureau surchargé,
style trop genré
ou trop personnalisé.

La pièce doit rester visuellement aérée.`,

  balcon_terrasse: `BALCON / TERRASSE — BIEN VIDE

Valoriser l’espace
comme un véritable extérieur fonctionnel et vendeur.

Respecter strictement :
dimensions,
profondeur,
murs,
ouvertures,
portes,
garde-corps,
séparations,
éléments techniques,
sol,
perspective
et cadrage.

Respecter la nature exacte des séparations.

Une séparation vitrée doit rester :
vitrée,
transparente
et à la même position.

Ne jamais :
- transformer une séparation vitrée en mur plein ;
- déplacer une séparation ;
- raccourcir ou rallonger visuellement l’espace ;
- élargir artificiellement le balcon ou la terrasse.

Toujours laisser complètement libre
l’accès à la porte ou porte-fenêtre.

Ne placer aucun meuble
ou pot volumineux
devant une ouverture.


PETIT BALCON

Mobilier extérieur léger.

1 ou 2 assises.

Petite table uniquement
si elle tient réellement.

Peu de profondeur.

Beaucoup de sol visible.


TERRASSE PLUS LARGE

Coin repas OU détente
selon le volume.

Deux fonctions uniquement
si la place réelle le permet.

Préserver clairement :
garde-corps,
vue,
ouverture vers l’extérieur.

Ne pas masquer excessivement l’espace avec les plantes.

Éviter les grands tapis
sur les petits balcons.

Le rendu doit être immédiatement identifiable
comme balcon ou terrasse,

jamais comme :
entrée,
véranda
ou pièce intérieure.`,

  entree: `ENTRÉE — BIEN VIDE

OBJECTIF PRIORITAIRE :

faire comprendre immédiatement
où se situe la zone d’entrée du logement.

Identifier d’abord la porte d’entrée,
puis matérialiser visuellement sa zone
sans gêner les circulations.

Respecter strictement :
architecture,
portes,
placards,
ouvertures,
renfoncements,
proportions,
perspective,
cadrage
et circulations.

Aménager uniquement l’entrée
ou le dégagement demandé.

Ne pas meubler ni décorer
les pièces voisines visibles.


PRIVILÉGIER QUELQUES ÉLÉMENTS SEULEMENT :

- petit tapis naturel ;
- miroir ;
- tablette murale ;
- console fine uniquement si elle possède réellement un emplacement adapté ;
- petite assise ou rangement compact si la place le permet.


TAPIS

Ajouter de préférence un petit tapis
rond ou rectangulaire,
en :
jute,
sisal,
laine
ou tissage naturel.

Il ne doit jamais gêner
l’ouverture des portes.


RENFONCEMENTS

Lorsqu’une niche
ou un renfoncement existe,
l’exploiter en priorité
avec une tablette murale fine
ou un rangement compact.

Ne jamais placer une console
dans un couloir de circulation
simplement parce qu’un mur paraît disponible.

Si aucun emplacement ne convient,
ne pas ajouter de meuble au sol.


HIÉRARCHIE :

identifier la porte d’entrée
→ matérialiser sa zone
→ préserver les circulations
→ meubler seulement si nécessaire.`,
};

module.exports = MODULES_VIDE_V3;

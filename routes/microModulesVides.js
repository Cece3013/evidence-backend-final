// Micro-modules — Biens vides — Version Application V1
// Activés uniquement sur demande explicite du client.

module.exports = {
  coin_repas: `MICRO-MODULE 01 — COIN REPAS
BIEN VIDE — VERSION APPLICATION V1
ACTIVER UNIQUEMENT SI :
• LOCKED_LAYOUT prévoit explicitement un espace repas ;
• la pièce n’est pas déjà traitée par le module SALON / SALLE À MANGER ;
• les dimensions permettent réellement son utilisation.
OBJECTIF
Matérialiser un coin repas secondaire sobre, réaliste et proportionné.
Respecter strictement l’emplacement et l’orientation définis dans LOCKED_LAYOUT.
Utiliser uniquement :
• une table adaptée à l’espace ;
• 2 à 4 chaises selon la capacité réellement validée.
Privilégier mobilier visuellement léger, bois clair, matières naturelles, formes simples et dimensions standards réalistes.
Ne pas ajouter automatiquement buffet, vaisselier, console, grande suspension ou décoration abondante.
Les chaises doivent sembler réellement utilisables.
Conserver suffisamment de place pour tirer les chaises, circuler, accéder aux ouvertures et utiliser les autres fonctions de la
pièce.
NE PAS réduire artificiellement la table ou les chaises pour faire entrer le coin repas.
PRINCIPE :
COIN REPAS RÉELLEMENT UTILISABLE > COIN REPAS PHOTOGÉNIQUE.`,

  espace_bureau: `MICRO-MODULE 02 — ESPACE BUREAU
BIEN VIDE — VERSION APPLICATION V1
ACTIVER UNIQUEMENT SI :
• LOCKED_LAYOUT prévoit explicitement une zone bureau ;
• l’espace réel permet un poste de travail fonctionnel ;
• le bureau apporte une véritable information immobilière utile.
OBJECTIF
Matérialiser un espace de travail discret, réaliste et fonctionnel.
Respecter strictement l’emplacement prévu dans LOCKED_LAYOUT.
Utiliser :
• un bureau de dimensions réalistes ;
• une chaise réellement utilisable.
Possibilités très légères : petite lampe, ordinateur portable, carnet, quelques livres.
Privilégier bois clair, blanc cassé, beige, lignes simples, mobilier léger visuellement.
Ne jamais créer mini-bureau artificiel, tablette trop étroite, installation gaming, grand bureau de direction ou accumulation
de rangement.
Préserver recul de la chaise, circulation, ouvertures, radiateurs et accès aux placards.
PRINCIPE :
VRAI ESPACE DE TRAVAIL > BUREAU DÉCORATIF.`,

  coin_lecture: `MICRO-MODULE 03 — COIN LECTURE / PETITE BIBLIOTHÈQUE
BIEN VIDE — VERSION APPLICATION V1
ACTIVER UNIQUEMENT SI :
• une zone secondaire réellement disponible a été validée ;
• aucune fonction principale n’est compromise ;
• la superficie est suffisante ;
• cette fonction améliore réellement la projection.
OBJECTIF
Créer un petit espace secondaire chaleureux sans surmeubler la pièce.
Possibilités : un fauteuil léger, petite table d’appoint, lampadaire discret, petite bibliothèque ou quelques étagères sobres.
Ne pas utiliser automatiquement tous ces éléments.
Éviter grande bibliothèque, mur entier d’étagères, fauteuil massif, accumulation de livres et multiplication des accessoires.
Ne jamais utiliser ce micro-module dans un passage, devant un radiateur, devant une ouverture ou dans une petite pièce
déjà suffisamment meublée.
PRINCIPE :
ESPACE SECONDAIRE UTILE > REMPLISSAGE D’UN VIDE.`,

  habillage_irregularite: `MICRO-MODULE 04 — HABILLAGE LÉGER D’UNE IRRÉGULARITÉ
BIEN VIDE — VERSION APPLICATION V1
ACTIVER UNIQUEMENT SI :
• une irrégularité architecturale réelle a été identifiée ;
• elle ne doit évidemment pas être supprimée ;
• une solution décorative légère et réversible a été explicitement validée.
OBJECTIF
Adapter légèrement l’aménagement à une irrégularité réelle sans modifier l’architecture.
Peut permettre, selon la situation : panneau décoratif léger, tête de lit indépendante, tablette légère, habillage réversible,
petite menuiserie décorative non structurelle.
La solution doit être physiquement réalisable, simple, peu coûteuse, réversible et cohérente avec une démarche de home
staging.
Ne jamais créer un faux mur complet, supprimer un décroché, modifier la géométrie, créer un coffrage structurel imaginaire
ou masquer une contrainte qui restera présente lors de la visite.
ARCHITECTURE RÉELLE = TOUJOURS CONSERVÉE.
PRINCIPE :
ADAPTER LE MOBILIER À L’ARCHITECTURE,
PAS L’ARCHITECTURE AU MOBILIER.

22. Checklist d’intégration finale











Prompt A : sortie JSON uniquement.
Prompt B : sortie JSON uniquement.
Prompt C : lancé uniquement si generation_ready = true et locked_layout.status = LOCKED.
Une seule photo est transformée : la PHOTO_PRINCIPALE.
Les photos complémentaires servent à A et B, pas à la fusion de l’image finale.
Un seul MODULE_PIECE doit être injecté par génération.
ACTIVE_MICRO_MODULES peut être [].
Les micro-modules ne sont jamais activés automatiquement pour “embellir” une image.
En cas de contradiction, la hiérarchie du Prompt C est prioritaire.
Ne pas intégrer les anciennes versions archivées en parallèle de ce pack.

23. Résumé technique à transmettre au développeur
Pipeline officiel : Photos → A → B → C V2 → image.
Règle centrale : A comprend, B décide, C exécute. Le modèle image ne doit pas être chargé de refaire
l’analyse spatiale ni de recomposer l’implantation.

Bibliothèque métier : Noyau + un module pièce + 0 à 4 micro-modules conditionnels.
Principe immobilier : architecture et contraintes réelles > implantation > mobilier > décoration.

24. AJOUT AU PACK - Modules Entrée et Jardin
Cet ajout complète le pack existant sans modifier les prompts déjà validés. Les deux modules ci-dessous
deviennent des MODULE_PIECE officiels au même titre que Salon, Cuisine, Chambre, Salle de bain ou Balcon
/ Terrasse.

24.1 MODULE ENTRÉE - Bien vide - Application V1`,

};

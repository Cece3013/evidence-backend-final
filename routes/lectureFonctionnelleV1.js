// Lecture Fonctionnelle — Biens vides — V1
// Étape légère, ajoutée entre le Contrôle Photo V2 et la génération,
// UNIQUEMENT pour salon et salon_salle_a_manger pour ce premier test.
// Décrit les zones fonctionnelles visibles en langage naturel courant.
// INTERDIT explicitement, conformément à la consigne : coordonnées,
// identifiants de murs (W1/W2...), floor_zone, forbidden_zone, support_anchor,
// reconstruction spatiale, multi-photo, synthèse complexe.

const LECTURE_FONCTIONNELLE_SALON_SAM = `LECTURE FONCTIONNELLE DE LA PHOTO — SALON / SALLE À MANGER

À partir de cette unique photo, identifie en langage naturel et de façon courte et concrète :
1. la zone la plus logique pour le salon ;
2. la zone la plus logique pour la salle à manger ;
3. les indices visibles qui justifient cette lecture (revêtement de sol différent, proximité
de la cuisine, baie vitrée, décroché architectural, etc.) ;
4. les zones à protéger : toute zone qui n'appartient ni au salon ni à la salle à manger et qui
doit rester libre de ce mobilier — notamment une cuisine visible même partiellement, un
passage ou dégagement dans l'axe d'une circulation ou d'un accès, un débattement de porte ;
5. la circulation principale à préserver entre les zones ;
6. les zones qui ne doivent surtout pas être inversées ni élargies au-delà de leurs limites
naturelles.

Pour chaque zone à protéger identifiée, préciser explicitement ce qui ne doit PAS y être
installé (par exemple : ne pas installer de table de salle à manger dans la cuisine ; ne pas
installer de meuble TV, buffet, console ou mobilier volumineux dans un passage ou une zone
de circulation).

Ne jamais utiliser de coordonnées, d'identifiants de murs, de codes de zones ou tout autre
système de référence abstrait. Décrire uniquement ce qui est visible, en langage naturel,
comme le ferait une décoratrice regardant la photo.

Rédige la réponse sous cette forme exacte, en l'adaptant à ce que montre réellement la photo :

LECTURE FONCTIONNELLE DE LA PHOTO

[décrire la zone salon : localisation, indice visuel]
[décrire la zone salle à manger : localisation, indice visuel, et sa limite précise si elle
est proche d'une autre zone]
[décrire chaque zone à protéger identifiée : ce qu'elle est (cuisine, passage, dégagement...)
et ce qui ne doit jamais y être installé]
[mentionner le décroché ou l'élément séparant les zones, s'il existe]

Implanter le canapé, la table basse et les éléments du salon uniquement dans la zone
identifiée comme salon.
Implanter la table à manger et les chaises uniquement dans la zone identifiée comme salle
à manger, sans jamais déborder dans une zone à protéger.
Ne jamais installer de meuble TV, buffet, console ou mobilier volumineux dans une zone de
passage ou de circulation identifiée comme à protéger.
Conserver un passage fluide entre les zones.
Ne pas inverser les deux fonctions.
Ne pas étendre une fonction dans la zone de l'autre ni dans une zone à protéger.

Si la photo ne permet pas de distinguer clairement deux zones fonctionnelles distinctes,
le dire explicitement plutôt que d'inventer une séparation.`;

const LECTURE_FONCTIONNELLE_SALON = `LECTURE FONCTIONNELLE DE LA PHOTO — SALON

À partir de cette unique photo, identifie en langage naturel et de façon courte et concrète :
1. la zone la plus logique pour le salon ;
2. les indices visibles qui justifient cette lecture ;
3. les autres zones fonctionnelles visibles sur la photo (coin repas, cuisine, dégagement...),
s'il y en a.

Ne jamais utiliser de coordonnées, d'identifiants de murs, de codes de zones ou tout autre
système de référence abstrait. Décrire uniquement ce qui est visible, en langage naturel,
comme le ferait une décoratrice regardant la photo.

Rédige la réponse sous cette forme exacte, en l'adaptant à ce que montre réellement la photo :

LECTURE FONCTIONNELLE DE LA PHOTO

[décrire la zone salon : localisation, indice visuel]
[si une autre fonction est visible sur la photo, la nommer et préciser qu'elle ne doit pas
être aménagée]

Implanter le canapé, la table basse et les éléments du salon uniquement dans la zone
identifiée.
Ne pas aménager les autres zones fonctionnelles visibles sur la photo.

Si aucune autre fonction n'est visible, le dire simplement : aucune zone supplémentaire à
préserver.`;

// ─── LECTURE FONCTIONNELLE RENFORCÉE — Salon/SAM UNIQUEMENT ───────────────────
// Isolée du reste : n'est utilisée que si roomType === "salon_salle_a_manger"
// ET que le drapeau ci-dessous est actif. Pour revenir immédiatement à
// l'ancienne version (LECTURE_FONCTIONNELLE_SALON_SAM ci-dessus) si les tests
// ne sont pas concluants, il suffit de repasser ce drapeau à false — rien
// d'autre à toucher, aucun autre module n'est concerné.
const LECTURE_RENFORCEE_SALON_SAM_ACTIVE = true;

const LECTURE_FONCTIONNELLE_SALON_SAM_RENFORCEE = `LECTURE FONCTIONNELLE RENFORCÉE — SALON / SALLE À MANGER

À partir de cette unique photo, rédige une lecture structurée en blocs numérotés, en
t'adaptant à ce que montre réellement la photo. Chaque bloc combine une description
concrète de ce qui est visible et la consigne impérative qui en découle directement —
ne jamais séparer la description de sa consigne.

Ne jamais utiliser de coordonnées, d'identifiants de murs, de codes de zones ou tout autre
système de référence abstrait. Décrire uniquement ce qui est visible, en langage naturel,
comme le ferait une décoratrice regardant la photo.

Rédige la réponse sous cette forme exacte :

LECTURE FONCTIONNELLE RENFORCÉE — SALON / SALLE À MANGER

1. ZONE SALON
[décrire la zone : localisation, indice visuel]
Le canapé doit être installé dans cette zone.
Le meuble TV doit également être installé dans cette zone, sur un mur cohérent avec
l'implantation du salon.
Aucun de ces deux meubles ne peut être placé dans l'entrée, la cuisine, un dégagement ou
un passage.

2. ZONE SALLE À MANGER
[décrire la zone : localisation, indice visuel, limite précise avec la zone voisine]
La table à manger et les chaises doivent être installées EXCLUSIVEMENT dans cette zone,
jamais dans la zone Cuisine ni dans une zone interdite listée ci-dessous.

3. ZONES INTERDITES AU MOBILIER PRINCIPAL
Pour chaque zone identifiée comme cuisine visible (même partiellement), entrée, dégagement
ou passage : [nommer la zone] — AUCUN meuble de salon ni de salle à manger n'y est autorisé,
même partiellement.
Si aucune zone interdite n'est visible, l'écrire explicitement : "Aucune zone interdite
identifiée."

4. RÈGLE DE NON-SUPPRESSION
Aucun des meubles principaux listés (canapé, meuble TV, table à manger, chaises) ne peut
être supprimé ou omis pour éviter un conflit de placement. Si l'espace semble juste,
réduire la taille ou le nombre de chaises plutôt que supprimer un meuble principal.

5. VÉRIFICATION AVANT GÉNÉRATION
Avant de générer, vérifier que :
— la table à manger n'est ni dans la cuisine ni dans l'entrée/le passage ;
— le meuble TV est bien dans la zone salon, jamais dans un dégagement ;
— aucun meuble principal n'a été supprimé ;
— la salle à manger doit rester visuellement rattachée au séjour, et non absorbée par la
cuisine.`;

// Types de pièce concernés par la Lecture Fonctionnelle.
// salon_salle_a_manger désactivé le 20/09/2026 — décision V1 : trois
// prototypes testés (lecture simple, renforcée, guide visuel) tous jugés
// non concluants sur ce cas. Retour au pipeline simple NOYAU + MODULE pour
// ce type de pièce. Code conservé, réactivable en remettant
// 'salon_salle_a_manger' dans ce tableau.
const ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE = ['salon'];

module.exports = {
  LECTURE_FONCTIONNELLE_SALON_SAM,
  LECTURE_FONCTIONNELLE_SALON,
  LECTURE_FONCTIONNELLE_SALON_SAM_RENFORCEE,
  LECTURE_RENFORCEE_SALON_SAM_ACTIVE,
  ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE,
};

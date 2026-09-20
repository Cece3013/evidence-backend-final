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

// Types de pièce concernés par ce premier test — à étendre plus tard sur
// décision explicite, pas automatiquement.
const ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE = ['salon', 'salon_salle_a_manger'];

module.exports = {
  LECTURE_FONCTIONNELLE_SALON_SAM,
  LECTURE_FONCTIONNELLE_SALON,
  ROOM_TYPES_AVEC_LECTURE_FONCTIONNELLE,
};

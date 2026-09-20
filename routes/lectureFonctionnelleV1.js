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
4. la circulation principale à préserver entre les deux zones ;
5. les zones qui ne doivent surtout pas être inversées.

Ne jamais utiliser de coordonnées, d'identifiants de murs, de codes de zones ou tout autre
système de référence abstrait. Décrire uniquement ce qui est visible, en langage naturel,
comme le ferait une décoratrice regardant la photo.

Rédige la réponse sous cette forme exacte, en l'adaptant à ce que montre réellement la photo :

LECTURE FONCTIONNELLE DE LA PHOTO

[décrire la zone salon : localisation, indice visuel]
[décrire la zone salle à manger : localisation, indice visuel]
[mentionner le décroché ou l'élément séparant les deux zones, s'il existe]

Implanter le canapé, la table basse et les éléments du salon uniquement dans la zone
identifiée comme salon.
Implanter la table à manger et les chaises uniquement dans la zone identifiée comme salle
à manger.
Conserver un passage fluide entre les deux espaces.
Ne pas inverser les deux fonctions.
Ne pas étendre une fonction dans la zone de l'autre.

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

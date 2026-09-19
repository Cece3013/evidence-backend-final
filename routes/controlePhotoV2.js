// Contrôle Photo V2 — Biens vides V1
// Une seule responsabilité : décider si la photo unique permet un
// aménagement immobilier crédible. Ne juge jamais l'état de la pièce
// au-delà de cette question.

const CONTROLE_PHOTO_V2 = `CONTRÔLE PHOTO — ÉVIDENCE BIENS VIDES

Analyser UNE SEULE photo principale.

Décider uniquement si cette photo permet de réaliser
un aménagement immobilier crédible.

Une photo est suffisante dès lors qu’elle montre assez clairement :
- le volume général utile ;
- les principales ouvertures visibles ;
- les contraintes importantes visibles ;
- suffisamment d’espace pour décider de l’implantation du mobilier principal.

Ne pas exiger :
- les quatre murs ;
- la porte d’entrée ;
- le mur opposé ;
- toutes les circulations.

Une zone cachée n’est PAS automatiquement un problème.

Refuser uniquement lorsque l’information invisible conditionne directement
l’emplacement du mobilier principal et empêche une décision crédible.

SI PHOTO SUFFISANTE :

{
  "status": "PHOTO_VALIDEE",
  "allow_generation": true,
  "reason": "explication courte",
  "retake_instruction": null
}

SI PHOTO INSUFFISANTE :

{
  "status": "PHOTO_A_REPRENDRE",
  "allow_generation": false,
  "reason": "explication courte",
  "retake_instruction": "une seule instruction simple et précise pour refaire une meilleure photo"
}

Ne jamais demander plusieurs photos complémentaires.

Si la photo doit être reprise,
la nouvelle photo devient la photo principale.`;

// Classification cuisine — ajoutée séparément du Contrôle Photo V2, sur
// demande explicite. Appelée UNIQUEMENT après un statut PHOTO_VALIDEE et
// UNIQUEMENT si la pièce sélectionnée est Cuisine. Ne rejuge jamais la photo
// elle-même (déjà validée) et ne décide pas de l'aménagement final — sert
// uniquement à déterminer si un choix de niveau de transformation doit être
// proposé à l'utilisateur avant génération.
const CLASSIFICATION_CUISINE = `CLASSIFICATION CUISINE — ÉVIDENCE BIENS VIDES
(appelée uniquement après PHOTO_VALIDEE, uniquement si la pièce sélectionnée est Cuisine)

MISSION
Analyser la photo principale déjà validée pour déterminer l’état réel de la cuisine visible,
afin de savoir si un choix de niveau de transformation doit être proposé à l’utilisateur
avant génération.

Ne pas juger la qualité ou la suffisance de la photo elle-même : elle a déjà été validée
par le Contrôle Photo V2. Ne pas décider de l’aménagement final : cette classification
sert uniquement à orienter l’expérience utilisateur en amont de la génération.

Choisir obligatoirement un seul statut parmi les quatre suivants :

CUISINE_EXISTANTE_PRESENTABLE
La cuisine existante est globalement complète et en état correct : meubles bas/hauts,
plan de travail et équipements principaux visibles et cohérents entre eux, sans vétusté
marquée des finitions.

CUISINE_EXISTANTE_DATEE
La cuisine existante est complète mais visuellement datée : façades, poignées, plan de
travail ou crédence clairement vieillis, abîmés ou esthétiquement dépassés.

CUISINE_PARTIELLE_INCOMPLETE
La cuisine visible est incomplète, disparate ou partiellement démontée : éléments
manquants, dépareillés, ou ne formant pas un ensemble cohérent et fonctionnel.

CUISINE_VIDE
Aucun meuble de cuisine significatif n’est visible ; la pièce est vide ou quasi vide,
sans installation exploitable.

FORMAT DE SORTIE
Retourner exclusivement un JSON valide, sans aucun texte hors JSON :

{
  "status": "CUISINE_EXISTANTE_PRESENTABLE | CUISINE_EXISTANTE_DATEE | CUISINE_PARTIELLE_INCOMPLETE | CUISINE_VIDE",
  "reason": "explication courte justifiant ce choix"
}`;

module.exports = { CONTROLE_PHOTO_V2, CLASSIFICATION_CUISINE };

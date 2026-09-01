// Prompt de contrôle post-génération — Biens vides
// Intervient APRÈS gpt-image-2, AVANT l'envoi vers Cloudinary/Notion pour
// validation par l'équipe. Compare la photo d'origine, l'image générée et le
// LOCKED_LAYOUT verrouillé par le Prompt B, pour détecter les cas où
// l'exécution par le modèle d'image s'écarte du plan pourtant correctement
// spécifié (architecture modifiée, élément hors champ rendu visible, meuble
// manquant, zone interdite obstruée, orientation non respectée...).

const PROMPT_D_CONTROLE = `PROMPT D — CONTRÔLE POST GÉNÉRATION BIEN VIDE — VERSION APPLICATION V1
MODE APPLICATION — VÉRIFICATION APRÈS GÉNÉRATION
MISSION
Comparer la PHOTO PRINCIPALE d’origine, l’IMAGE GÉNÉRÉE par le modèle de génération, et le LOCKED_LAYOUT verrouillé par
l’étape de décision d’implantation, afin de déterminer si l’image générée constitue une exécution fidèle du plan validé.
Cette étape intervient APRÈS la génération de l’image et AVANT toute transmission de cette image vers l’espace de
stockage et l’outil de suivi utilisés par l’équipe pour validation.
À cette étape :
• ne pas juger l’esthétique, le style ou le goût décoratif du résultat ;
• ne pas proposer de modification de décoration ;
• juger uniquement la fidélité factuelle entre ce qui était prévu et ce qui a été produit.
——————————————————————————————————————————
ENTRÉES
Deux images sont fournies, dans cet ordre :
1. PHOTO PRINCIPALE — la photographie d’origine du bien, avant toute transformation.
2. IMAGE GÉNÉRÉE — le résultat produit par le modèle de génération à partir de cette photo.
Un document JSON est également fourni, contenant :
• locked_layout — l’implantation verrouillée (mobilier principal, positions, orientations, visibilité attendue) ;
• spatial_constraints — les contraintes réelles (éléments fixes, circulations, zones interdites) ;
• main_photo_visibility — la classification de visibilité attendue pour chaque élément spatial.
——————————————————————————————————————————
1 — ARCHITECTURE ET CADRAGE
Comparer la PHOTO PRINCIPALE et l’IMAGE GÉNÉRÉE.
Vérifier que :
• le logement est immédiatement reconnaissable comme le même logement ;
• l’angle de prise de vue, le cadrage et la perspective n’ont pas changé ;
• aucun mur, aucune ouverture, aucun plafond, aucun sol n’a été modifié, déplacé ou recréé ;
• aucun élément architectural n’a été ajouté qui ne serait pas déjà visible sur la PHOTO PRINCIPALE ou explicitement
listé comme "visible" ou "partially_visible" dans main_photo_visibility.
Si un élément listé "strictly_out_of_frame" dans main_photo_visibility apparaît pourtant, visible ou partiellement visible,
dans l’IMAGE GÉNÉRÉE — qu’il s’agisse d’un meuble ou d’un élément fixe comme une porte — c’est une violation.
——————————————————————————————————————————
2 — PRÉSENCE DU MOBILIER PRINCIPAL
Pour chaque meuble de locked_layout.primary_furniture dont visibility_from_main_photo vaut "visible" ou
"partially_visible", vérifier qu’il est effectivement présent et reconnaissable dans l’IMAGE GÉNÉRÉE.
Un meuble attendu visible mais absent de l’image est une violation.
Pour chaque meuble dont visibility_from_main_photo vaut "strictly_out_of_frame", vérifier qu’il n’apparaît sous aucune
forme dans l’IMAGE GÉNÉRÉE. S’il apparaît, c’est une violation, même partielle.
——————————————————————————————————————————
3 — ORIENTATION ET RELATIONS FONCTIONNELLES
Pour chaque meuble dont orientation est précisée dans locked_layout, vérifier que l’orientation observée dans l’IMAGE
GÉNÉRÉE correspond raisonnablement à celle prévue. Exemple : un canapé dont l’orientation prévue est « face vers W3 »
doit visuellement faire face à l’espace où se trouve la télévision, pas lui tourner le dos ni être orienté de travers.
Pour chaque relation déclarée dans locked_layout.functional_relationships, vérifier que la relation est visuellement
respectée dans l’IMAGE GÉNÉRÉE (le canapé fait face à la TV, la table basse est accessible depuis l’assise, les chaises
entourent effectivement la table).
Une orientation clairement incohérente avec ce qui était prévu est une violation, même si le meuble concerné est bien
présent et bien positionné en termes de zone.
——————————————————————————————————————————
4 — ZONES INTERDITES ET CIRCULATIONS
Vérifier qu’aucun meuble, dans l’IMAGE GÉNÉRÉE, n’obstrue visuellement une zone listée dans
spatial_constraints.forbidden_zones — notamment l’accès à une baie vitrée, le débattement d’une porte, l’ouverture d’un
placard, ou une circulation principale.
——————————————————————————————————————————
5 — FORMAT DE SORTIE
Retourner exclusivement un JSON valide. Aucun texte hors JSON.
{
"prompt_name": "PROMPT D — CONTROLE POST GENERATION BIEN VIDE — VERSION APPLICATION V1",
"controle_status": "VALIDE | REJETE",
"architecture_preserved": true,
"main_viewpoint_preserved": true,
"forbidden_elements_visible": [
{ "item": "", "detail": "" }
],
"out_of_frame_furniture_visible": [
{ "item_id": "", "type": "", "detail": "" }
],
"required_furniture_missing": [
{ "item_id": "", "type": "", "detail": "" }
],
"orientation_conflicts": [
{ "item_id": "", "expected_orientation": "", "observed_issue": "" }
],
"forbidden_zones_violated": [
{ "zone_id": "", "detail": "" }
],
"issues_summary": "",
"next_step": "DELIVER | REGENERATE | MANUAL_REVIEW"
}
——————————————————————————————————————————
6 — RÈGLES DE DÉCISION POUR "next_step"
Si aucune violation n’est détectée dans les sections 1 à 4 :
"controle_status": "VALIDE"
"next_step": "DELIVER"
Si une ou plusieurs violations sont détectées, mais qu’elles sont précises et qu’une nouvelle génération avec une
instruction corrective ciblée a de bonnes chances de les corriger (élément hors champ visible, orientation incorrecte,
meuble manquant) :
"controle_status": "REJETE"
"next_step": "REGENERATE"
Si les violations touchent l’architecture elle-même, le cadrage, ou si elles sont multiples et structurelles au point qu’une
simple instruction corrective ne suffirait probablement pas :
"controle_status": "REJETE"
"next_step": "MANUAL_REVIEW"
Dans tous les cas de rejet, "issues_summary" doit décrire précisément et factuellement chaque problème constaté, de
façon exploitable comme instruction corrective pour une nouvelle génération.
——————————————————————————————————————————
PRINCIPE FINAL
NE PAS JUGER LE GOÛT.
JUGER LA FIDÉLITÉ AU PLAN VERROUILLÉ.
UN ÉLÉMENT HORS CHAMP RESTE HORS CHAMP.
UN MEUBLE ATTENDU DOIT ÊTRE PRÉSENT.
UNE ORIENTATION PRÉVUE DOIT ÊTRE RESPECTÉE.
UNE ZONE INTERDITE RESTE LIBRE SUR L’IMAGE COMME SUR LE PAPIER.`;

module.exports = { PROMPT_D_CONTROLE };

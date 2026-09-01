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
3 — POSITION, ANCRAGE ET ORIENTATION DU MOBILIER
Pour chaque meuble de locked_layout.primary_furniture, vérifier trois choses distinctes :
• son ancrage mural — le meuble apparaît-il visuellement dans la zone ou le mur décrit par location_anchor, ou a-t-il
été déplacé ailleurs dans l’image, par exemple regroupé avec d’autres meubles sans lien avec le mur d’ancrage prévu ?
• son orientation — correspond-elle à celle indiquée (un canapé « orienté vers W4 » doit visuellement faire face à cette
zone, pas lui tourner le dos) ?
• ses relations fonctionnelles — les paires déclarées dans functional_relationships sont-elles respectées visuellement ?
Un meuble bien présent et bien orienté, mais positionné sur un mur ou dans une zone différente de celle prévue dans
location_anchor, constitue une violation au même titre qu’une mauvaise orientation.
Une orientation clairement incohérente avec ce qui était prévu est une violation, même si le meuble concerné est bien
présent et bien positionné en termes de zone.
——————————————————————————————————————————
4 — ZONES INTERDITES ET CIRCULATIONS
Vérifier qu’aucun meuble, dans l’IMAGE GÉNÉRÉE, n’obstrue visuellement une zone listée dans
spatial_constraints.forbidden_zones — notamment l’accès à une baie vitrée, le débattement d’une porte, l’ouverture d’un
placard, ou une circulation principale.
——————————————————————————————————————————
4 BIS — RÉPARTITION SPATIALE ET DENSITÉ
Comparer la répartition du mobilier dans l’IMAGE GÉNÉRÉE avec le nombre et la diversité des usable_zones décrites dans
le LOCKED_LAYOUT, ainsi qu’avec layout_density.
Un défaut fréquent consiste à regrouper l’ensemble du mobilier dans une seule portion de l’image — souvent un angle ou
un tiers de la largeur —, en laissant une portion importante du sol visiblement vide sans qu’aucune zone interdite ni
contrainte ne le justifie. Ce n’est pas un simple choix esthétique : cela contredit l’implantation verrouillée, qui prévoyait
des zones distinctes réparties dans la pièce.
Vérifier que :
• le mobilier occupe raisonnablement les différentes zones utilisables décrites (usable_zones), et non une seule zone
condensée ;
• l’espace laissé vide dans l’image correspond à un espace réellement laissé libre par l’implantation — circulation,
zone interdite —, et non à un simple oubli d’occupation résultant d’un mobilier entassé ailleurs ;
• la densité observée est cohérente avec layout_density — une pièce "generous" ne doit pas donner l’impression d’un
mobilier entassé dans un angle alors que le reste du volume reste entièrement nu.
Si le mobilier apparaît anormalement concentré dans une portion réduite de l’image alors que plusieurs usable_zones
distinctes étaient prévues à des emplacements différents, c’est une violation.
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
"placement_conflicts": [
{ "item_id": "", "conflict_type": "orientation | wall_anchor | zone_mismatch", "expected": "", "observed_issue": "" }
],
"space_utilization_issue": {
"detected": false,
"detail": ""
},
"forbidden_zones_violated": [
{ "zone_id": "", "detail": "" }
],
"issues_summary": "",
"next_step": "DELIVER | REGENERATE | MANUAL_REVIEW"
}
——————————————————————————————————————————
6 — RÈGLES DE DÉCISION POUR "next_step"
Si aucune violation n’est détectée dans les sections 1 à 4 BIS :
"controle_status": "VALIDE"
"next_step": "DELIVER"
Si une ou plusieurs violations sont détectées, mais qu’elles sont précises et qu’une nouvelle génération avec une
instruction corrective ciblée a de bonnes chances de les corriger — élément hors champ visible, orientation incorrecte,
ancrage mural déplacé, meuble manquant, répartition spatiale trop concentrée :
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
UN MEUBLE ATTENDU DOIT ÊTRE PRÉSENT, SUR LE BON MUR.
UNE ORIENTATION PRÉVUE DOIT ÊTRE RESPECTÉE.
UNE ZONE INTERDITE RESTE LIBRE SUR L’IMAGE COMME SUR LE PAPIER.
UN MOBILIER ENTASSÉ DANS UN COIN NE REMPLACE PAS UNE RÉPARTITION EN PLUSIEURS ZONES.`;

module.exports = { PROMPT_D_CONTROLE };

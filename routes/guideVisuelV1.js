// Guide Visuel Assisté — Biens vides — V1 — PROTOTYPE
// Approche alternative à la Lecture Fonctionnelle textuelle, testée
// uniquement pour roomType === "salon_salle_a_manger". Complètement séparée :
// n'est utilisée que si une image de guide est explicitement fournie à
// l'appel. Le reste du pipeline (Noyau, module, Contrôle Photo V2, Lecture
// Fonctionnelle par défaut) n'est jamais affecté.

const INSTRUCTION_GUIDE_VISUEL = `Image 1 est la photo source à aménager.
Image 2 est uniquement un guide spatial.
Ne jamais reproduire dans le rendu les couleurs, textes ou marquages de l'image 2.
Installer canapé, table basse et meuble TV dans la zone SALON indiquée.
Installer table et chaises dans la zone SALLE À MANGER indiquée.
Aucun mobilier principal ne doit être placé en dehors de ces deux zones.
Préserver les circulations, la cuisine, l'entrée et les passages.`;

// Désactivé le 20/09/2026 — décision V1 : test non concluant (table hors
// zone, cuisine inventée, TV mal orientée). Code conservé, réactivable en
// repassant ce drapeau à true.
const GUIDE_VISUEL_SALON_SAM_ACTIF = false;

module.exports = { INSTRUCTION_GUIDE_VISUEL, GUIDE_VISUEL_SALON_SAM_ACTIF };

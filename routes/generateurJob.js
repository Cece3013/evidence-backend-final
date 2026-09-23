// backend/routes/generateurJob.js
// Le générateur : toutes les 2 minutes, il prend les photos "À générer"
// dans Notion (Photos Particuliers), génère l'image "Après" avec le pipeline V1
// et la dépose en attente de votre validation.
//
// La file d'attente est dans Notion : si Railway redémarre pendant une
// génération, la photo repasse "À générer" et sera reprise. Rien ne se perd.
//
// INTERRUPTEUR : le générateur ne fait RIEN tant que la variable Railway
// GENERATEUR_ACTIF n'est pas égale à "true". Pour l'arrêter à tout moment,
// mettre GENERATEUR_ACTIF à "false" (aucune modification de code).
const { queryAll, queryPage, getPage, patchPage } = require('./notionHelpers');
const { genererPhotoCommande } = require('./generationV1');

const MAX_PAR_PASSAGE = 3;       // photos générées au maximum à chaque passage
const MAX_ESSAIS = 2;            // après 2 échecs, la photo passe en "Erreur"
const DELAI_BLOCAGE_MINUTES = 20; // une photo "En cours" depuis plus longtemps est reprise

let passageEnCours = false;

function statut(nom) {
  return { 'Statut génération': { select: { name: nom } } };
}

async function runGenerateurCheck() {
  if (process.env.GENERATEUR_ACTIF !== 'true') return;
  if (passageEnCours) {
    console.log('[Generateur] Passage précédent encore en cours, on attend.');
    return;
  }
  passageEnCours = true;

  const DB = process.env.NOTION_PHOTOS_DATABASE_ID;

  try {
    // 1. Reprendre les photos bloquées "En cours" (redémarrage pendant une génération)
    const limite = new Date(Date.now() - DELAI_BLOCAGE_MINUTES * 60 * 1000).toISOString();
    const bloquees = await queryAll(DB, {
      filter: {
        and: [
          { property: 'Statut génération', select: { equals: 'En cours' } },
          { timestamp: 'last_edited_time', last_edited_time: { before: limite } },
        ],
      },
    });
    for (const photo of bloquees) {
      await patchPage(photo.id, statut('À générer'));
      console.log(`[Generateur] Photo ${photo.id} bloquée → remise "À générer"`);
    }

    // 2. Les photos à générer, les plus anciennes d'abord, en nombre limité
    const aGenerer = await queryPage(DB, {
      filter: {
        and: [
          { property: 'Statut génération', select: { equals: 'À générer' } },
          { property: 'Type', select: { equals: 'Avant' } },
        ],
      },
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
      page_size: MAX_PAR_PASSAGE,
    });

    if (aGenerer.length === 0) return;
    console.log(`[Generateur] ${aGenerer.length} photo(s) à générer`);

    for (const photo of aGenerer) {
      await patchPage(photo.id, statut('En cours'));

      try {
        const clientId = photo.properties['Nom du Client']?.relation?.[0]?.id;
        if (!clientId) throw new Error('Photo sans fiche client liée.');
        const client = await getPage(clientId);

        // Sécurité : jamais de génération sans paiement confirmé
        if (client.properties['Paiement réussi']?.checkbox !== true) {
          await patchPage(photo.id, statut('En attente paiement'));
          console.log(`[Generateur] Photo ${photo.id} : paiement non confirmé, génération annulée`);
          continue;
        }

        const resultat = await genererPhotoCommande(photo, client);

        if (resultat.statut === 'A_VERIFIER') {
          await patchPage(photo.id, statut('À vérifier'));
          console.log(`[Generateur] Photo ${photo.id} → À vérifier (${resultat.raison})`);
        } else {
          await patchPage(photo.id, statut('Généré'));
          console.log(`[Generateur] Photo ${photo.id} → Généré`);
        }
      } catch (err) {
        const essais = (photo.properties['Essais génération']?.number || 0) + 1;
        const nouveauStatut = essais >= MAX_ESSAIS ? 'Erreur' : 'À générer';
        await patchPage(photo.id, {
          ...statut(nouveauStatut),
          'Essais génération': { number: essais },
        });
        console.error(
          `[Generateur] Échec photo ${photo.id} (essai ${essais}/${MAX_ESSAIS}) → ${nouveauStatut} :`,
          err.response?.data?.error?.message || err.response?.data || err.message
        );
      }
    }
  } catch (err) {
    console.error('[Generateur] Erreur:', err.response?.data || err.message);
  } finally {
    passageEnCours = false;
  }
}

module.exports = { runGenerateurCheck };

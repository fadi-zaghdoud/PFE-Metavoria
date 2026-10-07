// =============================================================================
//  Données de démonstration — chargement du corpus synthétique (J1) dans la base.
//  Lit le JSONL produit par ml/smart_ticketing_ml/data/generate_corpus.py et
//  crée les tickets marqués `synthetique = true`.
//
//  Le corpus n'est chargé QUE par ce script, lancé à la main (profil compose
//  `demo`) : une installation réelle n'a aucun ticket synthétique en base.
//
//  POURQUOI CE FICHIER VIT DANS `src/` ET NON DANS `prisma/` : même raison que le
//  seed. `tsconfig.json` ne compile que `src/**/*.ts` ; sous `prisma/`, le script
//  exigeait `tsx`, absent de l'image de production, et ne pouvait donc pas tourner
//  dans Docker. Ici, il est compilé en `dist/chargerCorpusDemo.js`.
//
//  Règles :
//   - Idempotent : purge d'abord les tickets synthétiques existants (cascade).
//   - Identifiants FIXES : le ticket de la ligne i reçoit l'identifiant
//     PREMIER_ID + i. Un rechargement redonne donc les mêmes numéros, et une base
//     reconstruite retrouve ceux de la démonstration documentée (voir PREMIER_ID).
//   - Un demandeur par `service_demandeur` distinct → « répartition par service ».
//   - Petit pool de techniciens → « charge par technicien ». Comptes SANS mot de
//     passe : aucun identifiant par défaut n'est livré avec le produit.
//   - Dates étalées sur ~90 j avant le chargement (dateCloture pour les résolus) →
//     KPI temps de résolution / graphes par période non vides pour la démo.
//   - `resolution_a_lier` : la résolution devient un Commentaire du technicien
//     UNIQUEMENT pour les résolus ; pour les ouverts elle reste dans le JSONL
//     (ticket « ouvert » en démo, fermable à la demande).
//
//  Les embeddings ne sont PAS écrits ici : ils viennent du backfill du service IA
//  (`python -m smart_ticketing_ml.service.backfill`), à lancer ensuite.
//
//  Exécution :
//   - Docker : `docker compose run --rm demo-donnees`
//   - local  : `npm run db:load-corpus [chemin/vers/corpus.jsonl]`
// =============================================================================
import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from './config/prisma';

interface CorpusTicket {
  titre: string;
  description: string;
  categorie: string;
  priorite: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
  statut: 'NOUVEAU' | 'EN_COURS' | 'EN_ATTENTE' | 'RESOLU' | 'CLOTURE';
  resolution: string;
  service_demandeur: string;
  synthetique: boolean;
  resolution_a_lier: boolean;
}

// Corpus versionné au dépôt ; ses empreintes sont celles de
// ml/real/lot_v2/train_v2_manifest.json.
const CORPUS_DEMO = 'corpus_train_20260714T161302Z.jsonl';

// Premier identifiant attribué. Dans la base où la démonstration a été préparée, le
// corpus a été chargé après 8 tickets d'essai : il y occupe les identifiants 9 à 860.
// Commencer à 9 fait correspondre une base reconstruite à cette démonstration — les
// tickets cités au journal (#108, #282…) et les sources de leurs suggestions gardent
// leur numéro.
const PREMIER_ID = 9;

const RESOLVED = new Set(['RESOLU', 'CLOTURE']);
const NB_TECHNICIENS = 3;
const JOUR = 24 * 60 * 60 * 1000;

// RNG déterministe (mulberry32) → chargement reproductible.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resoudreFichier(): string {
  return process.argv[2] ?? join(process.cwd(), '..', 'ml', 'artifacts', 'corpus', CORPUS_DEMO);
}

async function main() {
  const chemin = resoudreFichier();
  const lignes = readFileSync(chemin, 'utf-8').split('\n').filter((l) => l.trim());
  const tickets: CorpusTicket[] = lignes.map((l) => JSON.parse(l));
  console.log(`📄 ${tickets.length} tickets lus depuis ${chemin}`);

  const rand = rng(42);
  const maintenant = Date.now();

  // Catégories : nom → id (jamais codées en dur). Toutes doivent exister : sans ce
  // contrôle, un ticket dont la catégorie manque serait créé sans catégorie, en silence.
  const categories = await prisma.categorie.findMany();
  const catId = new Map(categories.map((c) => [c.nom, c.id]));
  const manquantes = [...new Set(tickets.map((t) => t.categorie))].filter((n) => !catId.has(n));
  if (manquantes.length > 0) {
    throw new Error(
      `Catégories absentes de la base : ${manquantes.join(', ')}. ` +
        'Lancez d’abord la pile (migrations et seed) avant de charger le corpus.',
    );
  }

  // Les identifiants fixes ne doivent écraser aucun ticket réel : refus explicite,
  // AVANT la purge — un refus après elle laisserait la base sans son corpus.
  const dernierId = PREMIER_ID + tickets.length - 1;
  const occupants = await prisma.ticket.count({
    where: { synthetique: false, id: { gte: PREMIER_ID, lte: dernierId } },
  });
  if (occupants > 0) {
    throw new Error(
      `${occupants} ticket(s) non synthétique(s) occupent déjà les identifiants ` +
        `${PREMIER_ID} à ${dernierId}. Le corpus de démonstration se charge sur une base ` +
        'sans tickets réels dans cette plage.',
    );
  }

  // Purge idempotente (les commentaires/événements cascadent).
  const supprimes = await prisma.ticket.deleteMany({ where: { synthetique: true } });
  if (supprimes.count > 0) console.log(`🧹 ${supprimes.count} tickets synthétiques précédents supprimés.`);

  // Techniciens synthétiques (pool).
  const techniciens = [];
  for (let i = 1; i <= NB_TECHNICIENS; i++) {
    const t = await prisma.utilisateur.upsert({
      where: { email: `synth.tech${i}@metavoria.local` },
      update: {},
      create: {
        email: `synth.tech${i}@metavoria.local`,
        prenom: 'Technicien',
        nom: `Support ${i}`,
        role: 'TECHNICIEN',
        service: 'Support IT',
        actif: true,
      },
    });
    techniciens.push(t);
  }

  // Demandeurs : un par service_demandeur distinct.
  const services = [...new Set(tickets.map((t) => t.service_demandeur))];
  const demandeurParService = new Map<string, number>();
  for (const svc of services) {
    const [service, poste] = svc.split('/').map((s) => s.trim());
    const slug = service.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const u = await prisma.utilisateur.upsert({
      where: { email: `synth.${slug}@metavoria.local` },
      update: {},
      create: {
        email: `synth.${slug}@metavoria.local`,
        prenom: 'Demandeur',
        nom: service,
        role: 'EMPLOYE',
        service,
        poste: poste ?? null,
        actif: true,
      },
    });
    demandeurParService.set(svc, u.id);
  }

  // Insertion des tickets. L'ordre des tirages `rand()` est celui du chargement
  // d'origine : chaque ticket retrouve le même technicien, la même durée de
  // résolution et la même note de satisfaction.
  let crees = 0;
  let commentaires = 0;
  for (const [index, t] of tickets.entries()) {
    const categorieId = catId.get(t.categorie);
    const demandeurId = demandeurParService.get(t.service_demandeur)!;
    const resolu = RESOLVED.has(t.statut);
    const technicien = t.statut === 'NOUVEAU' ? null : techniciens[Math.floor(rand() * techniciens.length)];

    const dateCreation = new Date(maintenant - Math.floor(rand() * 90 * JOUR));
    let dateCloture: Date | null = null;
    let satisfactionNote: number | null = null;
    let satisfactionDate: Date | null = null;
    if (resolu) {
      dateCloture = new Date(Math.min(maintenant, dateCreation.getTime() + Math.floor((1 + rand() * 96) * 3600 * 1000)));
      if (t.statut === 'CLOTURE' && rand() < 0.7) {
        const notes = [5, 4, 3, 2, 1];
        const poids = [0.4, 0.3, 0.15, 0.1, 0.05];
        let r = rand();
        satisfactionNote = notes[poids.findIndex((p) => (r -= p) < 0)] ?? 4;
        satisfactionDate = dateCloture;
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        id: PREMIER_ID + index,
        titre: t.titre,
        description: t.description,
        statut: t.statut,
        priorite: t.priorite,
        synthetique: true,
        categorieId: categorieId ?? null,
        demandeurId,
        technicienId: technicien?.id ?? null,
        dateCreation,
        dateCloture,
        satisfactionNote,
        satisfactionDate,
      },
    });
    crees++;

    // Résolution liée uniquement pour les résolus (technicien garanti non nul ici).
    if (t.resolution_a_lier && technicien) {
      await prisma.commentaire.create({
        data: {
          contenu: t.resolution,
          ticketId: ticket.id,
          auteurId: technicien.id,
          dateCreation: dateCloture ?? dateCreation,
        },
      });
      commentaires++;
    }
  }

  // Séquence recalée : des identifiants posés à la main ne la font pas avancer. Sans
  // ce recalage, le premier ticket créé ensuite dans l'application recevrait un
  // identifiant déjà pris. GREATEST : ne jamais faire reculer la séquence, pour ne pas
  // réattribuer le numéro d'un ticket supprimé.
  await prisma.$queryRawUnsafe(`
    SELECT setval(s::regclass, GREATEST(
      COALESCE((SELECT max(id) FROM tickets), 1),
      COALESCE(pg_sequence_last_value(s::regclass), 1)
    ))
    FROM (SELECT pg_get_serial_sequence('tickets', 'id') AS s) AS seq
  `);

  console.log(`✅ ${crees} tickets synthétiques créés, #${PREMIER_ID} à #${dernierId} (${commentaires} résolutions liées).`);
  console.log(`   ${techniciens.length} techniciens, ${services.length} demandeurs (par service).`);
  console.log('   Étape suivante : les embeddings, via le backfill du service IA.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Échec du chargement :', err);
    await prisma.$disconnect();
    process.exit(1);
  });

// =============================================================================
//  Chargement du corpus synthétique (J1 — module IA) dans la base.
//  Lit le JSONL produit par ml/smart_ticketing_ml/data/generate_corpus.py et
//  crée les tickets marqués `synthetique = true` (exclus des KPI réels §6.4).
//
//  Règles :
//   - Idempotent : purge d'abord les tickets synthétiques existants (cascade).
//   - Un demandeur par `service_demandeur` distinct → « répartition par service ».
//   - Petit pool de techniciens → « charge par technicien ».
//   - Dates étalées sur ~90 j (dateCloture pour les résolus) → KPI temps de
//     résolution / graphes par période non vides pour la démo.
//   - `resolution_a_lier` : la résolution devient un Commentaire du technicien
//     UNIQUEMENT pour les résolus ; pour les ouverts elle reste dans le JSONL
//     (ticket « ouvert » en démo, fermable à la demande).
//
//  Exécution : `npm run db:load-corpus [chemin/vers/corpus.jsonl]`
// =============================================================================
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../src/config/prisma';

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
  const arg = process.argv[2];
  if (arg) return arg;
  const dir = join(process.cwd(), '..', 'ml', 'artifacts', 'corpus');
  const fichiers = readdirSync(dir)
    .filter((f) => f.startsWith('corpus_train_') && f.endsWith('.jsonl'))
    .sort();
  if (fichiers.length === 0) throw new Error(`Aucun corpus_train_*.jsonl dans ${dir}`);
  return join(dir, fichiers[fichiers.length - 1]);
}

async function main() {
  const chemin = resoudreFichier();
  const lignes = readFileSync(chemin, 'utf-8').split('\n').filter((l) => l.trim());
  const tickets: CorpusTicket[] = lignes.map((l) => JSON.parse(l));
  console.log(`📄 ${tickets.length} tickets lus depuis ${chemin}`);

  const rand = rng(42);
  const maintenant = Date.now();

  // Catégories : nom → id (jamais codées en dur).
  const categories = await prisma.categorie.findMany();
  const catId = new Map(categories.map((c) => [c.nom, c.id]));

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

  // Insertion des tickets.
  let crees = 0;
  let commentaires = 0;
  for (const t of tickets) {
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

  console.log(`✅ ${crees} tickets synthétiques créés (${commentaires} résolutions liées).`);
  console.log(`   ${techniciens.length} techniciens, ${services.length} demandeurs (par service).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Échec du chargement :', err);
    await prisma.$disconnect();
    process.exit(1);
  });

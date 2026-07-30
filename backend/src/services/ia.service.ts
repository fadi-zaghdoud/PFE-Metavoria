import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import { categorieRepository } from '../repositories/categorie.repository';

// ─────────────────────────────────────────────────────────────────────────────
// Pont Node → microservice IA (Python/FastAPI). Contrats alignés sur `service/app.py`.
// PRINCIPE : l'IA SUGGÈRE et est NON bloquante. `enrichirTicket` n'échoue jamais —
// toute erreur (service down, timeout, écriture) est absorbée et journalisée, comme
// `notification.service.ts`. La création du ticket a déjà été committée en amont.
// ─────────────────────────────────────────────────────────────────────────────

interface ReponseClassify {
  categorie: string; // nom de catégorie (= classe du modèle figé, accentuée)
  confiance: number; // proba top-1 (0..1), NON seuillée
  probabilites: Record<string, number>;
  modele_embedding: string;
  embedding: number[]; // 1024d L2-normalisé — à persister côté Node
}

interface ReponsePriority {
  niveau: string; // FAIBLE | MOYENNE | HAUTE | CRITIQUE
  score: number;
  plafonne: boolean;
  explication: string;
  contributions: Array<Record<string, unknown>>;
  plafonnements: string[];
}

// Appel HTTP borné par timeout (AbortController) : au-delà de `timeoutMs`, on abandonne
// → traité comme un échec → dégradation. Timeout court pour classify/priority (chemin
// synchrone de création) ; long pour /suggest (génération RAG, appelée en asynchrone).
async function appelerIA<T>(chemin: string, corps: unknown, timeoutMs = env.IA_TIMEOUT_MS): Promise<T> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  try {
    const reponse = await fetch(`${env.SERVICE_IA_URL}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: controleur.signal,
    });
    if (!reponse.ok) {
      throw new Error(`IA ${chemin} → HTTP ${reponse.status}`);
    }
    return (await reponse.json()) as T;
  } finally {
    clearTimeout(minuteur);
  }
}

const classifier = (titre: string, description: string) =>
  appelerIA<ReponseClassify>('/classify', { titre, description });

const prioriser = (titre: string, description: string, categorie: string) =>
  appelerIA<ReponsePriority>('/priority', { titre, description, categorie });

// Réponse du RAG (Greffe 2). Contrat aligné sur `service/app.py` (/suggest).
interface ReponseSuggest {
  abstenu: boolean; // True → aucune suggestion ancrée : on n'invente pas
  texte: string; // suggestion citée (vide si abstention)
  sources: { id: number; titre: string }[]; // #id réellement cités
  similaires: { id: number; titre: string; categorie: string | null }[]; // candidats RRF
  confiance: number | null;
  message: string;
  latence_ms: number | null;
}

// Timeout LONG (génération 15-30 s) — cet appel est fait en asynchrone, hors réponse HTTP.
const suggerer = (titre: string, description: string) =>
  appelerIA<ReponseSuggest>('/suggest', { titre, description }, env.IA_SUGGESTION_TIMEOUT_MS);

// Résumé du fil (J8). Contrat aligné sur /summarize ; même timeout long (génération 21-55 s).
interface MessageFil {
  auteur: string;
  contenu: string;
}

interface ReponseSummarize {
  resume: string;
  latence_ms: number | null;
}

const resumer = (titre: string, description: string, messages: MessageFil[]) =>
  appelerIA<ReponseSummarize>('/summarize', { titre, description, messages }, env.IA_SUGGESTION_TIMEOUT_MS);

// Écrit l'embedding renvoyé par /classify. Prisma ne sait pas écrire le type
// `Unsupported("vector(1024)")` → SQL brut paramétré : le vecteur part en littéral
// pgvector `[...]` casté ::vector. Le service ne touche jamais la DB (Node le fait).
async function ecrireEmbedding(ticketId: number, embedding: number[], modele: string): Promise<void> {
  const litteral = `[${embedding.join(',')}]`;
  await prisma.$executeRaw`
    UPDATE tickets
    SET embedding = ${litteral}::vector, embedding_modele = ${modele}
    WHERE id = ${ticketId}`;
}

const journaliser = (etape: string, ticketId: number, err: unknown) =>
  console.error(`[IA] ${etape} ticket #${ticketId} :`, err instanceof Error ? err.message : err);

// Orchestration synchrone embed → classify → priority, étage par étage. Chaque
// étage dégrade proprement (cf. tableau de dégradation gracieuse du plan).
async function enrichir(ticket: { id: number; titre: string; description: string }): Promise<void> {
  const { id, titre, description } = ticket;

  // ── Étage 1 : classification (le vecteur d'embedding est renvoyé au passage) ──
  let classification: ReponseClassify;
  try {
    classification = await classifier(titre, description);
  } catch (err) {
    // Service down / /classify KO / timeout → aucune suggestion, priorité sautée
    // (décision : soit le couple catégorie+priorité, soit rien). Ticket déjà créé.
    journaliser('classify', id, err);
    return;
  }

  // ── Étage 1b : persistance de l'embedding (indépendante des suggestions) ──
  try {
    await ecrireEmbedding(id, classification.embedding, classification.modele_embedding);
  } catch (err) {
    journaliser('embedding', id, err); // rattrapable par backfill.py — on continue
  }

  // ── Résolution nom → catégorie réelle (catégories dynamiques) ──
  // Label absent en base = modèle périmé (catégorie renommée/supprimée) → abstention :
  // pas de couple exploitable → on n'écrit ni classification ni priorité.
  const categorie = await categorieRepository.findByNom(classification.categorie).catch(() => null);
  if (!categorie) {
    console.warn(
      `[IA] catégorie « ${classification.categorie} » absente en base (modèle périmé ?) — suggestion écartée (ticket #${id})`,
    );
    return;
  }

  // ── Étage 2 : suggestion CLASSIFICATION ──
  try {
    await prisma.suggestionIA.create({
      data: {
        ticketId: id,
        typeSuggestion: 'CLASSIFICATION',
        contenu: categorie.nom,
        scoreConfiance: classification.confiance, // proba top-1
        details: {
          categorieId: categorie.id, // permet au technicien d'accepter (changerCategorie)
          probabilites: classification.probabilites,
          modeleEmbedding: classification.modele_embedding,
        },
      },
    });
  } catch (err) {
    journaliser('persistance CLASSIFICATION', id, err);
  }

  // ── Étage 3 : priorité (dépend de la catégorie — dépendance J7) ──
  let priorite: ReponsePriority;
  try {
    priorite = await prioriser(titre, description, categorie.nom);
  } catch (err) {
    journaliser('priority', id, err); // classification déjà persistée ; pas de priorité
    return;
  }
  try {
    await prisma.suggestionIA.create({
      data: {
        ticketId: id,
        typeSuggestion: 'PRIORISATION',
        contenu: priorite.niveau,
        scoreConfiance: null, // scorecard déterministe : pas de proba (on ne fabrique rien)
        details: priorite as unknown as Prisma.InputJsonValue, // niveau + décomposition glass-box
      },
    });
  } catch (err) {
    journaliser('persistance PRIORISATION', id, err);
  }
}

// Génération RAG en ARRIÈRE-PLAN (fire-and-forget). Appelle /suggest (15-30 s) puis met la
// ligne SOLUTION à PRETE (texte + sources + similaires ; abstention = PRETE aussi, c'est un
// résultat valide) ou ECHEC (service/Ollama down/timeout). Ne rejette JAMAIS (promesse
// détachée) : toute erreur est journalisée et la ligne passe ECHEC.
async function genererSuggestion(
  suggestionId: number,
  ticketId: number,
  titre: string,
  description: string,
): Promise<void> {
  try {
    const res = await suggerer(titre, description);
    await prisma.suggestionIA.update({
      where: { id: suggestionId },
      data: {
        statut: 'PRETE',
        contenu: res.texte,
        scoreConfiance: res.confiance,
        details: {
          abstenu: res.abstenu,
          message: res.message,
          sources: res.sources,
          similaires: res.similaires,
          latenceMs: res.latence_ms,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    journaliser('génération suggestion', ticketId, err);
    await prisma.suggestionIA
      .update({ where: { id: suggestionId }, data: { statut: 'ECHEC' } })
      .catch((e) => journaliser('maj ECHEC suggestion', ticketId, e));
  }
}

// Génération du résumé en ARRIÈRE-PLAN (fire-and-forget) — même patron que genererSuggestion.
// Met la ligne RESUME à PRETE (contenu = résumé) ou ECHEC. Ne rejette JAMAIS.
async function genererResume(
  suggestionId: number,
  ticketId: number,
  titre: string,
  description: string,
  messages: MessageFil[],
): Promise<void> {
  try {
    const res = await resumer(titre, description, messages);
    await prisma.suggestionIA.update({
      where: { id: suggestionId },
      data: {
        statut: 'PRETE',
        contenu: res.resume,
        details: { latenceMs: res.latence_ms } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    journaliser('génération résumé', ticketId, err);
    await prisma.suggestionIA
      .update({ where: { id: suggestionId }, data: { statut: 'ECHEC' } })
      .catch((e) => journaliser('maj ECHEC résumé', ticketId, e));
  }
}

export const iaService = {
  // Point d'entrée non bloquant : ne rejette jamais (filet de sécurité + étages internes).
  async enrichirTicket(ticket: { id: number; titre: string; description: string }): Promise<void> {
    if (!env.IA_ACTIVE) return;
    try {
      await enrichir(ticket);
    } catch (err) {
      journaliser('enrichissement (interrompu)', ticket.id, err);
    }
  },

  // Démarre une suggestion RAG : réinitialise LA ligne SOLUTION du ticket en EN_COURS, puis
  // lance la génération en ASYNCHRONE (non attendue) → l'appelant répond 202 immédiatement.
  // Rapide ici (deux écritures DB) ; les 15-30 s de génération vivent dans le fire-and-forget.
  async demarrerSuggestion(ticketId: number, titre: string, description: string): Promise<void> {
    // Une seule ligne SOLUTION par ticket : on repart propre à chaque demande.
    await prisma.suggestionIA.deleteMany({ where: { ticketId, typeSuggestion: 'SOLUTION' } });
    const ligne = await prisma.suggestionIA.create({
      data: { ticketId, typeSuggestion: 'SOLUTION', contenu: '', statut: 'EN_COURS' },
    });
    void genererSuggestion(ligne.id, ticketId, titre, description);
  },

  // Démarre un résumé du fil : réinitialise LA ligne RESUME en EN_COURS, puis lance la
  // génération en ASYNCHRONE (non attendue) → l'appelant répond 202 immédiatement.
  async demarrerResume(
    ticketId: number,
    titre: string,
    description: string,
    messages: MessageFil[],
  ): Promise<void> {
    // Une seule ligne RESUME par ticket : on repart propre (le fil a pu grandir).
    await prisma.suggestionIA.deleteMany({ where: { ticketId, typeSuggestion: 'RESUME' } });
    const ligne = await prisma.suggestionIA.create({
      data: { ticketId, typeSuggestion: 'RESUME', contenu: '', statut: 'EN_COURS' },
    });
    void genererResume(ligne.id, ticketId, titre, description, messages);
  },
};

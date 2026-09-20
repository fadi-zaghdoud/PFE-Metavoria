import { env } from '../config/env';
// Barrière de contexte pour les traitements DIFFÉRÉS ci-dessous. Le contexte de requête
// SURVIT aux traitements lancés sans être attendus (mesuré) : sans barrière, une écriture
// au journal d'audit depuis ces chemins hériterait de l'IP et du nom de l'utilisateur dont
// la requête les a déclenchés, et lui attribuerait une action du système. Ces fonctions
// n'écrivent au journal aujourd'hui, mais la ré-classification après OCR passe par là :
// la barrière rend l'invariant structurel plutôt que de dépendre d'une vigilance future.
import { executerSansContexte } from '../utils/contexteRequete';
import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import { categorieRepository } from '../repositories/categorie.repository';
import { ticketRepository } from '../repositories/ticket.repository';

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

// Proxy vers le service IA qui RELAIE le statut + le corps (contrairement à `appelerIA` qui
// dégrade en absorbant l'erreur) : les endpoints admin du flywheel doivent transmettre les
// 202/409/404 du service tels quels. Un service injoignable lève → 503 côté contrôleur.
async function proxyIA(
  methode: string,
  chemin: string,
  corps?: unknown,
  timeoutMs = env.IA_TIMEOUT_MS,
): Promise<{ status: number; body: unknown }> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  try {
    const reponse = await fetch(`${env.SERVICE_IA_URL}${chemin}`, {
      method: methode,
      headers: corps !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
      signal: controleur.signal,
    });
    const body = await reponse.json().catch(() => ({}));
    return { status: reponse.status, body };
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
  // `synthetique` (K3) : provenance stockée telle quelle et relayée à l'UI (badge « réel »).
  sources: { id: number; titre: string; synthetique: boolean }[]; // #id réellement cités
  similaires: { id: number; titre: string; categorie: string | null; synthetique: boolean }[]; // candidats RRF
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

// Extraction OCR d'une pièce jointe (J8bis Lot B). Contrat aligné sur /extract. Timeout LONG
// (OCR d'un scan) — appel fait en ASYNCHRONE, hors réponse d'upload.
interface ReponseExtract {
  texte: string;
  fiable: boolean; // False → OCR trop bruité (seuil anti-bruit) : Node ne stocke rien
  confiance: number; // 0-100 (moyenne OCR) ; 100 pour une couche texte PDF
  methode: string; // texte_pdf | ocr_image | ocr_pdf_scanne
  n_mots: number;
  n_pages: number | null;
  langue: string;
  message: string;
  latence_ms: number | null;
}

const extraire = (nomFichier: string, contenuBase64: string, typeMime: string) =>
  appelerIA<ReponseExtract>(
    '/extract',
    { nom_fichier: nomFichier, contenu_base64: contenuBase64, type_mime: typeMime },
    env.IA_EXTRACT_TIMEOUT_MS,
  );

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

// Classe + priorise un ticket, étage par étage, chaque étage dégradant proprement. Deux
// appels : à la CRÉATION (`origine='creation'`, texte = description seule) et APRÈS OCR
// (`origine='apres_ocr'`, texte = description + texte_extrait des pièces). `classify` encode
// `titre\ndescription` → passer `description\ntexteOCR` produit l'embedding enrichi
// `titre\ndescription\ntexte_extrait` SANS toucher au service ni à `tickets.description`.
// Ce que la classification a retenu, remonte a l'appelant. Sert a l'AFFECTATION
// AUTOMATIQUE (§6.2), qui doit connaitre la categorie suggeree et sa confiance : a la
// creation, `Ticket.categorieId` reste NULL (l'IA suggere, elle n'ecrit jamais la
// categorie — c'est la boucle humaine). La valeur est deja en main ici, la renvoyer
// evite une relecture de la suggestion en base.
export interface ResultatClassification {
  categorieId: number;
  // Probabilite top-1. `null` n'arrive pas pour la classification, mais le type reste
  // aligne sur `SuggestionIA.scoreConfiance`, nullable (la scorecard de priorite n'en a pas).
  confiance: number | null;
}

async function classerEtPrioriser(
  ticket: { id: number; titre: string; description: string },
  opts: { texteSupplementaire?: string; origine: 'creation' | 'apres_ocr'; pieceJointeIds?: number[] },
): Promise<ResultatClassification | null> {
  const { id, titre, description } = ticket;
  const { texteSupplementaire = '', origine, pieceJointeIds } = opts;
  const descriptionEmbed = texteSupplementaire ? `${description}\n${texteSupplementaire}` : description;
  const detailsOrigine = origine === 'apres_ocr' ? { origine, pieceJointeIds } : { origine };

  // ── Étage 1 : classification (le vecteur d'embedding est renvoyé au passage) ──
  let classification: ReponseClassify;
  try {
    classification = await classifier(titre, descriptionEmbed);
  } catch (err) {
    // Service down / /classify KO / timeout → aucune suggestion, priorité sautée
    // (décision : soit le couple catégorie+priorité, soit rien). Ticket déjà créé.
    journaliser(`classify (${origine})`, id, err);
    return null;
  }

  // ── Étage 1b : embedding — création = base ; après-OCR = ÉCRASE avec l'enrichi ──
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
    return null;
  }

  // A partir d'ici la categorie est resolue : le resultat est acquis, meme si l'etage
  // de priorite echoue ensuite. L'affectation automatique n'a besoin que de ce couple.
  const resultat: ResultatClassification = {
    categorieId: categorie.id,
    confiance: classification.confiance,
  };

  // Après-OCR : on REMPLACE la paire après-OCR précédente (toujours 1 « avant » création +
  // 1 « après » cohérente, même après plusieurs uploads).
  if (origine === 'apres_ocr') {
    await prisma.suggestionIA
      .deleteMany({
        where: {
          ticketId: id,
          typeSuggestion: { in: ['CLASSIFICATION', 'PRIORISATION'] },
          details: { path: ['origine'], equals: 'apres_ocr' },
        },
      })
      .catch((err) => journaliser('purge après-OCR', id, err));
  }

  // ── Étage 2 : suggestion CLASSIFICATION ──
  try {
    await prisma.suggestionIA.create({
      data: {
        ticketId: id,
        typeSuggestion: 'CLASSIFICATION',
        origine, // colonne dédiée (flywheel) : creation | apres_ocr
        contenu: categorie.nom,
        scoreConfiance: classification.confiance, // proba top-1
        details: {
          ...detailsOrigine,
          categorieId: categorie.id, // permet au technicien d'accepter (changerCategorie)
          probabilites: classification.probabilites,
          modeleEmbedding: classification.modele_embedding,
        },
      },
    });
  } catch (err) {
    journaliser('persistance CLASSIFICATION', id, err);
  }

  // ── Étage 3 : priorité (dépend de la catégorie — dépendance J7 ; texte inclut l'OCR) ──
  let priorite: ReponsePriority;
  try {
    priorite = await prioriser(titre, descriptionEmbed, categorie.nom);
  } catch (err) {
    journaliser(`priority (${origine})`, id, err); // classification déjà persistée
    return resultat;
  }
  try {
    await prisma.suggestionIA.create({
      data: {
        ticketId: id,
        typeSuggestion: 'PRIORISATION',
        origine, // colonne dédiée (flywheel) : creation | apres_ocr
        contenu: priorite.niveau,
        scoreConfiance: null, // scorecard déterministe : pas de proba (on ne fabrique rien)
        details: { ...detailsOrigine, ...priorite } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    journaliser('persistance PRIORISATION', id, err);
  }

  return resultat;
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

// Extraction OCR + re-classification « après OCR » en ARRIÈRE-PLAN (fire-and-forget). Écrit
// texte_extrait UNIQUEMENT si l'OCR est fiable (jamais dans description), puis re-classe/priorise
// le ticket sur la concat des textes extraits fiables. Ne rejette JAMAIS : l'upload reste valide.
async function genererExtraction(
  pieceJointeId: number,
  ticket: { id: number; titre: string; description: string },
  buffer: Buffer,
  typeMime: string,
  nomFichier: string,
): Promise<void> {
  try {
    const res = await extraire(nomFichier, buffer.toString('base64'), typeMime);
    if (!res.fiable) {
      // Seuil anti-bruit non franchi → on ne stocke rien et on ne reclasse pas.
      console.warn(
        `[IA] OCR non fiable pièce #${pieceJointeId} (ticket #${ticket.id}) : ${res.message}`,
      );
      return;
    }
    await ticketRepository.majTexteExtrait(pieceJointeId, res.texte);

    // Re-classification « après OCR » sur la concat des textes fiables déjà extraits du ticket.
    const pieces = await ticketRepository.textesExtraitsDuTicket(ticket.id);
    await classerEtPrioriser(ticket, {
      texteSupplementaire: pieces.map((p) => p.texteExtrait).join('\n'),
      origine: 'apres_ocr',
      pieceJointeIds: pieces.map((p) => p.id),
    });
  } catch (err) {
    // Service/Tesseract down, timeout, 422/503… → aucune conséquence sur le ticket.
    journaliser('extraction OCR', ticket.id, err);
  }
}

export const iaService = {
  // Point d'entrée non bloquant : ne rejette jamais (filet de sécurité + étages internes).
  // Renvoie la classification retenue, ou `null` si l'IA n'a rien produit d'exploitable
  // (module coupe, service indisponible, modele perime). Ne rejette jamais.
  async enrichirTicket(ticket: {
    id: number;
    titre: string;
    description: string;
  }): Promise<ResultatClassification | null> {
    if (!env.IA_ACTIVE) return null;
    try {
      return await classerEtPrioriser(ticket, { origine: 'creation' });
    } catch (err) {
      journaliser('enrichissement (interrompu)', ticket.id, err);
      return null;
    }
  },

  // Déclenche l'extraction OCR d'une pièce jointe (J8bis Lot B) en ASYNCHRONE, à l'upload :
  // la réponse d'upload part tout de suite, l'OCR (0,5-2 s) + la re-classification « après OCR »
  // vivent dans le fire-and-forget. Non bloquant, ne rejette jamais.
  async demarrerExtraction(
    pieceJointeId: number,
    ticket: { id: number; titre: string; description: string },
    buffer: Buffer,
    typeMime: string,
    nomFichier: string,
  ): Promise<void> {
    if (!env.IA_ACTIVE) return;
    executerSansContexte(() => void genererExtraction(pieceJointeId, ticket, buffer, typeMime, nomFichier));
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
    executerSansContexte(() => void genererSuggestion(ligne.id, ticketId, titre, description));
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
    executerSansContexte(() => void genererResume(ligne.id, ticketId, titre, description, messages));
  },

  // Flywheel (Greffe 3) — capture « suggéré vs choisi » : à la résolution / clôture / correction,
  // on marque chaque suggestion CLASSIFICATION du ticket comme VALIDÉE (contenu == catégorie
  // finale choisie par l'humain) ou CORRIGÉE. Idempotent (recalcule sur la catégorie courante)
  // et best-effort : ne casse JAMAIS la mutation métier (la capture ne doit pas bloquer le
  // workflow). Le label d'entraînement, lui, reste le ticket résolu (cf. labelsValides).
  async reconcilierSuggestions(ticketId: number, categorieFinaleNom: string | null): Promise<void> {
    if (!categorieFinaleNom) return;
    try {
      const suggestions = await prisma.suggestionIA.findMany({
        where: { ticketId, typeSuggestion: 'CLASSIFICATION' },
        select: { id: true, contenu: true },
      });
      await Promise.all(
        suggestions.map((s) =>
          prisma.suggestionIA.update({
            where: { id: s.id },
            data: { valideeParTechnicien: s.contenu === categorieFinaleNom },
          }),
        ),
      );
    } catch (err) {
      journaliser('réconciliation flywheel', ticketId, err);
    }
  },

  // ── Flywheel (Greffe 3, B.3) — proxys ADMIN vers le service Python (relaient le statut) ──
  // Node reste seul à toucher la DB (captures via labelsValides) ; le service Python reste sans état.
  proxyReentrainer: (captures: unknown[]) =>
    proxyIA('POST', '/reentrainer', { captures }, env.IA_REENTRAINEMENT_TIMEOUT_MS),
  proxyEtatReentrainement: () => proxyIA('GET', '/reentrainer/etat'),
  proxyDeployer: (stamp: string) =>
    proxyIA('POST', '/deployer', { stamp }, env.IA_REENTRAINEMENT_TIMEOUT_MS),
  proxySante: () => proxyIA('GET', '/sante'),

  // Classes connues du modèle IA ACTIF — socle du STATUT des catégories (Phase A : « active »
  // = catégorie ∈ ces classes). BEST-EFFORT et NON bloquant : IA désactivée/injoignable/erreur
  // → { modeleDisponible: false } (jamais d'exception), pour que la page catégories reste
  // utilisable IA down (le statut « active » passe simplement « indéterminé » côté service métier).
  async classesModeleActif(): Promise<{
    modeleDisponible: boolean;
    classes: string[] | null;
    dateEntrainement: string | null;
    macroF1Reel: number | null;
  }> {
    const indisponible = {
      modeleDisponible: false,
      classes: null,
      dateEntrainement: null,
      macroF1Reel: null,
    };
    if (!env.IA_ACTIVE) return indisponible;
    try {
      const { status, body } = await proxyIA('GET', '/modele');
      if (status !== 200) return indisponible;
      const b = body as {
        present?: boolean;
        classes?: string[] | null;
        date_entrainement?: string | null;
        macro_f1_reel?: number | null;
      };
      if (!b.present) return indisponible;
      return {
        modeleDisponible: true,
        classes: Array.isArray(b.classes) ? b.classes : null,
        dateEntrainement: b.date_entrainement ?? null,
        macroF1Reel: b.macro_f1_reel ?? null,
      };
    } catch {
      return indisponible;
    }
  },
};

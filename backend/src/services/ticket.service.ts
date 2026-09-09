import {
  ticketRepository,
  type CommentaireAvecAuteur,
  type FiltresTickets,
  type MettreAJourTicketData,
  type TicketDetail,
  type TicketListe,
} from '../repositories/ticket.repository';
import { categorieRepository } from '../repositories/categorie.repository';
import { affectationRepository } from '../repositories/affectation.repository';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { notificationService } from './notification.service';
import { iaService } from './ia.service';
import { env } from '../config/env';
import { estConfigure, uploaderBuffer } from '../config/cloudinary';
import { MAX_PIECES_PAR_TICKET } from '../middlewares/upload.middleware';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/AppError';
import { logAudit } from '../utils/logger';
import { dateDuJour } from './absence.disponibilite';
import {
  choisirTechnicien,
  type MotifAffectation,
  type ResultatChoix,
} from './affectation.regle';
import { Prisma } from '../generated/prisma/client';
import type { Priorite, Role, StatutTicket } from '../generated/prisma/enums';

export interface StatistiquesFiltres {
  dateDebut?: Date;
  dateFin?: Date;
  technicienId?: number;
  categorieId?: number;
  service?: string;
}

const TOUS_STATUTS: StatutTicket[] = ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE'];
const TOUTES_PRIORITES: Priorite[] = ['FAIBLE', 'MOYENNE', 'HAUTE', 'CRITIQUE'];

const arrondi = (n: number) => Math.round(n * 10) / 10;

function moyenneHeures(dureesMs: number[]): number | null {
  if (dureesMs.length === 0) return null;
  const moyenne = dureesMs.reduce((a, b) => a + b, 0) / dureesMs.length;
  return arrondi(moyenne / 3_600_000);
}

// Construit le filtre Prisma du tableau de bord : périmètre par rôle (employé =
// ses tickets) + filtres de l'interface (période, technicien, catégorie, service).
function construireScope(acteur: Acteur, filtres: StatistiquesFiltres): Prisma.TicketWhereInput {
  const scope: Prisma.TicketWhereInput = {};
  if (acteur.role === 'EMPLOYE') scope.demandeurId = acteur.id;
  if (filtres.technicienId) scope.technicienId = filtres.technicienId;
  if (filtres.categorieId) scope.categorieId = filtres.categorieId;
  if (filtres.service) scope.demandeur = { service: filtres.service };
  if (filtres.dateDebut || filtres.dateFin) {
    const fin = filtres.dateFin ? new Date(filtres.dateFin) : undefined;
    fin?.setHours(23, 59, 59, 999);
    scope.dateCreation = { gte: filtres.dateDebut, lte: fin };
  }
  return scope;
}

export interface Acteur {
  id: number;
  role: Role;
}

export interface CreerTicketInput {
  titre: string;
  description: string;
  categorieId?: number;
  priorite?: Priorite;
}

// Cycle de vie LINÉAIRE du ticket (workflow métier). Chaque arête est déclenchée
// par une action nommée portée par un acteur précis :
//
//   NOUVEAU ──assignation (admin)──▶ EN_ATTENTE ──prise en charge (tech. assigné)──▶
//   EN_COURS ──résolution (tech. assigné)──▶ RESOLU ──validation (demandeur) | clôture (admin)──▶ CLOTURE
//
// CLOTURE est TERMINAL : aucune réouverture. Limite assumée — un problème
// récurrent donne lieu à un NOUVEAU ticket (pas de retour arrière dans le cycle).
// NB : l'(dé)assignation n'emprunte PAS cette table (elle force EN_ATTENTE ou
// NOUVEAU depuis plusieurs états) ; sa légalité est gérée dans `affecter`.
const TRANSITIONS_STATUT: Record<StatutTicket, StatutTicket[]> = {
  NOUVEAU: ['EN_ATTENTE'],
  EN_ATTENTE: ['EN_COURS'],
  EN_COURS: ['RESOLU'],
  RESOLU: ['CLOTURE'],
  CLOTURE: [],
};

const LABEL_STATUT: Record<StatutTicket, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
};

// Garde-fou de la machine à états : rejette toute transition hors du cycle linéaire.
// Appelé par chaque action de progression (prise en charge, résolution, clôture).
function verifierTransition(actuel: StatutTicket, cible: StatutTicket): void {
  if (!TRANSITIONS_STATUT[actuel].includes(cible)) {
    throw new ValidationError(
      `Transition impossible de « ${LABEL_STATUT[actuel]} » vers « ${LABEL_STATUT[cible]} »`,
    );
  }
}

// Un employé ne voit que ses propres tickets ; technicien et administrateur voient tout.
function peutVoir(acteur: Acteur, ticket: { demandeurId: number }): boolean {
  return acteur.role !== 'EMPLOYE' || ticket.demandeurId === acteur.id;
}

// Peut modifier la priorité : l'administrateur, ou le technicien assigné au ticket.
function estGestionnaire(acteur: Acteur, ticket: { technicienId: number | null }): boolean {
  return (
    acteur.role === 'ADMINISTRATEUR' ||
    (acteur.role === 'TECHNICIEN' && ticket.technicienId === acteur.id)
  );
}

// Prédicats d'autorisation atomiques — chaque action du workflow appelle celui de
// sa ligne dans le tableau des permissions (un acteur par transition).
function estAdmin(acteur: Acteur): boolean {
  return acteur.role === 'ADMINISTRATEUR';
}

function estTechnicienAssigne(acteur: Acteur, ticket: { technicienId: number | null }): boolean {
  return acteur.role === 'TECHNICIEN' && ticket.technicienId === acteur.id;
}

function estDemandeur(acteur: Acteur, ticket: { demandeurId: number }): boolean {
  return ticket.demandeurId === acteur.id;
}

function nomComplet(personne: { prenom: string; nom: string }): string {
  return `${personne.prenom} ${personne.nom}`;
}

function refusModification(role: Role): never {
  throw new ForbiddenError(
    role === 'TECHNICIEN'
      ? "Prenez d'abord le ticket en charge pour le modifier"
      : 'Seul le technicien assigné ou un administrateur peut modifier ce ticket',
  );
}

type UtilisateurEntite = NonNullable<Awaited<ReturnType<typeof utilisateurRepository.findById>>>;

// Valide la cible d'affectation (null = désaffectation) : doit être un membre du support actif.
async function resoudreTechnicien(technicienId: number | null): Promise<UtilisateurEntite | null> {
  if (technicienId === null) return null;
  const technicien = await utilisateurRepository.findById(technicienId);
  if (!technicien || !technicien.actif) throw new ValidationError('Technicien introuvable');
  if (technicien.role !== 'TECHNICIEN' && technicien.role !== 'ADMINISTRATEUR') {
    throw new ValidationError("Le ticket ne peut être affecté qu'à un membre du support");
  }
  return technicien;
}

// Type de l'evenement d'affectation. AFFECTATION_AUTO est DISTINCT d'AFFECTATION : il
// rend la fonctionnalite demontrable et filtrable (« combien de tickets ont ete
// auto-affectes ? »), ce qu'un auteur `null` seul ne permettrait pas — un evenement
// systeme reste un evenement systeme, mais tous ne sont pas des affectations automatiques.
type TypeEvenementAffectation = 'AFFECTATION' | 'DESAFFECTATION' | 'AFFECTATION_AUTO';

// Resultat de l'affectation automatique : la decision de la regle pure, elargie de deux
// cas qui n'appartiennent pas a la regle mais au service.
export type ResultatAffectationAuto =
  | ResultatChoix
  | { affecte: false; raison: 'TICKET_DEJA_ASSIGNE' | 'ECHEC_TECHNIQUE' };

// CŒUR PARTAGE de l'affectation — manuelle comme automatique.
// Extrait tel quel de `affecter()` : evenement, mise a jour, journal d'audit, notification.
// Aucune regle d'autorisation ici ; chaque appelant applique la sienne en amont
// (l'administrateur pour le chemin manuel, le mode AUTO pour le chemin automatique).
//
// `auteurId === null` signifie « Systeme » : a la creation en mode AUTO, l'acteur est le
// DEMANDEUR (un employe) et lui attribuer l'affectation serait faux.
//
// `motif` : uniquement journalise. Il explique pourquoi ce technicien a ete retenu
// (specialite, ou l'un des trois replis) sans jamais influencer l'ecriture.
async function appliquerAffectation(
  ticket: TicketDetail,
  technicien: UtilisateurEntite | null,
  auteurId: number | null,
  motif?: MotifAffectation,
): Promise<TicketDetail> {
  const desaffectation = technicien === null;
  const type: TypeEvenementAffectation = desaffectation
    ? 'DESAFFECTATION'
    : motif
      ? 'AFFECTATION_AUTO'
      : 'AFFECTATION';

  await ticketRepository.creerEvenement({
    ticketId: ticket.id,
    auteurId,
    type,
    ancienneValeur: ticket.technicien ? nomComplet(ticket.technicien) : null,
    nouvelleValeur: technicien ? nomComplet(technicien) : null,
  });

  const misAJour = await ticketRepository.update(ticket.id, {
    technicienId: technicien?.id ?? null,
    statut: desaffectation ? 'NOUVEAU' : 'EN_ATTENTE',
  });
  logAudit('TICKET_AFFECTATION', {
    ticketId: ticket.id,
    technicienId: technicien?.id ?? null,
    parUtilisateur: auteurId,
    automatique: motif !== undefined,
    ...(motif ? { motif } : {}),
  });

  // Notifier le technicien nouvellement affecte (jamais lors d'une desaffectation).
  // Une affectation decidee par le systeme notifie toujours : `auteurId` vaut null,
  // donc la comparaison ne peut pas s'auto-exclure.
  if (technicien && technicien.id !== auteurId) {
    await notificationService.notifier({
      destinataire: { id: technicien.id, email: technicien.email, prenom: technicien.prenom },
      type: 'AFFECTATION',
      sujet: `Ticket #${ticket.id} vous est affecté`,
      message: `Le ticket « ${misAJour.titre} » vous a été affecté.`,
      ticketId: ticket.id,
    });
  }
  return misAJour;
}

export const ticketService = {
  async lister(acteur: Acteur, filtres: FiltresTickets): Promise<TicketListe[]> {
    // Un employé ne voit que ses propres tickets, quels que soient les filtres reçus.
    const filtresEffectifs: FiltresTickets =
      acteur.role === 'EMPLOYE' ? { ...filtres, demandeurId: acteur.id } : filtres;
    return ticketRepository.findMany(filtresEffectifs);
  },

  async detail(acteur: Acteur, id: number): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!peutVoir(acteur, ticket)) throw new ForbiddenError('Accès refusé à ce ticket');
    return ticket;
  },

  async creer(acteur: Acteur, input: CreerTicketInput): Promise<TicketDetail> {
    if (input.categorieId !== undefined) {
      const categorie = await categorieRepository.findById(input.categorieId);
      if (!categorie) throw new ValidationError('Catégorie invalide');
    }

    const ticket = await ticketRepository.create({
      titre: input.titre,
      description: input.description,
      categorieId: input.categorieId ?? null,
      priorite: input.priorite ?? 'MOYENNE',
      demandeurId: acteur.id,
    });

    logAudit('TICKET_CREE', {
      ticketId: ticket.id,
      demandeurId: acteur.id,
      categorieId: ticket.categorieId,
      priorite: ticket.priorite,
    });

    // Enrichissement IA (Greffe 1) — NON bloquant : le ticket est déjà committé.
    // `enrichirTicket` absorbe toute erreur (service down, timeout, écriture) → la
    // création réussit toujours. On relit ensuite pour renvoyer d'éventuelles suggestions.
    await iaService.enrichirTicket(ticket);
    return (await ticketRepository.findById(ticket.id)) ?? ticket;
  },

  // Prise en charge : le technicien ASSIGNÉ démarre le traitement (EN_ATTENTE → EN_COURS).
  // Action distincte de l'assignation (décidée par l'admin) — c'est le technicien qui choisit
  // de commencer. L'événement `PRISE_EN_CHARGE` sert de repère au délai de prise en charge.
  async prendreEnCharge(acteur: Acteur, id: number): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estTechnicienAssigne(acteur, ticket)) {
      throw new ForbiddenError('Seul le technicien assigné peut prendre ce ticket en charge');
    }
    verifierTransition(ticket.statut, 'EN_COURS');

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'PRISE_EN_CHARGE',
      ancienneValeur: ticket.statut,
      nouvelleValeur: 'EN_COURS',
    });

    const misAJour = await ticketRepository.update(id, { statut: 'EN_COURS' });
    logAudit('TICKET_PRISE_EN_CHARGE', { ticketId: id, parUtilisateur: acteur.id });

    // Informer le demandeur que son ticket est pris en charge.
    if (misAJour.demandeur.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: misAJour.demandeur,
        type: 'CHANGEMENT_STATUT',
        sujet: `Ticket #${id} — pris en charge`,
        message: `Votre ticket « ${misAJour.titre} » est pris en charge par le support.`,
        ticketId: id,
      });
    }
    return misAJour;
  },

  // Résolution : le technicien assigné marque le ticket résolu (EN_COURS → RESOLU).
  // La clôture reste une étape séparée (validation du demandeur, ou clôture admin).
  async resoudre(acteur: Acteur, id: number, solution?: string): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estTechnicienAssigne(acteur, ticket)) {
      throw new ForbiddenError('Seul le technicien assigné peut résoudre ce ticket');
    }
    verifierTransition(ticket.statut, 'RESOLU');

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'CHANGEMENT_STATUT',
      ancienneValeur: ticket.statut,
      nouvelleValeur: 'RESOLU',
    });

    // K1 : la solution appliquée (facultative) est capturée à la résolution. Sans elle,
    // resolution reste NULL → le ticket n'entrera pas dans la KB du RAG (K2). Avec elle,
    // on horodate resolutionDate — le couple sert de source « réelle » citable.
    const texteSolution = solution?.trim() ? solution.trim() : null;
    const misAJour = await ticketRepository.update(id, {
      statut: 'RESOLU',
      resolution: texteSolution,
      resolutionDate: texteSolution ? new Date() : null,
    });
    logAudit('TICKET_STATUT', { ticketId: id, de: ticket.statut, vers: 'RESOLU', parUtilisateur: acteur.id });

    // Flywheel : à la résolution, la catégorie du ticket devient un label validé par l'humain.
    await iaService.reconcilierSuggestions(id, misAJour.categorie?.nom ?? null);

    // Inviter le demandeur à valider la résolution (sa validation clôturera le ticket).
    if (misAJour.demandeur.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: misAJour.demandeur,
        type: 'CHANGEMENT_STATUT',
        sujet: `Ticket #${id} — résolu`,
        message: `Votre ticket « ${misAJour.titre} » a été marqué résolu. Merci de valider la résolution.`,
        ticketId: id,
      });
    }
    return misAJour;
  },

  // Clôture directe par l'ADMINISTRATEUR (RESOLU → CLOTURE) — typiquement quand le
  // demandeur ne valide pas (absent). L'autre voie vers CLOTURE est la validation du
  // demandeur (`evaluerSatisfaction`). Un technicien seul ne clôture jamais (T-W4).
  async cloturer(acteur: Acteur, id: number): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estAdmin(acteur)) {
      throw new ForbiddenError('Seul un administrateur peut clôturer directement un ticket');
    }
    verifierTransition(ticket.statut, 'CLOTURE');

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'CHANGEMENT_STATUT',
      ancienneValeur: ticket.statut,
      nouvelleValeur: 'CLOTURE',
    });

    const misAJour = await ticketRepository.update(id, {
      statut: 'CLOTURE',
      dateCloture: new Date(),
    });
    logAudit('TICKET_STATUT', { ticketId: id, de: ticket.statut, vers: 'CLOTURE', parUtilisateur: acteur.id });

    // Flywheel : filet (clôture admin) — la catégorie finale reste un label validé.
    await iaService.reconcilierSuggestions(id, misAJour.categorie?.nom ?? null);

    // Informer le demandeur de la clôture.
    if (misAJour.demandeur.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: misAJour.demandeur,
        type: 'CHANGEMENT_STATUT',
        sujet: `Ticket #${id} — clôturé`,
        message: `Votre ticket « ${misAJour.titre} » a été clôturé par l'administration.`,
        ticketId: id,
      });
    }
    return misAJour;
  },

  async changerPriorite(acteur: Acteur, id: number, priorite: Priorite): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estGestionnaire(acteur, ticket)) refusModification(acteur.role);

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'CHANGEMENT_PRIORITE',
      ancienneValeur: ticket.priorite,
      nouvelleValeur: priorite,
    });

    const misAJour = await ticketRepository.update(id, { priorite });
    logAudit('TICKET_PRIORITE', { ticketId: id, de: ticket.priorite, vers: priorite, parUtilisateur: acteur.id });
    return misAJour;
  },

  // Assignation manuelle par l'ADMINISTRATEUR (seul habilité — T-W1).
  //  - assigner / réassigner un technicien → le ticket (re)passe EN_ATTENTE ; le
  //    technicien devra ensuite « prendre en charge » pour passer EN_COURS ;
  //  - désassigner (technicienId = null)   → le ticket revient à NOUVEAU (T-W3).
  // Interdit une fois le ticket résolu ou clôturé (fin de cycle).
  async affecter(acteur: Acteur, id: number, technicienId: number | null): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estAdmin(acteur)) {
      throw new ForbiddenError('Seul un administrateur peut affecter un ticket');
    }
    if (ticket.statut === 'RESOLU' || ticket.statut === 'CLOTURE') {
      throw new ValidationError('Un ticket résolu ou clôturé ne peut plus être (ré)affecté');
    }
    // Rien à changer (même technicien, ou déjà non assigné) : no-op idempotent.
    if (technicienId === ticket.technicienId) return ticket;

    const technicien = await resoudreTechnicien(technicienId);
    return appliquerAffectation(ticket, technicien, acteur.id);
  },

  // Affectation AUTOMATIQUE (§6.2, mode AUTO) — décidée par le système à la création.
  // Rejoint exactement le même cœur que l'affectation manuelle : l'événement, le journal
  // d'audit et la notification du technicien sont donc identiques et gratuits.
  //
  // Ne lève JAMAIS : la création d'un ticket ne doit pas échouer parce que l'affectation
  // automatique n'a pas abouti (R6). Toute anomalie laisse le ticket NOUVEAU, non assigné,
  // exactement comme en mode MANUEL — l'administrateur reprend la main.
  //
  // `categorieId` : catégorie EFFECTIVE, déjà arbitrée par l'appelant (catégorie réelle du
  // demandeur, sinon suggestion IA au-dessus du seuil, sinon null).
  // `auteurId` : null quand la décision vient du système.
  async affecterAutomatiquement(
    ticket: TicketDetail,
    categorieId: number | null,
    auteurId: number | null = null,
  ): Promise<ResultatAffectationAuto> {
    // Précaution : ne jamais écraser une affectation existante.
    if (ticket.technicienId !== null) {
      return { affecte: false, raison: 'TICKET_DEJA_ASSIGNE' };
    }

    try {
      const candidats = await affectationRepository.chargeCourante({ jour: dateDuJour(new Date()) });
      const resultat = choisirTechnicien(
        candidats
          .filter((c) => c.eligibleAffectation)
          .map((c) => ({
            id: c.technicienId,
            categories: c.categories,
            charge: c.charge,
            dernierTicketAssigne: c.dernierTicketAssigne,
            absenceEnCours: c.absenceEnCours,
          })),
        categorieId,
      );

      if (!resultat.affecte) {
        logAudit('TICKET_AFFECTATION_AUTO_SANS_SUITE', {
          ticketId: ticket.id,
          raison: resultat.raison,
        });
        return resultat;
      }

      // Relecture de la cible : elle a pu être désactivée entre le calcul et l'écriture.
      const technicien = await resoudreTechnicien(resultat.technicienId);
      await appliquerAffectation(ticket, technicien, auteurId, resultat.motif);
      return resultat;
    } catch (err) {
      console.warn(
        `[AFFECTATION] automatique impossible sur le ticket #${ticket.id} — il reste non assigné :`,
        err instanceof Error ? err.message : err,
      );
      return { affecte: false, raison: 'ECHEC_TECHNIQUE' };
    }
  },

  // Correction de la catégorie après création (T-W6 — socle du flywheel J9).
  // Le technicien assigné ou un administrateur peut recatégoriser tant que le ticket
  // n'est pas clôturé. L'événement CHANGEMENT_CATEGORIE trace ancienne → nouvelle
  // catégorie : c'est ce couple qui capturera « l'IA suggérait X, l'humain a choisi Y ».
  async changerCategorie(acteur: Acteur, id: number, categorieId: number): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estAdmin(acteur) && !estTechnicienAssigne(acteur, ticket)) {
      throw new ForbiddenError(
        'Seul le technicien assigné ou un administrateur peut corriger la catégorie',
      );
    }
    if (ticket.statut === 'CLOTURE') {
      throw new ValidationError("La catégorie d'un ticket clôturé ne peut plus être modifiée");
    }

    const categorie = await categorieRepository.findById(categorieId);
    if (!categorie) throw new ValidationError('Catégorie invalide');
    if (ticket.categorieId === categorieId) return ticket; // no-op idempotent

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'CHANGEMENT_CATEGORIE',
      ancienneValeur: ticket.categorie?.nom ?? null,
      nouvelleValeur: categorie.nom,
    });

    const misAJour = await ticketRepository.update(id, { categorieId });
    logAudit('TICKET_CATEGORIE', {
      ticketId: id,
      de: ticket.categorieId,
      vers: categorieId,
      parUtilisateur: acteur.id,
    });

    // Flywheel : correction explicite → on marque les suggestions (validée / corrigée).
    await iaService.reconcilierSuggestions(id, categorie.nom);
    return misAJour;
  },

  async commenter(acteur: Acteur, id: number, contenu: string): Promise<CommentaireAvecAuteur> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');

    // Peuvent commenter : le demandeur, le technicien assigné, ou un administrateur
    // (supervision — décision workflow #5). estGestionnaire couvre admin + tech. assigné.
    const parDemandeur = estDemandeur(acteur, ticket);
    if (!parDemandeur && !estGestionnaire(acteur, ticket)) {
      throw new ForbiddenError('Vous ne participez pas à ce ticket');
    }

    const commentaire = await ticketRepository.creerCommentaire({
      ticketId: id,
      auteurId: acteur.id,
      contenu,
    });

    // Notifier l'autre partie : demandeur → technicien affecté ; support → demandeur.
    if (parDemandeur) {
      if (ticket.technicien && ticket.technicien.id !== acteur.id) {
        await notificationService.notifier({
          destinataire: ticket.technicien,
          type: 'NOUVEAU_COMMENTAIRE',
          sujet: `Ticket #${id} — nouveau message`,
          message: `${commentaire.auteur.prenom} ${commentaire.auteur.nom} a répondu sur « ${ticket.titre} ».`,
          ticketId: id,
        });
      }
    } else if (ticket.demandeur.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: ticket.demandeur,
        type: 'NOUVEAU_COMMENTAIRE',
        sujet: `Ticket #${id} — réponse du support`,
        message: `Le support a répondu à votre ticket « ${ticket.titre} ».`,
        ticketId: id,
      });
    }
    return commentaire;
  },

  // Demande d'une suggestion RAG (Greffe 2). Règle workflow : le technicien ASSIGNÉ (ou un
  // admin), et uniquement quand le ticket est EN_COURS (le moment où il le traite). La
  // génération (15-30 s) est lancée en ASYNCHRONE ; on renvoie immédiatement le ticket avec
  // la ligne SOLUTION en EN_COURS (l'UI affiche « génération en cours » et sonde ensuite).
  async demanderSuggestion(acteur: Acteur, id: number): Promise<TicketDetail> {
    if (!env.IA_ACTIVE) throw new ValidationError('Le module IA est désactivé');
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estAdmin(acteur) && !estTechnicienAssigne(acteur, ticket)) {
      throw new ForbiddenError(
        'Seul le technicien assigné ou un administrateur peut demander une suggestion',
      );
    }
    if (ticket.statut !== 'EN_COURS') {
      throw new ValidationError(
        'Une suggestion ne peut être demandée que sur un ticket en cours de traitement',
      );
    }

    await iaService.demarrerSuggestion(id, ticket.titre, ticket.description);
    logAudit('TICKET_SUGGESTION', { ticketId: id, parUtilisateur: acteur.id });
    return (await ticketRepository.findById(id)) ?? ticket;
  },

  // Ajout d'une pièce jointe (J8bis, Lot A) : upload vers Cloudinary puis persistance.
  // Peut ajouter : le demandeur (son ticket) ou le support (technicien assigné / admin).
  async ajouterPieceJointe(
    acteur: Acteur,
    id: number,
    fichier: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!estConfigure()) {
      throw new ValidationError("Le stockage des pièces jointes n'est pas configuré");
    }
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estDemandeur(acteur, ticket) && !estGestionnaire(acteur, ticket)) {
      throw new ForbiddenError('Vous ne participez pas à ce ticket');
    }
    const nb = await ticketRepository.compterPiecesJointes(id);
    if (nb >= MAX_PIECES_PAR_TICKET) {
      throw new ValidationError(`Maximum ${MAX_PIECES_PAR_TICKET} pièces jointes par ticket`);
    }

    // L'upload dépend d'un service externe (Cloudinary) : une erreur (mauvaise config,
    // réseau, quota) ne doit pas remonter en 500 opaque → message explicite (502).
    // PDF → 'raw' (livraison sans réglage compte, original propre pour l'OCR) ; images → 'image'.
    const resourceType = fichier.mimetype === 'application/pdf' ? 'raw' : 'image';
    let stockage: { url: string; publicId: string };
    try {
      stockage = await uploaderBuffer(fichier.buffer, `smart-ticketing/tickets/${id}`, resourceType);
    } catch (err) {
      console.error('[PieceJointe] upload Cloudinary échoué :', err instanceof Error ? err.message : err);
      throw new AppError(502, "L'envoi vers le stockage de fichiers a échoué (réessayez plus tard).");
    }
    const piece = await ticketRepository.creerPieceJointe({
      ticketId: id,
      nomFichier: fichier.originalname,
      url: stockage.url,
      cloudinaryId: stockage.publicId,
      typeMime: fichier.mimetype,
      taille: fichier.size,
    });
    logAudit('TICKET_PIECE_JOINTE', { ticketId: id, pieceJointeId: piece.id, parUtilisateur: acteur.id });

    // OCR (J8bis Lot B) : extraction en ARRIÈRE-PLAN à partir du buffer DÉJÀ en main (pas de
    // re-téléchargement Cloudinary). Non bloquant → la réponse d'upload part immédiatement ;
    // l'OCR fiable peuple `texte_extrait` et déclenche une re-classification « après OCR ».
    void iaService.demarrerExtraction(piece.id, ticket, fichier.buffer, fichier.mimetype, fichier.originalname);

    return piece;
  },

  // Résout une pièce jointe pour le téléchargement proxifié (J8bis) : contrôle d'accès au
  // ticket (peutVoir) + appartenance de la pièce. Renvoie l'URL Cloudinary (jamais exposée
  // au client) que le contrôleur va récupérer côté serveur.
  async pieceJointePourTelechargement(acteur: Acteur, id: number, pieceJointeId: number) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!peutVoir(acteur, ticket)) throw new ForbiddenError('Accès refusé à ce ticket');
    // Lecture serveur avec l'url Cloudinary (jamais dans le payload client) ; on vérifie que
    // la pièce appartient bien au ticket dont l'accès vient d'être contrôlé.
    const piece = await ticketRepository.findPieceJointe(pieceJointeId);
    if (!piece || piece.ticketId !== id) throw new NotFoundError('Pièce jointe introuvable');
    return piece;
  },

  // Demande d'un résumé du fil (J8). Règle : le technicien assigné ou un admin, à N'IMPORTE
  // QUEL statut, dès que le fil a ≥ 2 messages (en dessous, la description suffit). La
  // génération (21-55 s) est ASYNCHRONE ; on renvoie tout de suite le ticket avec la ligne
  // RESUME en EN_COURS (l'UI sonde ensuite jusqu'à PRETE/ECHEC).
  async demanderResume(acteur: Acteur, id: number): Promise<TicketDetail> {
    if (!env.IA_ACTIVE) throw new ValidationError('Le module IA est désactivé');
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estAdmin(acteur) && !estTechnicienAssigne(acteur, ticket)) {
      throw new ForbiddenError('Seul le technicien assigné ou un administrateur peut demander un résumé');
    }
    if (ticket.commentaires.length < 2) {
      throw new ValidationError("Un résumé n'a d'intérêt qu'à partir de 2 messages dans le fil");
    }

    // Fil = description + commentaires chronologiques (SANS les événements de statut : ce sont
    // des métadonnées, pas de la conversation). Auteur annoté demandeur / technicien.
    const messages = ticket.commentaires.map((c) => ({
      auteur: `${c.auteur.prenom} ${c.auteur.nom} (${
        c.auteur.id === ticket.demandeur.id ? 'demandeur' : 'technicien'
      })`,
      contenu: c.contenu,
    }));
    await iaService.demarrerResume(id, ticket.titre, ticket.description, messages);
    logAudit('TICKET_RESUME', { ticketId: id, parUtilisateur: acteur.id });
    return (await ticketRepository.findById(id)) ?? ticket;
  },

  // Validation de la résolution par le DEMANDEUR (note 1..5 + commentaire optionnel).
  // C'est l'une des deux voies vers CLOTURE (l'autre = clôture admin). N'est possible
  // que depuis RESOLU et clôture systématiquement le ticket ; une fois CLOTURÉ,
  // l'évaluation est VERROUILLÉE — intégrité des données (décision workflow #6).
  async evaluerSatisfaction(
    acteur: Acteur,
    id: number,
    note: number,
    commentaire?: string,
  ): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estDemandeur(acteur, ticket)) {
      throw new ForbiddenError('Seul le demandeur peut évaluer la résolution');
    }
    if (ticket.statut === 'CLOTURE') {
      throw new ValidationError("L'évaluation n'est plus modifiable après la clôture du ticket");
    }
    if (ticket.statut !== 'RESOLU') {
      throw new ValidationError("L'évaluation n'est possible qu'une fois le ticket résolu");
    }

    const commentaireNettoye = commentaire?.trim() ? commentaire.trim() : null;
    // La validation clôture toujours le ticket (RESOLU → CLOTURE).
    const data: MettreAJourTicketData = {
      satisfactionNote: note,
      satisfactionCommentaire: commentaireNettoye,
      satisfactionDate: new Date(),
      statut: 'CLOTURE',
      dateCloture: new Date(),
    };

    // Trace de la validation dans le fil du ticket.
    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'EVALUATION',
      ancienneValeur: null,
      nouvelleValeur: `${note}/5`,
    });

    const misAJour = await ticketRepository.update(id, data);
    logAudit('TICKET_SATISFACTION', { ticketId: id, note, parUtilisateur: acteur.id });

    // Flywheel : filet (validation demandeur → clôture) — catégorie finale = label validé.
    await iaService.reconcilierSuggestions(id, misAJour.categorie?.nom ?? null);

    // Notifier le technicien assigné du retour reçu.
    if (ticket.technicien && ticket.technicien.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: ticket.technicien,
        type: 'EVALUATION',
        sujet: `Ticket #${id} — évaluation reçue`,
        message: `${nomComplet(misAJour.demandeur)} a évalué la résolution : ${note}/5.`,
        ticketId: id,
      });
    }
    return misAJour;
  },

  // Statistiques agrégées du tableau de bord : global pour le support/admin,
  // limité à ses propres tickets pour un employé, filtrable (période, technicien,
  // catégorie, service).
  async statistiques(acteur: Acteur, filtres: StatistiquesFiltres = {}) {
    const scope = construireScope(acteur, filtres);
    const {
      parStatut,
      parPriorite,
      parCategorie,
      satisfaction,
      repartitionNotes,
      clotures,
      prisesEnCharge,
    } = await ticketRepository.statistiques(scope);

    // Charge courante — extraite dans son propre dépôt : la même agrégation sert
    // l'affectation automatique (§6.2), qui a besoin d'ids et des techniciens à 0.
    const chargeTechniciens = await affectationRepository.chargeCourante({
      jour: dateDuJour(new Date()),
      scope,
    });

    const compter = (s: StatutTicket) => parStatut.find((g) => g.statut === s)?._count._all ?? 0;

    // Temps moyen de résolution (création -> clôture).
    const tempsResolutionMoyenHeures = moyenneHeures(
      clotures.map((t) => (t.dateCloture as Date).getTime() - t.dateCreation.getTime()),
    );

    // Délai moyen de prise en charge (création -> 1re prise en charge par le technicien).
    // `prisesEnCharge` = événements PRISE_EN_CHARGE (voir ticketRepository.statistiques).
    const premierePriseEnCharge = new Map<number, number>();
    for (const a of prisesEnCharge) {
      if (!premierePriseEnCharge.has(a.ticketId)) {
        premierePriseEnCharge.set(a.ticketId, a.dateCreation.getTime() - a.ticket.dateCreation.getTime());
      }
    }
    const delaiPriseEnChargeMoyenHeures = moyenneHeures([...premierePriseEnCharge.values()]);

    // Noms lisibles pour les répartitions par catégorie et la charge par technicien.
    const categories = await categorieRepository.findMany();
    const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));

    return {
      totalTickets: parStatut.reduce((n, g) => n + g._count._all, 0),
      ticketsOuverts: compter('NOUVEAU') + compter('EN_COURS') + compter('EN_ATTENTE'),
      ticketsResolus: compter('RESOLU'),
      ticketsClotures: compter('CLOTURE'),
      tempsResolutionMoyenHeures,
      delaiPriseEnChargeMoyenHeures,
      satisfactionMoyenne:
        satisfaction._avg.satisfactionNote != null ? arrondi(satisfaction._avg.satisfactionNote) : null,
      nombreEvaluations: satisfaction._count.satisfactionNote,
      repartitionSatisfaction: [1, 2, 3, 4, 5].map((note) => ({
        note,
        count: repartitionNotes.find((r) => r.satisfactionNote === note)?._count._all ?? 0,
      })),
      repartitionStatut: TOUS_STATUTS.map((statut) => ({ statut, count: compter(statut) })),
      repartitionPriorite: TOUTES_PRIORITES.map((priorite) => ({
        priorite,
        count: parPriorite.find((g) => g.priorite === priorite)?._count._all ?? 0,
      })),
      repartitionCategorie: parCategorie
        .map((g) => ({
          categorie:
            g.categorieId != null ? nomCategorie.get(g.categorieId) ?? 'Inconnue' : 'Non classé',
          count: g._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      // Le MOTIF d'absence n'est jamais exposé ici : ce graphique est visible par tous
      // les techniciens (garde `estSupport` côté interface), et MALADIE est une donnée
      // de santé. Seule la date de fin remonte, pour que l'administrateur puisse
      // redistribuer en connaissance de cause.
      chargeParTechnicien: chargeTechniciens
        .map((t) => ({
          technicienId: t.technicienId,
          technicien: t.nom,
          count: t.charge,
          absenceJusquau: t.absenceEnCours?.dateFin ?? null,
        }))
        .sort((a, b) => b.count - a.count || a.technicien.localeCompare(b.technicien)),
    };
  },
};

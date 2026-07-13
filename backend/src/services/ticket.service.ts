import {
  ticketRepository,
  type CommentaireAvecAuteur,
  type FiltresTickets,
  type MettreAJourTicketData,
  type TicketDetail,
  type TicketListe,
} from '../repositories/ticket.repository';
import { categorieRepository } from '../repositories/categorie.repository';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { notificationService } from './notification.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/AppError';
import { logAudit } from '../utils/logger';
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

// Transitions de statut autorisées (cycle de vie du ticket). Un ticket clôturé
// ou résolu peut être rouvert (retour « En cours »).
const TRANSITIONS_STATUT: Record<StatutTicket, StatutTicket[]> = {
  NOUVEAU: ['EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE'],
  EN_COURS: ['EN_ATTENTE', 'RESOLU', 'CLOTURE'],
  EN_ATTENTE: ['EN_COURS', 'RESOLU', 'CLOTURE'],
  RESOLU: ['EN_COURS', 'CLOTURE'],
  CLOTURE: ['EN_COURS'],
};

const LABEL_STATUT: Record<StatutTicket, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
};

// Un employé ne voit que ses propres tickets ; technicien et administrateur voient tout.
function peutVoir(acteur: Acteur, ticket: { demandeurId: number }): boolean {
  return acteur.role !== 'EMPLOYE' || ticket.demandeurId === acteur.id;
}

// Peut modifier (statut / priorité) : l'administrateur, ou le technicien assigné au ticket.
function estGestionnaire(acteur: Acteur, ticket: { technicienId: number | null }): boolean {
  return (
    acteur.role === 'ADMINISTRATEUR' ||
    (acteur.role === 'TECHNICIEN' && ticket.technicienId === acteur.id)
  );
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

// Contrôle qui peut affecter : admin sans restriction, technicien seulement à lui-même
// sur un ticket non déjà pris par un autre, employé jamais.
function verifierDroitAffectation(
  acteur: Acteur,
  ticket: { technicienId: number | null },
  technicienId: number | null,
): void {
  if (acteur.role === 'EMPLOYE') {
    throw new ForbiddenError('Action réservée au support');
  }
  if (acteur.role !== 'TECHNICIEN') return; // administrateur
  if (technicienId !== acteur.id) {
    throw new ForbiddenError("Un technicien ne peut s'attribuer qu'à lui-même");
  }
  if (ticket.technicienId && ticket.technicienId !== acteur.id) {
    throw new ForbiddenError('Ce ticket est déjà pris en charge par un autre technicien');
  }
}

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
    return ticket;
  },

  async changerStatut(acteur: Acteur, id: number, statut: StatutTicket): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (!estGestionnaire(acteur, ticket)) refusModification(acteur.role);

    if (ticket.statut === statut) return ticket;
    if (!TRANSITIONS_STATUT[ticket.statut].includes(statut)) {
      throw new ValidationError(
        `Transition impossible de « ${LABEL_STATUT[ticket.statut]} » vers « ${LABEL_STATUT[statut]} »`,
      );
    }

    const data: { statut: StatutTicket; dateCloture?: Date | null } = { statut };
    if (statut === 'CLOTURE') data.dateCloture = new Date();
    else if (ticket.dateCloture) data.dateCloture = null; // réouverture : on efface la date de clôture

    // Trace dans le fil du ticket (créée avant la mise à jour pour être incluse dans le détail renvoyé).
    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'CHANGEMENT_STATUT',
      ancienneValeur: ticket.statut,
      nouvelleValeur: statut,
    });

    const misAJour = await ticketRepository.update(id, data);
    logAudit('TICKET_STATUT', { ticketId: id, de: ticket.statut, vers: statut, parUtilisateur: acteur.id });

    // Notifier le demandeur du changement de statut (sauf s'il en est l'auteur).
    if (misAJour.demandeur.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: misAJour.demandeur,
        type: 'CHANGEMENT_STATUT',
        sujet: `Ticket #${id} — ${LABEL_STATUT[statut]}`,
        message: `Votre ticket « ${misAJour.titre} » est passé au statut « ${LABEL_STATUT[statut]} ».`,
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

  // Affectation manuelle (l'affectation automatique par charge/catégorie arrive en Phase 5).
  // Un administrateur affecte à n'importe quel technicien (ou désaffecte) ; un technicien
  // ne peut que s'attribuer lui-même un ticket non encore pris en charge.
  async affecter(acteur: Acteur, id: number, technicienId: number | null): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');

    verifierDroitAffectation(acteur, ticket, technicienId);
    const technicien = await resoudreTechnicien(technicienId);

    const data: { technicienId: number | null; statut?: StatutTicket } = { technicienId };
    // Première prise en charge : un ticket « Nouveau » passe automatiquement « En cours ».
    if (technicienId !== null && ticket.statut === 'NOUVEAU') data.statut = 'EN_COURS';

    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: technicienId === null ? 'DESAFFECTATION' : 'AFFECTATION',
      ancienneValeur: ticket.technicien ? nomComplet(ticket.technicien) : null,
      nouvelleValeur: technicien ? nomComplet(technicien) : null,
    });

    const misAJour = await ticketRepository.update(id, data);
    logAudit('TICKET_AFFECTATION', { ticketId: id, technicienId, parUtilisateur: acteur.id });

    // Notifier le technicien affecté (sauf auto-affectation).
    if (technicien && technicien.id !== acteur.id) {
      await notificationService.notifier({
        destinataire: { id: technicien.id, email: technicien.email, prenom: technicien.prenom },
        type: 'AFFECTATION',
        sujet: `Ticket #${id} vous est affecté`,
        message: `Le ticket « ${misAJour.titre} » vous a été affecté.`,
        ticketId: id,
      });
    }
    return misAJour;
  },

  async commenter(acteur: Acteur, id: number, contenu: string): Promise<CommentaireAvecAuteur> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');

    const estDemandeur = ticket.demandeurId === acteur.id;
    if (!estDemandeur && !estGestionnaire(acteur, ticket)) {
      throw new ForbiddenError('Vous ne participez pas à ce ticket');
    }

    const commentaire = await ticketRepository.creerCommentaire({
      ticketId: id,
      auteurId: acteur.id,
      contenu,
    });

    // Notifier l'autre partie : demandeur → technicien affecté ; support → demandeur.
    if (estDemandeur) {
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

  // Évaluation de satisfaction par le demandeur (note 1..5 + commentaire optionnel).
  // Évaluer un ticket « Résolu » le clôture définitivement ; l'évaluation reste
  // modifiable par le demandeur tant qu'il le souhaite.
  async evaluerSatisfaction(
    acteur: Acteur,
    id: number,
    note: number,
    commentaire?: string,
  ): Promise<TicketDetail> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket introuvable');
    if (ticket.demandeurId !== acteur.id) {
      throw new ForbiddenError('Seul le demandeur peut évaluer la résolution');
    }
    if (ticket.statut !== 'RESOLU' && ticket.statut !== 'CLOTURE') {
      throw new ValidationError("L'évaluation n'est possible qu'une fois le ticket résolu");
    }

    const commentaireNettoye = commentaire?.trim() ? commentaire.trim() : null;
    const data: MettreAJourTicketData = {
      satisfactionNote: note,
      satisfactionCommentaire: commentaireNettoye,
      satisfactionDate: new Date(),
    };
    if (ticket.statut === 'RESOLU') {
      data.statut = 'CLOTURE';
      data.dateCloture = new Date();
    }

    // Trace de l'évaluation dans le fil du ticket.
    await ticketRepository.creerEvenement({
      ticketId: id,
      auteurId: acteur.id,
      type: 'EVALUATION',
      ancienneValeur: ticket.satisfactionNote !== null ? `${ticket.satisfactionNote}/5` : null,
      nouvelleValeur: `${note}/5`,
    });

    const misAJour = await ticketRepository.update(id, data);
    logAudit('TICKET_SATISFACTION', { ticketId: id, note, parUtilisateur: acteur.id });

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
      chargeTechniciens,
      clotures,
      affectations,
    } = await ticketRepository.statistiques(scope);

    const compter = (s: StatutTicket) => parStatut.find((g) => g.statut === s)?._count._all ?? 0;

    // Temps moyen de résolution (création -> clôture).
    const tempsResolutionMoyenHeures = moyenneHeures(
      clotures.map((t) => (t.dateCloture as Date).getTime() - t.dateCreation.getTime()),
    );

    // Délai moyen de première prise en charge (création -> 1re affectation).
    const premiereAffectation = new Map<number, number>();
    for (const a of affectations) {
      if (!premiereAffectation.has(a.ticketId)) {
        premiereAffectation.set(a.ticketId, a.dateCreation.getTime() - a.ticket.dateCreation.getTime());
      }
    }
    const delaiPriseEnChargeMoyenHeures = moyenneHeures([...premiereAffectation.values()]);

    // Noms lisibles pour les répartitions par catégorie et la charge par technicien.
    const categories = await categorieRepository.findMany();
    const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));
    const idsTech = chargeTechniciens
      .map((g) => g.technicienId)
      .filter((id): id is number => id !== null);
    const techniciens = idsTech.length ? await utilisateurRepository.findManyByIds(idsTech) : [];
    const nomTechnicien = new Map(techniciens.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

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
      chargeParTechnicien: chargeTechniciens
        .map((g) => ({
          technicien: g.technicienId != null ? nomTechnicien.get(g.technicienId) ?? 'Inconnu' : '—',
          count: g._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  },
};

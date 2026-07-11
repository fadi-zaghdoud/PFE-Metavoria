import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import type { Priorite, StatutTicket } from '../generated/prisma/enums';

// Champs utilisateur exposables dans une relation de ticket : jamais de secret
// (mot de passe, tokens, codes OTP) ne doit fuiter via demandeur/technicien/auteur.
const utilisateurPublicSelect = {
  id: true,
  prenom: true,
  nom: true,
  email: true,
  service: true,
  role: true,
} satisfies Prisma.UtilisateurSelect;

const ticketListeInclude = {
  categorie: true,
  demandeur: { select: utilisateurPublicSelect },
  technicien: { select: utilisateurPublicSelect },
  _count: { select: { commentaires: true } },
} satisfies Prisma.TicketInclude;

const ticketDetailInclude = {
  categorie: true,
  demandeur: { select: utilisateurPublicSelect },
  technicien: { select: utilisateurPublicSelect },
  commentaires: {
    orderBy: { dateCreation: 'asc' },
    include: { auteur: { select: utilisateurPublicSelect } },
  },
  evenements: {
    orderBy: { dateCreation: 'asc' },
    include: { auteur: { select: utilisateurPublicSelect } },
  },
} satisfies Prisma.TicketInclude;

export type TicketListe = Prisma.TicketGetPayload<{ include: typeof ticketListeInclude }>;
export type TicketDetail = Prisma.TicketGetPayload<{ include: typeof ticketDetailInclude }>;
export type CommentaireAvecAuteur = Prisma.CommentaireGetPayload<{
  include: { auteur: { select: typeof utilisateurPublicSelect } };
}>;

export interface CreerEvenementData {
  ticketId: number;
  auteurId: number;
  type: string; // CHANGEMENT_STATUT | CHANGEMENT_PRIORITE | AFFECTATION | DESAFFECTATION
  ancienneValeur?: string | null;
  nouvelleValeur?: string | null;
}

export interface FiltresTickets {
  statut?: StatutTicket;
  priorite?: Priorite;
  categorieId?: number;
  technicienId?: number;
  demandeurId?: number;
  nonAssignes?: boolean;
  q?: string;
}

export interface CreerTicketData {
  titre: string;
  description: string;
  priorite?: Priorite;
  categorieId?: number | null;
  demandeurId: number;
}

export interface MettreAJourTicketData {
  statut?: StatutTicket;
  priorite?: Priorite;
  technicienId?: number | null;
  dateCloture?: Date | null;
  satisfactionNote?: number | null;
  satisfactionCommentaire?: string | null;
  satisfactionDate?: Date | null;
}

// Couche repository : seule couche à parler directement à Prisma.
export const ticketRepository = {
  findMany(filtres: FiltresTickets) {
    return prisma.ticket.findMany({
      where: {
        statut: filtres.statut,
        priorite: filtres.priorite,
        categorieId: filtres.categorieId,
        technicienId: filtres.nonAssignes ? null : filtres.technicienId,
        demandeurId: filtres.demandeurId,
        ...(filtres.q
          ? {
              OR: [
                { titre: { contains: filtres.q, mode: 'insensitive' } },
                { description: { contains: filtres.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: ticketListeInclude,
      orderBy: { dateCreation: 'desc' },
    });
  },

  findById(id: number) {
    return prisma.ticket.findUnique({ where: { id }, include: ticketDetailInclude });
  },

  create(data: CreerTicketData) {
    return prisma.ticket.create({ data, include: ticketDetailInclude });
  },

  update(id: number, data: MettreAJourTicketData) {
    return prisma.ticket.update({ where: { id }, data, include: ticketDetailInclude });
  },

  creerCommentaire(data: { ticketId: number; auteurId: number; contenu: string }) {
    return prisma.commentaire.create({
      data,
      include: { auteur: { select: utilisateurPublicSelect } },
    });
  },

  creerEvenement(data: CreerEvenementData) {
    return prisma.evenementTicket.create({ data });
  },

  // Statistiques agrégées sur un périmètre (tous les tickets, ou ceux d'un demandeur).
  async statistiques(scope: Prisma.TicketWhereInput) {
    const [parStatut, agregat, repartition] = await Promise.all([
      prisma.ticket.groupBy({ by: ['statut'], where: scope, _count: { _all: true } }),
      prisma.ticket.aggregate({
        where: { ...scope, satisfactionNote: { not: null } },
        _avg: { satisfactionNote: true },
        _count: { satisfactionNote: true },
      }),
      prisma.ticket.groupBy({
        by: ['satisfactionNote'],
        where: { ...scope, satisfactionNote: { not: null } },
        _count: { _all: true },
      }),
    ]);
    return { parStatut, agregat, repartition };
  },
};

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
  // Suggestions IA (Greffe 1) — les plus récentes d'abord ; affichées sur le détail.
  suggestionsIA: {
    orderBy: { dateCreation: 'desc' },
  },
  // Pièces jointes (J8bis) — dans l'ordre d'ajout. `url`/`cloudinaryId`/`texteExtrait` NE sont
  // PAS exposés au client (§10 : l'URL Cloudinary publique reste côté serveur ; le download
  // passe par le proxy authentifié). Le texte OCR (texteExtrait) alimentera le pipeline en
  // interne au Lot B, sans transiter par le client.
  piecesJointes: {
    orderBy: { dateUpload: 'asc' },
    select: {
      id: true,
      nomFichier: true,
      typeMime: true,
      taille: true,
      dateUpload: true,
      ticketId: true,
    },
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
  // CHANGEMENT_STATUT | CHANGEMENT_PRIORITE | CHANGEMENT_CATEGORIE | AFFECTATION |
  // DESAFFECTATION | PRISE_EN_CHARGE | EVALUATION
  type: string;
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
  categorieId?: number | null;
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

  compterPiecesJointes(ticketId: number) {
    return prisma.pieceJointe.count({ where: { ticketId } });
  },

  creerPieceJointe(data: {
    ticketId: number;
    nomFichier: string;
    url: string;
    cloudinaryId: string;
    typeMime: string;
    taille: number;
  }) {
    // Renvoie une pièce SANS url/cloudinaryId/texteExtrait (client-safe, §10).
    return prisma.pieceJointe.create({
      data,
      select: {
        id: true,
        nomFichier: true,
        typeMime: true,
        taille: true,
        dateUpload: true,
        ticketId: true,
      },
    });
  },

  // Pièce jointe complète (avec `url`) — usage SERVEUR uniquement (proxy de téléchargement).
  findPieceJointe(id: number) {
    return prisma.pieceJointe.findUnique({ where: { id } });
  },

  // Écrit le texte OCR extrait (J8bis Lot B). Appelé UNIQUEMENT si l'extraction est fiable ;
  // JAMAIS dans `description` (augmentation à l'usage : le texte OCR enrichit sans réécrire).
  majTexteExtrait(id: number, texteExtrait: string) {
    return prisma.pieceJointe.update({ where: { id }, data: { texteExtrait } });
  },

  // Textes OCR fiables déjà extraits des pièces d'un ticket (texte_extrait non nul = fiable),
  // dans l'ordre d'ajout → concaténés pour la re-classification « après OCR ».
  async textesExtraitsDuTicket(ticketId: number) {
    const pieces = await prisma.pieceJointe.findMany({
      where: { ticketId, texteExtrait: { not: null } },
      orderBy: { dateUpload: 'asc' },
      select: { id: true, texteExtrait: true },
    });
    return pieces.map((p) => ({ id: p.id, texteExtrait: p.texteExtrait as string }));
  },

  // Statistiques agrégées sur un périmètre (tous les tickets, ou un sous-ensemble filtré).
  async statistiques(scope: Prisma.TicketWhereInput) {
    const [
      parStatut,
      parPriorite,
      parCategorie,
      satisfaction,
      repartitionNotes,
      chargeTechniciens,
      clotures,
      prisesEnCharge,
    ] = await Promise.all([
      prisma.ticket.groupBy({ by: ['statut'], where: scope, _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['priorite'], where: scope, _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['categorieId'], where: scope, _count: { _all: true } }),
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
      // Charge courante : tickets encore ouverts, par technicien assigné.
      prisma.ticket.groupBy({
        by: ['technicienId'],
        where: { ...scope, technicienId: { not: null }, statut: { in: ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE'] } },
        _count: { _all: true },
      }),
      // Pour le temps moyen de résolution (création -> clôture).
      prisma.ticket.findMany({
        where: { ...scope, dateCloture: { not: null } },
        select: { dateCreation: true, dateCloture: true },
      }),
      // Pour le délai de prise en charge (création -> 1re prise en charge par le technicien).
      prisma.evenementTicket.findMany({
        where: { type: 'PRISE_EN_CHARGE', ticket: scope },
        select: { ticketId: true, dateCreation: true, ticket: { select: { dateCreation: true } } },
        orderBy: { dateCreation: 'asc' },
      }),
    ]);
    return {
      parStatut,
      parPriorite,
      parCategorie,
      satisfaction,
      repartitionNotes,
      chargeTechniciens,
      clotures,
      prisesEnCharge,
    };
  },
};

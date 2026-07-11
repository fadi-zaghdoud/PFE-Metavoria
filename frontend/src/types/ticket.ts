import type { Role } from './auth';

export type StatutTicket = 'NOUVEAU' | 'EN_COURS' | 'EN_ATTENTE' | 'RESOLU' | 'CLOTURE';
export type PrioriteTicket = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';

// Personne exposée dans une relation de ticket (demandeur, technicien, auteur) —
// jamais de champ sensible (le backend restreint la sélection).
export interface PersonnePublique {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  service: string | null;
  role: Role;
}

export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
}

export interface Commentaire {
  id: number;
  contenu: string;
  dateCreation: string;
  ticketId: number;
  auteurId: number;
  auteur: PersonnePublique;
}

export type TypeEvenement =
  | 'CHANGEMENT_STATUT'
  | 'CHANGEMENT_PRIORITE'
  | 'AFFECTATION'
  | 'DESAFFECTATION'
  | 'EVALUATION';

// Entrée d'historique d'un ticket (changement de statut, priorité, affectation),
// affichée dans le fil de conversation à côté des commentaires.
export interface EvenementTicket {
  id: number;
  type: TypeEvenement;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  dateCreation: string;
  ticketId: number;
  auteurId: number;
  auteur: PersonnePublique;
}

// Ticket tel que renvoyé par la liste (avec compteur de commentaires).
export interface TicketResume {
  id: number;
  titre: string;
  description: string;
  statut: StatutTicket;
  priorite: PrioriteTicket;
  dateCreation: string;
  dateCloture: string | null;
  satisfactionNote: number | null;
  satisfactionCommentaire: string | null;
  satisfactionDate: string | null;
  categorieId: number | null;
  categorie: Categorie | null;
  demandeurId: number;
  demandeur: PersonnePublique;
  technicienId: number | null;
  technicien: PersonnePublique | null;
  _count: { commentaires: number };
}

// Ticket détaillé (avec le fil de commentaires), renvoyé par le détail et les mutations.
export interface TicketDetail {
  id: number;
  titre: string;
  description: string;
  statut: StatutTicket;
  priorite: PrioriteTicket;
  dateCreation: string;
  dateCloture: string | null;
  satisfactionNote: number | null;
  satisfactionCommentaire: string | null;
  satisfactionDate: string | null;
  categorieId: number | null;
  categorie: Categorie | null;
  demandeurId: number;
  demandeur: PersonnePublique;
  technicienId: number | null;
  technicien: PersonnePublique | null;
  commentaires: Commentaire[];
  evenements: EvenementTicket[];
}

export interface Notification {
  id: number;
  type: string;
  contenu: string;
  lu: boolean;
  dateEnvoi: string;
  utilisateurId: number;
  ticketId: number | null;
}

export interface CreerTicketPayload {
  titre: string;
  description: string;
  categorieId?: number;
  priorite?: PrioriteTicket;
}

export interface FiltresTickets {
  statut?: StatutTicket;
  priorite?: PrioriteTicket;
  categorieId?: number;
  technicienId?: number;
  nonAssignes?: boolean;
  q?: string;
}

export interface StatistiquesTickets {
  totalTickets: number;
  ticketsOuverts: number;
  ticketsResolus: number;
  ticketsClotures: number;
  satisfactionMoyenne: number | null;
  nombreEvaluations: number;
  repartitionSatisfaction: { note: number; count: number }[];
}

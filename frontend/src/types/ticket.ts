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
  photoUrl: string | null;
}

export interface Categorie {
  id: number;
  nom: string;
  description: string | null;
}

// Cycle de vie d'une catégorie (Phase A) — statut CALCULÉ côté serveur (classes du modèle IA
// actif + compteur de labels validés), jamais stocké :
//   ACTIVE           : le modèle sait déjà classer dedans
//   APPRENABLE       : hors modèle, mais assez d'exemples validés → prête à réentraîner
//   EN_APPRENTISSAGE : hors modèle, pas encore assez d'exemples
//   INDETERMINE      : service IA injoignable → statut inconnu (fail-safe)
export type StatutCategorie = 'ACTIVE' | 'APPRENABLE' | 'EN_APPRENTISSAGE' | 'INDETERMINE';

export interface CategorieAdmin extends Categorie {
  dateCreation: string;
  nLabelsValides: number;
  statut: StatutCategorie;
}

export interface Commentaire {
  id: number;
  contenu: string;
  dateCreation: string;
  ticketId: number;
  auteurId: number;
  auteur: PersonnePublique;
}

// Pièce jointe (J8bis). L'URL Cloudinary N'est PAS exposée au client (§10) : le
// téléchargement passe par le proxy backend authentifié (GET …/pieces-jointes/:id/download).
export interface PieceJointe {
  id: number;
  nomFichier: string;
  typeMime: string | null;
  taille: number | null;
  dateUpload: string;
  ticketId: number;
  // Texte extrait par OCR (J8bis Lot B) — présent après extraction fiable, sinon absent/null.
  // Exposé aux personnes ayant accès au ticket (contenu d'un fichier déjà téléchargeable).
  texteExtrait?: string | null;
}

export type TypeEvenement =
  | 'CHANGEMENT_STATUT'
  | 'CHANGEMENT_PRIORITE'
  | 'CHANGEMENT_CATEGORIE'
  | 'AFFECTATION'
  // Affectation decidee par le systeme (mode AUTO, §6.2). Type DISTINCT d'AFFECTATION :
  // rend les affectations automatiques filtrables et denombrables.
  | 'AFFECTATION_AUTO'
  | 'DESAFFECTATION'
  | 'PRISE_EN_CHARGE'
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
  // null = « Systeme » : evenement sans auteur humain (affectation automatique).
  auteurId: number | null;
  auteur: PersonnePublique | null;
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
  suggestionsIA: SuggestionIA[];
  piecesJointes: PieceJointe[];
}

// Origine d'une suggestion catégorie/priorité : à la création (description seule) ou après
// OCR (description enrichie du texte extrait des pièces jointes). Absent = ancienne suggestion.
export type OrigineSuggestion = 'creation' | 'apres_ocr';

// Details d'une suggestion CLASSIFICATION (Greffe 1 ; ré-évaluée « après OCR » au Lot B).
export interface DetailClassificationIA {
  origine?: OrigineSuggestion;
  pieceJointeIds?: number[]; // pièces dont le texte OCR a nourri la ré-classification
  categorieId: number;
  probabilites: Record<string, number>;
  modeleEmbedding: string;
}

// Décomposition glass-box de la scorecard (details d'une suggestion PRIORISATION).
export interface DetailPrioriteIA {
  niveau: string;
  score: number;
  plafonne: boolean;
  explication: string; // « CRITIQUE car : production +2 · Réseau +1.5 »
  contributions: { famille: string; facteur: string; points: number; preuve: string }[];
  plafonnements: string[];
  origine?: OrigineSuggestion; // 'apres_ocr' → priorité ré-évaluée avec le texte extrait
  pieceJointeIds?: number[];
}

// Détail d'une suggestion SOLUTION (RAG, Greffe 2).
export interface DetailSolutionIA {
  abstenu: boolean; // true → aucune suggestion pertinente (pas d'invention)
  message: string; // motif d'abstention le cas échéant
  // `synthetique` (K3) : false = vraie résolution d'entreprise (badge « réel »).
  sources: { id: number; titre: string; synthetique: boolean }[]; // #id cités par la génération
  similaires: { id: number; titre: string; categorie: string | null; synthetique: boolean }[]; // candidats RRF
  latenceMs: number | null;
}

// Suggestion produite par le module IA. L'IA suggère, le technicien valide/corrige.
// `statut` : PRETE d'emblée pour les suggestions synchrones (CLASSIFICATION/PRIORISATION) ;
// EN_COURS → PRETE/ECHEC pour la SOLUTION RAG (générée en asynchrone). `details` dépend du
// type : PRIORISATION → DetailPrioriteIA ; SOLUTION → DetailSolutionIA.
export interface SuggestionIA {
  id: number;
  typeSuggestion: 'CLASSIFICATION' | 'PRIORISATION' | 'SOLUTION' | 'RESUME';
  contenu: string;
  scoreConfiance: number | null; // proba (classification) ; null pour la scorecard déterministe
  details: unknown; // cast au point d'usage selon le type
  statut: 'EN_COURS' | 'PRETE' | 'ECHEC';
  valideeParTechnicien: boolean | null;
  dateCreation: string;
  ticketId: number;
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
  // Pagination par curseur. `limite` omise = réponse complète, comme avant — c'est ce
  // dont dépend le compteur de tickets non assignés de la page Paramètres.
  limite?: number;
  avantId?: number;
}

export interface StatistiquesTickets {
  totalTickets: number;
  ticketsOuverts: number;
  ticketsResolus: number;
  ticketsClotures: number;
  tempsResolutionMoyenHeures: number | null;
  delaiPriseEnChargeMoyenHeures: number | null;
  // Nombre de tickets sur lesquels `delaiPriseEnChargeMoyenHeures` est calculé — pendant
  // de `nombreEvaluations` pour la satisfaction.
  nombrePrisesEnCharge: number;
  satisfactionMoyenne: number | null;
  nombreEvaluations: number;
  repartitionSatisfaction: { note: number; count: number }[];
  repartitionStatut: { statut: StatutTicket; count: number }[];
  repartitionPriorite: { priorite: PrioriteTicket; count: number }[];
  repartitionCategorie: { categorie: string; count: number }[];
  // `absenceJusquau` : date de fin d'absence en cours ("YYYY-MM-DD"), ou null.
  // Le MOTIF n'est jamais exposé ici — ce graphique est visible par tous les techniciens,
  // et MALADIE est une donnée de santé. Seules les dates remontent.
  chargeParTechnicien: {
    technicienId: number;
    technicien: string;
    count: number;
    absenceJusquau: string | null;
  }[];
}

export interface FiltresStatistiques {
  dateDebut?: string;
  dateFin?: string;
  technicienId?: number;
  categorieId?: number;
  service?: string;
}

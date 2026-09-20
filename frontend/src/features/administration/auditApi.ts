import { apiRequest } from '../../lib/apiClient';

// Client du journal d'audit (§7). Route réservée à l'administrateur côté serveur.

export type ResultatAudit = 'SUCCES' | 'ECHEC';

export interface EntreeAudit {
  id: number;
  action: string;
  acteurId: number | null;
  // Nom AU MOMENT DE L'ACTION, toujours rempli — « Système » pour une action automatique,
  // et conservé même si le compte a depuis été supprimé.
  acteurNom: string;
  cibleType: string | null;
  cibleId: number | null;
  resultat: ResultatAudit;
  // `null` sur les actions du système (aucune IP d'utilisateur à enregistrer) et sur les
  // entrées reprises de l'historique (jamais capturées à l'époque).
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  dateCreation: string;
}

export interface ReponseAudit {
  entrees: EntreeAudit[];
  // Actions réellement présentes en base, pour le menu de filtre.
  actionsConnues: string[];
  // Identifiant à repasser en `avantId` pour charger la suite ; `null` = plus rien.
  curseurSuivant: number | null;
  // Événements d'affectation dont la cible n'a pas pu être reliée à un compte.
  ciblesNonRattachees: number;
}

export interface FiltresAudit {
  action?: string;
  acteurId?: number;
  resultat?: ResultatAudit;
  dateDebut?: string;
  dateFin?: string;
  limite?: number;
  avantId?: number;
}

function query(filtres: FiltresAudit): string {
  const p = new URLSearchParams();
  if (filtres.action) p.set('action', filtres.action);
  if (filtres.acteurId) p.set('acteurId', String(filtres.acteurId));
  if (filtres.resultat) p.set('resultat', filtres.resultat);
  if (filtres.dateDebut) p.set('dateDebut', filtres.dateDebut);
  if (filtres.dateFin) p.set('dateFin', filtres.dateFin);
  if (filtres.limite) p.set('limite', String(filtres.limite));
  if (filtres.avantId) p.set('avantId', String(filtres.avantId));
  const q = p.toString();
  return q ? `?${q}` : '';
}

export const auditApi = {
  consulter: (filtres: FiltresAudit, token: string) =>
    apiRequest<ReponseAudit>(`/audit${query(filtres)}`, { token }),
};

// Libellés lisibles. Toute action absente de cette table s'affiche telle quelle plutôt
// que d'être masquée : une action non traduite reste une action à voir.
export const LABEL_ACTION: Record<string, string> = {
  CONNEXION: 'Connexion',
  CONNEXION_ECHEC: 'Échec de connexion',
  DECONNEXION: 'Déconnexion',
  COMPTE_ACTIVE: 'Compte activé',
  MOT_DE_PASSE_REINITIALISE: 'Mot de passe réinitialisé',
  UTILISATEUR_INVITE: 'Utilisateur invité',
  UTILISATEUR_INVITATION_RENVOYEE: 'Invitation renvoyée',
  UTILISATEUR_ROLE: 'Rôle modifié',
  UTILISATEUR_DESACTIVE: 'Compte désactivé',
  UTILISATEUR_REACTIVE: 'Compte réactivé',
  UTILISATEUR_SPECIALITES: 'Spécialités modifiées',
  CATEGORIE_CREEE: 'Catégorie créée',
  CATEGORIE_MODIFIEE: 'Catégorie modifiée',
  CATEGORIE_SUPPRIMEE: 'Catégorie supprimée',
  PARAMETRE_MODIFIE: 'Paramètre modifié',
  ABSENCE_CREEE: 'Absence enregistrée',
  ABSENCE_MODIFIEE: 'Absence modifiée',
  ABSENCE_SUPPRIMEE: 'Absence supprimée',
  IA_REENTRAINEMENT_LANCE: 'Réentraînement IA lancé',
  IA_MODELE_DEPLOYE: 'Modèle IA déployé',
  JOURNAL_PURGE: "Purge du journal",
  TICKET_CREE: 'Ticket créé',
  TICKET_AFFECTATION: 'Ticket affecté',
  TICKET_DESAFFECTATION: 'Ticket désaffecté',
  TICKET_AFFECTATION_AUTO_SANS_SUITE: 'Affectation auto sans suite',
  TICKET_PRISE_EN_CHARGE: 'Ticket pris en charge',
  TICKET_STATUT: 'Statut modifié',
  TICKET_PRIORITE: 'Priorité modifiée',
  TICKET_CATEGORIE: 'Catégorie du ticket modifiée',
  TICKET_SATISFACTION: 'Satisfaction évaluée',
  TICKET_SUGGESTION: 'Suggestion IA demandée',
  TICKET_RESUME: 'Résumé IA demandé',
  TICKET_PIECE_JOINTE: 'Pièce jointe ajoutée',
};

export const LABEL_CIBLE: Record<string, string> = {
  TICKET: 'Ticket',
  UTILISATEUR: 'Compte',
  CATEGORIE: 'Catégorie',
  ABSENCE: 'Absence',
  MODELE_IA: 'Modèle IA',
  PARAMETRE: 'Paramètre',
};

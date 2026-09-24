import { apiRequest } from '../../lib/apiClient';

// Clients des écrans d'administration liés à l'affectation automatique (§6.2) :
// l'interrupteur MANUEL/AUTO et la gestion des absences. Toutes les routes exigent
// le rôle ADMINISTRATEUR côté serveur.

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres
// ─────────────────────────────────────────────────────────────────────────────

export type ModeAffectation = 'MANUEL' | 'AUTO';

export const CLE_MODE_AFFECTATION = 'AFFECTATION_MODE';

// Seuils de confiance du module IA (§6.5). Clés et bornes MIROIR de
// `backend/src/config/parametres.registre.ts`, qui reste la source de vérité : le serveur
// revalide tout. Ces constantes ne servent qu'à construire des contrôles cohérents.
export const CLE_SEUIL_AFFICHAGE = 'IA_SEUIL_AFFICHAGE';
export const CLE_SEUIL_ABSTENTION = 'IA_SEUIL_ABSTENTION';
// État du domaine — la porte est fermée. Ce n'est pas un nombre magique.
export const ABSTENTION_DESACTIVEE = 'DESACTIVE';
// 0 et 1 sont exclus : réglages dégénérés (jamais abstenir tout en payant un rerank / toujours abstenir).
export const BORNE_PORTE_MIN = 0.05;
export const BORNE_PORTE_MAX = 0.95;

export interface Parametre {
  cle: string;
  // Valeur MÉTIER, pas la chaîne stockée : le registre l'a déjà interprétée (nombre pour
  // les seuils, chaîne pour le mode d'affectation et pour « DESACTIVE »).
  valeur: string | number;
  description: string;
  // 'defaut' = aucune ligne en base (jamais réglé) ; 'stocke' = réglé par un humain ;
  // 'defaut_apres_erreur' = valeur en base illisible, repli appliqué.
  origine: 'stocke' | 'defaut' | 'defaut_apres_erreur';
  dateMaj: string | null;
  majParId: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Absences
// ─────────────────────────────────────────────────────────────────────────────

export const MOTIFS_ABSENCE = ['CONGE', 'MALADIE', 'FORMATION', 'AUTRE'] as const;
export type MotifAbsence = (typeof MOTIFS_ABSENCE)[number];

export const LABEL_MOTIF: Record<MotifAbsence, string> = {
  CONGE: 'Congé',
  MALADIE: 'Maladie',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
};

export type StatutAbsence = 'EN_COURS' | 'A_VENIR' | 'PASSEE';
export type FiltrePeriode = 'EN_COURS' | 'A_VENIR' | 'PASSEES' | 'TOUTES';

interface PersonneCourte {
  id: number;
  prenom: string;
  nom: string;
}

export interface Absence {
  id: number;
  technicienId: number;
  technicien: PersonneCourte;
  // Jours calendaires « YYYY-MM-DD », bornes incluses.
  dateDebut: string;
  dateFin: string;
  dureeJours: number;
  // Calculé par le serveur à partir du jour courant, jamais stocké.
  statut: StatutAbsence;
  motif: MotifAbsence;
  commentaire: string | null;
  creePar: PersonneCourte;
  dateCreation: string;
}

export interface SaisieAbsence {
  technicienId: number;
  dateDebut: string;
  dateFin: string;
  motif: MotifAbsence;
  commentaire?: string;
}

export const administrationApi = {
  parametres: (token: string) => apiRequest<{ parametres: Parametre[] }>('/parametres', { token }),

  reglerParametre: (cle: string, valeur: string, token: string) =>
    apiRequest<{ parametres: Parametre[] }>('/parametres', {
      method: 'PATCH',
      body: { cle, valeur },
      token,
    }),

  absences: (periode: FiltrePeriode, token: string) =>
    apiRequest<{ absences: Absence[] }>(`/absences?periode=${periode}`, { token }),

  // Un chevauchement remonte en 409 : `apiRequest` le transforme en ApiError, dont le
  // message est celui du serveur (il cite les dates de l'absence en conflit).
  creerAbsence: (saisie: SaisieAbsence, token: string) =>
    apiRequest<{ absence: Absence }>('/absences', { method: 'POST', body: saisie, token }),

  modifierAbsence: (id: number, saisie: Omit<SaisieAbsence, 'technicienId'>, token: string) =>
    apiRequest<{ absence: Absence }>(`/absences/${id}`, { method: 'PATCH', body: saisie, token }),

  supprimerAbsence: (id: number, token: string) =>
    apiRequest<void>(`/absences/${id}`, { method: 'DELETE', token }),

  // Remplace INTÉGRALEMENT les spécialités d'un technicien (l'interface envoie l'état
  // complet des cases cochées, pas un delta). Un tableau vide est valide.
  definirSpecialites: (id: number, categorieIds: number[], token: string) =>
    apiRequest<{ specialites: number[] }>(`/utilisateurs/${id}/specialites`, {
      method: 'PUT',
      body: { categorieIds },
      token,
    }),
};

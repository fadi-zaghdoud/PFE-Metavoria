export type Role = 'EMPLOYE' | 'TECHNICIEN' | 'ADMINISTRATEUR';

// EN_ATTENTE : compte invité n'ayant pas encore choisi son mot de passe.
export type StatutCompte = 'EN_ATTENTE' | 'ACTIF' | 'DESACTIVE';

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  service: string | null;
  poste: string | null;
  actif: boolean;
  statutCompte: StatutCompte;
  dateCreation: string;
  // Categories couvertes par ce technicien (affectation automatique §6.2). Vide pour les
  // autres roles. Absent des reponses anterieures a l'ajout des specialites.
  specialites?: number[];
  // Date de fin de l'absence EN COURS (« YYYY-MM-DD »), ou null. Le MOTIF n'est jamais
  // expose ici : cette liste sert aussi a choisir un technicien, et MALADIE est une
  // donnee de sante. Il n'apparait que sur la page Absences, reservee a l'administrateur.
  absenceJusquau?: string | null;
}

export interface InscriptionPayload {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  service?: string;
  poste?: string;
}

export interface ConnexionPayload {
  email: string;
  motDePasse: string;
}

export interface AuthResponse {
  utilisateur: Utilisateur;
  token: string;
}

export interface MiseAJourProfilPayload {
  nom?: string;
  prenom?: string;
  service?: string;
  poste?: string;
}

export interface ChangementMotDePassePayload {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
}

export interface DemandeReinitialisationPayload {
  email: string;
}

export interface VerificationCodePayload {
  email: string;
  code: string;
}

export interface ReinitialisationPayload {
  email: string;
  code: string;
  nouveauMotDePasse: string;
}

export interface FiltresUtilisateurs {
  role?: Role;
  service?: string;
  actif?: boolean;
}

export interface InvitationPayload {
  nom: string;
  prenom: string;
  email: string;
  service?: string;
  poste?: string;
  role: Role;
}

export interface InvitationInfo {
  prenom: string;
  email: string;
}

export interface ActivationComptePayload {
  token: string;
  motDePasse: string;
}

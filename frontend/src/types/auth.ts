export type Role = 'EMPLOYE' | 'TECHNICIEN' | 'ADMINISTRATEUR';

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  service: string | null;
  poste: string | null;
  dateCreation: string;
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

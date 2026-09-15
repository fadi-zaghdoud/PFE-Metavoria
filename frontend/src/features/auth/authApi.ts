import { apiRequest } from '../../lib/apiClient';
import type {
  ActivationComptePayload,
  AuthResponse,
  ChangementMotDePassePayload,
  ConnexionPayload,
  DemandeReinitialisationPayload,
  InscriptionPayload,
  InvitationInfo,
  MiseAJourProfilPayload,
  ReinitialisationPayload,
  Utilisateur,
  VerificationCodePayload,
} from '../../types/auth';

export const authApi = {
  inscrire: (payload: InscriptionPayload) =>
    apiRequest<AuthResponse>('/auth/inscription', { method: 'POST', body: payload }),

  connecter: (payload: ConnexionPayload) =>
    apiRequest<AuthResponse>('/auth/connexion', { method: 'POST', body: payload }),

  mettreAJourProfil: (payload: MiseAJourProfilPayload, token: string) =>
    apiRequest<{ utilisateur: Utilisateur }>('/auth/moi', { method: 'PATCH', body: payload, token }),

  // Photo de profil — multipart via FormData (champ `photo`), même patron que l'upload
  // d'une pièce jointe. Les deux renvoient l'utilisateur complet à jour, à pousser dans
  // le store pour que le sidebar se rafraîchisse immédiatement.
  televerserPhoto: (fichier: File, token: string) => {
    const form = new FormData();
    form.append('photo', fichier);
    return apiRequest<{ utilisateur: Utilisateur }>('/auth/moi/photo', {
      method: 'POST',
      body: form,
      token,
    });
  },

  supprimerPhoto: (token: string) =>
    apiRequest<{ utilisateur: Utilisateur }>('/auth/moi/photo', { method: 'DELETE', token }),

  changerMotDePasse: (payload: ChangementMotDePassePayload, token: string) =>
    apiRequest<{ message: string }>('/auth/moi/mot-de-passe', { method: 'PATCH', body: payload, token }),

  demanderCodeReinitialisation: (payload: DemandeReinitialisationPayload) =>
    apiRequest<{ message: string }>('/auth/mot-de-passe-oublie', { method: 'POST', body: payload }),

  verifierCode: (payload: VerificationCodePayload) =>
    apiRequest<{ message: string }>('/auth/verifier-code', { method: 'POST', body: payload }),

  reinitialiserMotDePasse: (payload: ReinitialisationPayload) =>
    apiRequest<{ message: string }>('/auth/reinitialiser-mot-de-passe', { method: 'POST', body: payload }),

  validerInvitation: (token: string) =>
    apiRequest<{ invitation: InvitationInfo }>(`/auth/invitation/${token}`),

  activerCompte: (payload: ActivationComptePayload) =>
    apiRequest<AuthResponse>('/auth/activer-compte', { method: 'POST', body: payload }),

  // Révoque le refresh token côté serveur et efface le cookie (best-effort).
  deconnexion: () => apiRequest<void>('/auth/deconnexion', { method: 'POST' }),
};

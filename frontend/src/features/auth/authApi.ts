import { apiRequest } from '../../lib/apiClient';
import type { AuthResponse, ConnexionPayload, InscriptionPayload } from '../../types/auth';

export const authApi = {
  inscrire: (payload: InscriptionPayload) =>
    apiRequest<AuthResponse>('/auth/inscription', { method: 'POST', body: payload }),

  connecter: (payload: ConnexionPayload) =>
    apiRequest<AuthResponse>('/auth/connexion', { method: 'POST', body: payload }),
};

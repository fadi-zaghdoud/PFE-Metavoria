import { apiRequest } from '../../lib/apiClient';
import type { FiltresUtilisateurs, InvitationPayload, Role, Utilisateur } from '../../types/auth';

function buildQueryString(filtres: FiltresUtilisateurs): string {
  const params = new URLSearchParams();
  if (filtres.role) params.set('role', filtres.role);
  if (filtres.service) params.set('service', filtres.service);
  if (filtres.actif !== undefined) params.set('actif', String(filtres.actif));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const utilisateursApi = {
  lister: (filtres: FiltresUtilisateurs, token: string) =>
    apiRequest<{ utilisateurs: Utilisateur[] }>(`/utilisateurs${buildQueryString(filtres)}`, { token }),

  changerRole: (id: number, role: Role, token: string) =>
    apiRequest<{ utilisateur: Utilisateur }>(`/utilisateurs/${id}/role`, {
      method: 'PATCH',
      body: { role },
      token,
    }),

  changerStatutActif: (id: number, actif: boolean, token: string) =>
    apiRequest<{ utilisateur: Utilisateur }>(`/utilisateurs/${id}/statut`, {
      method: 'PATCH',
      body: { actif },
      token,
    }),

  inviter: (payload: InvitationPayload, token: string) =>
    apiRequest<{ utilisateur: Utilisateur; message: string }>('/utilisateurs/inviter', {
      method: 'POST',
      body: payload,
      token,
    }),

  renvoyerInvitation: (id: number, token: string) =>
    apiRequest<{ utilisateur: Utilisateur; message: string }>(`/utilisateurs/${id}/renvoyer-invitation`, {
      method: 'POST',
      token,
    }),
};

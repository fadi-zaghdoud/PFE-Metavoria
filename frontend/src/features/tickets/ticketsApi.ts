import { apiRequest } from '../../lib/apiClient';
import type {
  Categorie,
  Commentaire,
  CreerTicketPayload,
  FiltresTickets,
  PrioriteTicket,
  StatistiquesTickets,
  StatutTicket,
  TicketDetail,
  TicketResume,
} from '../../types/ticket';

function buildQueryString(filtres: FiltresTickets): string {
  const params = new URLSearchParams();
  if (filtres.statut) params.set('statut', filtres.statut);
  if (filtres.priorite) params.set('priorite', filtres.priorite);
  if (filtres.categorieId) params.set('categorieId', String(filtres.categorieId));
  if (filtres.technicienId) params.set('technicienId', String(filtres.technicienId));
  if (filtres.nonAssignes) params.set('nonAssignes', 'true');
  if (filtres.q) params.set('q', filtres.q);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const ticketsApi = {
  lister: (filtres: FiltresTickets, token: string) =>
    apiRequest<{ tickets: TicketResume[] }>(`/tickets${buildQueryString(filtres)}`, { token }),

  detail: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}`, { token }),

  creer: (payload: CreerTicketPayload, token: string) =>
    apiRequest<{ ticket: TicketDetail }>('/tickets', { method: 'POST', body: payload, token }),

  changerStatut: (id: number, statut: StatutTicket, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/statut`, {
      method: 'PATCH',
      body: { statut },
      token,
    }),

  changerPriorite: (id: number, priorite: PrioriteTicket, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/priorite`, {
      method: 'PATCH',
      body: { priorite },
      token,
    }),

  affecter: (id: number, technicienId: number | null, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/affectation`, {
      method: 'PATCH',
      body: { technicienId },
      token,
    }),

  commenter: (id: number, contenu: string, token: string) =>
    apiRequest<{ commentaire: Commentaire }>(`/tickets/${id}/commentaires`, {
      method: 'POST',
      body: { contenu },
      token,
    }),

  evaluerSatisfaction: (id: number, note: number, commentaire: string | undefined, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/satisfaction`, {
      method: 'POST',
      body: { note, commentaire },
      token,
    }),

  statistiques: (token: string) => apiRequest<StatistiquesTickets>('/tickets/statistiques', { token }),

  listerCategories: (token: string) =>
    apiRequest<{ categories: Categorie[] }>('/categories', { token }),
};

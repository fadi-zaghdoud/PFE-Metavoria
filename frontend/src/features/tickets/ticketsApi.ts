import { apiRequest } from '../../lib/apiClient';
import type {
  Categorie,
  Commentaire,
  CreerTicketPayload,
  FiltresStatistiques,
  FiltresTickets,
  PieceJointe,
  PrioriteTicket,
  StatistiquesTickets,
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

  // Transitions du cycle de vie (voir ticket.service.ts) — corps vide, l'action
  // est portée par l'URL et l'acteur (contrôle des droits côté serveur).
  prendreEnCharge: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/prise-en-charge`, { method: 'POST', token }),

  resoudre: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/resolution`, { method: 'POST', token }),

  cloturer: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/cloture`, { method: 'POST', token }),

  changerPriorite: (id: number, priorite: PrioriteTicket, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/priorite`, {
      method: 'PATCH',
      body: { priorite },
      token,
    }),

  // Correction de la catégorie (socle du flywheel J9).
  changerCategorie: (id: number, categorieId: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/categorie`, {
      method: 'PATCH',
      body: { categorieId },
      token,
    }),

  // Demande d'une suggestion RAG (Greffe 2) — répond 202 immédiat, la génération est
  // asynchrone ; l'UI sonde ensuite le détail jusqu'à PRETE/ECHEC.
  demanderSuggestion: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/suggestion`, { method: 'POST', token }),

  // Demande d'un résumé du fil (J8) — même mécanique async (202 immédiat + polling).
  demanderResume: (id: number, token: string) =>
    apiRequest<{ ticket: TicketDetail }>(`/tickets/${id}/resume`, { method: 'POST', token }),

  // Upload d'une pièce jointe (J8bis) — multipart via FormData (champ `fichier`).
  uploaderPieceJointe: (id: number, fichier: File, token: string) => {
    const form = new FormData();
    form.append('fichier', fichier);
    return apiRequest<{ pieceJointe: PieceJointe }>(`/tickets/${id}/pieces-jointes`, {
      method: 'POST',
      body: form,
      token,
    });
  },

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

  statistiques: (filtres: FiltresStatistiques, token: string) => {
    const params = new URLSearchParams();
    if (filtres.dateDebut) params.set('dateDebut', filtres.dateDebut);
    if (filtres.dateFin) params.set('dateFin', filtres.dateFin);
    if (filtres.technicienId) params.set('technicienId', String(filtres.technicienId));
    if (filtres.categorieId) params.set('categorieId', String(filtres.categorieId));
    if (filtres.service) params.set('service', filtres.service);
    const query = params.toString();
    const suffixe = query ? `?${query}` : '';
    return apiRequest<StatistiquesTickets>(`/tickets/statistiques${suffixe}`, { token });
  },

  listerCategories: (token: string) =>
    apiRequest<{ categories: Categorie[] }>('/categories', { token }),
};

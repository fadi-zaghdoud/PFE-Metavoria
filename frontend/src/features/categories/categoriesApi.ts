import { apiRequest } from '../../lib/apiClient';
import type { Categorie, CategorieAdmin } from '../../types/ticket';

// CRUD des catégories (Phase A) — réservé à l'administrateur côté serveur.
// `listerAdministration` renvoie aussi `modeleDisponible` : à false (IA injoignable), les
// statuts valent INDETERMINE et le serveur refuse renommage/suppression (fail-safe 503).
export const categoriesApi = {
  listerAdministration: (token: string) =>
    apiRequest<{ modeleDisponible: boolean; categories: CategorieAdmin[] }>(
      '/categories/administration',
      { token },
    ),

  creer: (payload: { nom: string; description?: string }, token: string) =>
    apiRequest<{ categorie: CategorieAdmin }>('/categories', {
      method: 'POST',
      body: payload,
      token,
    }),

  mettreAJour: (id: number, payload: { nom?: string; description?: string }, token: string) =>
    apiRequest<{ categorie: Categorie }>(`/categories/${id}`, {
      method: 'PATCH',
      body: payload,
      token,
    }),

  // Réponse 204 sans corps — `apiRequest` la traite proprement (json() → null).
  supprimer: (id: number, token: string) =>
    apiRequest<void>(`/categories/${id}`, { method: 'DELETE', token }),
};

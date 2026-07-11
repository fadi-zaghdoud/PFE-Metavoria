import type { Response } from 'express';

// Registre en mémoire des connexions SSE (Server-Sent Events) ouvertes, indexées
// par utilisateur. Permet de pousser une notification en temps réel vers tous les
// onglets/appareils d'un utilisateur connecté.
//
// Suffisant pour un déploiement mono-instance (cas du PFE). Une mise à l'échelle
// multi-instances nécessiterait un bus externe (ex. Redis pub/sub) — hors périmètre.
const connexions = new Map<number, Set<Response>>();

export const sseHub = {
  ajouter(utilisateurId: number, res: Response) {
    let set = connexions.get(utilisateurId);
    if (!set) {
      set = new Set();
      connexions.set(utilisateurId, set);
    }
    set.add(res);
  },

  retirer(utilisateurId: number, res: Response) {
    const set = connexions.get(utilisateurId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) connexions.delete(utilisateurId);
  },

  // Diffuse un événement à toutes les connexions ouvertes d'un utilisateur.
  // Une écriture qui échoue (connexion morte) est silencieusement retirée.
  publier(utilisateurId: number, evenement: string, donnee: unknown) {
    const set = connexions.get(utilisateurId);
    if (!set) return;
    const charge = `event: ${evenement}\ndata: ${JSON.stringify(donnee)}\n\n`;
    for (const res of set) {
      try {
        res.write(charge);
      } catch {
        set.delete(res);
      }
    }
  },
};

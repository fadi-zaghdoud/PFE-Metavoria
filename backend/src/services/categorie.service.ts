import { categorieRepository } from '../repositories/categorie.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { iaService } from './ia.service';
import { env } from '../config/env';
import { deriverStatut } from './categorie.statut';

export const categorieService = {
  lister() {
    return categorieRepository.findMany();
  },

  // Vue ADMIN (Phase A) : chaque catégorie enrichie de son compteur de labels validés (Étape 2)
  // et de son STATUT calculé (Étape 3 = classes du modèle actif [Étape 1] + compteur + seuil).
  // `modeleDisponible=false` (IA injoignable/désactivée) → tous les statuts passent INDETERMINE.
  async listerAdministration() {
    const [categories, compte, modele] = await Promise.all([
      categorieRepository.findMany(),
      ticketRepository.compterLabelsValidesParCategorie(),
      iaService.classesModeleActif(),
    ]);
    return {
      modeleDisponible: modele.modeleDisponible,
      categories: categories.map((c) => {
        const nLabelsValides = compte.get(c.id) ?? 0;
        return {
          id: c.id,
          nom: c.nom,
          description: c.description,
          dateCreation: c.dateCreation,
          nLabelsValides,
          statut: deriverStatut(c.nom, nLabelsValides, modele.classes, env.SEUIL_EXEMPLES_APPRENABLE),
        };
      }),
    };
  },
};

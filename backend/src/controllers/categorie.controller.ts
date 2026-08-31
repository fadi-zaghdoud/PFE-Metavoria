import type { Request, Response } from 'express';
import { categorieService } from '../services/categorie.service';

export const categorieController = {
  async lister(_req: Request, res: Response) {
    const categories = await categorieService.lister();
    res.status(200).json({ categories });
  },

  // Vue ADMIN : catégories + compteur de labels validés + statut calculé (Phase A).
  async listerAdministration(_req: Request, res: Response) {
    const resultat = await categorieService.listerAdministration();
    res.status(200).json(resultat);
  },
};

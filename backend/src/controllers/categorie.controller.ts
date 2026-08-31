import type { Request, Response } from 'express';
import { categorieService } from '../services/categorie.service';
import { creerCategorieSchema, majCategorieSchema } from '../validators/categorie.validator';
import { ValidationError } from '../utils/AppError';

function parseIdParam(rawId: string | string[] | undefined): number {
  const id = Number(typeof rawId === 'string' ? rawId : Number.NaN);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('Identifiant de catégorie invalide');
  return id;
}

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

  async creer(req: Request, res: Response) {
    const input = creerCategorieSchema.parse(req.body);
    const categorie = await categorieService.creer(input);
    res.status(201).json({ categorie });
  },

  async mettreAJour(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const input = majCategorieSchema.parse(req.body);
    const categorie = await categorieService.mettreAJour(id, input);
    res.status(200).json({ categorie });
  },

  async supprimer(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    await categorieService.supprimer(id);
    res.status(204).send();
  },
};

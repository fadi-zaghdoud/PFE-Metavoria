import type { Request, Response } from 'express';
import { parametreService } from '../services/parametre.service';
import { UnauthorizedError } from '../utils/AppError';
import { z } from 'zod';

// La validation FINE (clé connue, valeur du domaine) appartient au registre : le schéma
// ne fait qu'assurer la forme du corps de requête.
const majParametreSchema = z.object({
  cle: z.string().trim().min(1, 'Clé requise'),
  valeur: z.string(),
});

export const parametreController = {
  async lister(_req: Request, res: Response) {
    const parametres = await parametreService.lireTous();
    res.status(200).json({ parametres });
  },

  // Réglages d'affichage, lisibles par tout utilisateur authentifié (cf. la route).
  async affichage(_req: Request, res: Response) {
    res.status(200).json(await parametreService.lireAffichage());
  },

  async mettreAJour(req: Request, res: Response) {
    if (!req.user) throw new UnauthorizedError();
    const { cle, valeur } = majParametreSchema.parse(req.body);
    await parametreService.ecrire(req.user.sub, cle, valeur);
    res.status(200).json({ parametres: await parametreService.lireTous() });
  },
};

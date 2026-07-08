import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { connexionSchema, inscriptionSchema } from '../validators/auth.validator';
import { UnauthorizedError } from '../utils/AppError';

export const authController = {
  async inscrire(req: Request, res: Response) {
    const input = inscriptionSchema.parse(req.body);
    const result = await authService.inscrire(input);
    res.status(201).json(result);
  },

  async connecter(req: Request, res: Response) {
    const input = connexionSchema.parse(req.body);
    const result = await authService.connecter(input);
    res.status(200).json(result);
  },

  async profil(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const utilisateur = await authService.profil(req.user.sub);
    res.status(200).json({ utilisateur });
  },
};

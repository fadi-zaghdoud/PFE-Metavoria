import { Router } from 'express';
import { parametreController } from '../controllers/parametre.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const parametresRouter = Router();

parametresRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

parametresRouter.get('/', asyncHandler(parametreController.lister));
parametresRouter.patch('/', asyncHandler(parametreController.mettreAJour));

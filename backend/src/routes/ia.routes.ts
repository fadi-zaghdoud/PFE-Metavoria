import { Router } from 'express';
import { iaController } from '../controllers/ia.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const iaRouter = Router();

// Flywheel (Greffe 3) — réservé à l'ADMINISTRATEUR : réentraîner / déployer le classifieur.
// Le réentraînement remplace un modèle de production : action à privilège maximal.
iaRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

iaRouter.post('/reentrainer', asyncHandler(iaController.reentrainer));
iaRouter.get('/flywheel', asyncHandler(iaController.flywheel));
iaRouter.post('/deployer', asyncHandler(iaController.deployer));

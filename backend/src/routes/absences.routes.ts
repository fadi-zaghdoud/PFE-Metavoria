import { Router } from 'express';
import { absenceController } from '../controllers/absence.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const absencesRouter = Router();

// Administration seule : une absence decide qui peut recevoir des tickets. L'auto-declaration
// par le technicien reste une evolution possible, soumise a validation — non livree.
absencesRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

absencesRouter.get('/', asyncHandler(absenceController.lister));
absencesRouter.post('/', asyncHandler(absenceController.creer));
absencesRouter.patch('/:id', asyncHandler(absenceController.mettreAJour));
absencesRouter.delete('/:id', asyncHandler(absenceController.supprimer));

import { Router } from 'express';
import { utilisateurController } from '../controllers/utilisateur.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const utilisateursRouter = Router();

utilisateursRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

utilisateursRouter.get('/', asyncHandler(utilisateurController.lister));
utilisateursRouter.post('/inviter', asyncHandler(utilisateurController.inviter));
utilisateursRouter.patch('/:id/role', asyncHandler(utilisateurController.changerRole));
utilisateursRouter.patch('/:id/statut', asyncHandler(utilisateurController.changerStatutActif));
// Specialites technicien <-> categories, socle de l'affectation automatique (§6.2).
utilisateursRouter.put('/:id/specialites', asyncHandler(utilisateurController.definirSpecialites));
utilisateursRouter.post('/:id/renvoyer-invitation', asyncHandler(utilisateurController.renvoyerInvitation));

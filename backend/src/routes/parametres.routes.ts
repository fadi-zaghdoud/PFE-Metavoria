import { Router } from 'express';
import { parametreController } from '../controllers/parametre.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const parametresRouter = Router();

// Lecture ÉTROITE — tout utilisateur AUTHENTIFIÉ, quel que soit son rôle. Déclarée AVANT
// la garde d'administration ci-dessous, qui s'applique à tout ce qui suit : Express
// parcourt la pile dans l'ordre de déclaration, cette route n'atteint donc jamais le
// `requireRole`. Motif : le panneau de suggestion est visible du technicien assigné, qui
// a besoin du seuil d'affichage sans avoir accès au registre complet. On expose la seule
// valeur nécessaire au rendu plutôt que d'élargir les droits sur `/parametres`.
parametresRouter.get('/affichage', requireAuth, asyncHandler(parametreController.affichage));

parametresRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

parametresRouter.get('/', asyncHandler(parametreController.lister));
parametresRouter.patch('/', asyncHandler(parametreController.mettreAJour));

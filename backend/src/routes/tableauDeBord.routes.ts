import { Router } from 'express';
import { tableauDeBordController } from '../controllers/tableauDeBord.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const tableauDeBordRouter = Router();

// Points d'accès du tableau de bord, en LECTURE SEULE : des agrégations SQL, aucune
// écriture. Tout utilisateur authentifié ; le périmètre suit le rôle (un employé ne voit que
// ses tickets), comme /tickets/statistiques, qui reste inchangé.
tableauDeBordRouter.use(requireAuth);

tableauDeBordRouter.get('/indicateurs', asyncHandler(tableauDeBordController.indicateurs));
tableauDeBordRouter.get('/tendance', asyncHandler(tableauDeBordController.tendance));

import { Router } from 'express';
import { tableauDeBordController } from '../controllers/tableauDeBord.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const tableauDeBordRouter = Router();

// Points d'accès du tableau de bord, en LECTURE SEULE : des agrégations SQL, aucune
// écriture. Tout utilisateur authentifié ; le périmètre suit le rôle (un employé ne voit que
// ses tickets), comme /tickets/statistiques, qui reste inchangé.
tableauDeBordRouter.use(requireAuth);

tableauDeBordRouter.get('/indicateurs', asyncHandler(tableauDeBordController.indicateurs));
tableauDeBordRouter.get('/tendance', asyncHandler(tableauDeBordController.tendance));
// Performance du module IA : le support seul (technicien, administrateur) — un employé n'a
// pas à juger les propositions faites sur les tickets des autres.
tableauDeBordRouter.get(
  '/ia',
  requireRole('TECHNICIEN', 'ADMINISTRATEUR'),
  asyncHandler(tableauDeBordController.ia),
);
// « À traiter » : le présent, sans période ; un employé y voit ses tickets ouverts.
tableauDeBordRouter.get('/a-traiter', asyncHandler(tableauDeBordController.aTraiter));
// Activité des techniciens : le support seul. L'administrateur voit l'équipe, un technicien
// sa seule ligne (le service l'impose) ; un employé n'y a pas accès.
tableauDeBordRouter.get(
  '/techniciens',
  requireRole('TECHNICIEN', 'ADMINISTRATEUR'),
  asyncHandler(tableauDeBordController.techniciens),
);

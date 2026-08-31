import { Router } from 'express';
import { categorieController } from '../controllers/categorie.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

// Liste simple (tous rôles) — alimente les listes déroulantes (création de ticket, filtres).
categoriesRouter.get('/', asyncHandler(categorieController.lister));

// Vue ADMIN enrichie (compteurs + statut du cycle de vie, Phase A) — segment fixe, réservé admin.
categoriesRouter.get(
  '/administration',
  requireRole('ADMINISTRATEUR'),
  asyncHandler(categorieController.listerAdministration),
);

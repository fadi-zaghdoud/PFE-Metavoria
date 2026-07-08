import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const adminRouter = Router();

// Exemple de route protégée par RBAC — à remplacer par les vraies routes
// d'administration (gestion utilisateurs, catégories...) dans une itération suivante.
adminRouter.get('/ping', requireAuth, requireRole('ADMINISTRATEUR'), (_req, res) => {
  res.json({ message: 'Accès administrateur confirmé' });
});

import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const auditRouter = Router();

// Le journal contient des adresses IP et retrace l'activite de chacun : sa consultation
// est reservee a l'ADMINISTRATION, comme la finalite du traitement l'exige.
auditRouter.use(requireAuth, requireRole('ADMINISTRATEUR'));

auditRouter.get('/', asyncHandler(auditController.consulter));

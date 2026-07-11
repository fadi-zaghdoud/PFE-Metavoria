import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const notificationsRouter = Router();

// Flux SSE : authentification par token en query, déclaré AVANT le requireAuth
// global du routeur (EventSource ne peut pas envoyer d'en-tête Authorization).
notificationsRouter.get('/flux', asyncHandler(notificationController.flux));

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', asyncHandler(notificationController.lister));
// Déclaré avant /:id/lu : « tout-lu » est un segment fixe, pas un identifiant.
notificationsRouter.patch('/tout-lu', asyncHandler(notificationController.marquerToutLu));
notificationsRouter.patch('/:id/lu', asyncHandler(notificationController.marquerLu));

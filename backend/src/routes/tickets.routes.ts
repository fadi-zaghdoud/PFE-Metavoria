import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const ticketsRouter = Router();

// Toutes les routes tickets exigent une authentification ; le contrôle fin
// (rôle, propriété du ticket) est appliqué dans la couche service.
ticketsRouter.use(requireAuth);

ticketsRouter.get('/', asyncHandler(ticketController.lister));
ticketsRouter.post('/', asyncHandler(ticketController.creer));
// Déclaré avant /:id : « statistiques » est un segment fixe, pas un identifiant.
ticketsRouter.get('/statistiques', asyncHandler(ticketController.statistiques));
ticketsRouter.get('/:id', asyncHandler(ticketController.detail));
ticketsRouter.patch('/:id/statut', asyncHandler(ticketController.changerStatut));
ticketsRouter.patch('/:id/priorite', asyncHandler(ticketController.changerPriorite));
ticketsRouter.patch('/:id/affectation', asyncHandler(ticketController.affecter));
ticketsRouter.post('/:id/commentaires', asyncHandler(ticketController.commenter));
ticketsRouter.post('/:id/satisfaction', asyncHandler(ticketController.evaluerSatisfaction));

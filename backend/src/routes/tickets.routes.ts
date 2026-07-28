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
// Transitions du cycle de vie — une action nommée par arête (voir ticket.service.ts).
ticketsRouter.patch('/:id/affectation', asyncHandler(ticketController.affecter)); // admin : →EN_ATTENTE / désassign →NOUVEAU
ticketsRouter.post('/:id/prise-en-charge', asyncHandler(ticketController.prendreEnCharge)); // tech. assigné : EN_ATTENTE→EN_COURS
ticketsRouter.post('/:id/resolution', asyncHandler(ticketController.resoudre)); // tech. assigné : EN_COURS→RESOLU
ticketsRouter.post('/:id/satisfaction', asyncHandler(ticketController.evaluerSatisfaction)); // demandeur : valide →CLOTURE
ticketsRouter.post('/:id/cloture', asyncHandler(ticketController.cloturer)); // admin : clôture directe →CLOTURE
// Modifications hors cycle de vie.
ticketsRouter.patch('/:id/priorite', asyncHandler(ticketController.changerPriorite));
ticketsRouter.patch('/:id/categorie', asyncHandler(ticketController.changerCategorie)); // tech. assigné/admin : recatégorisation (flywheel)
ticketsRouter.post('/:id/commentaires', asyncHandler(ticketController.commenter));

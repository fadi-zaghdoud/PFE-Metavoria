import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

authRouter.post('/inscription', asyncHandler(authController.inscrire));
authRouter.post('/connexion', asyncHandler(authController.connecter));
authRouter.get('/moi', requireAuth, asyncHandler(authController.profil));

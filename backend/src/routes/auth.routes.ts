import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  limiteurConnexion,
  limiteurDemandeCode,
  limiteurInscription,
  limiteurVerificationCode,
} from '../middlewares/rateLimit.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

authRouter.post('/inscription', limiteurInscription, asyncHandler(authController.inscrire));
authRouter.post('/connexion', limiteurConnexion, asyncHandler(authController.connecter));

// Flux de réinitialisation par code OTP (3 étapes)
authRouter.post(
  '/mot-de-passe-oublie',
  limiteurDemandeCode,
  asyncHandler(authController.demanderCodeReinitialisation),
);
authRouter.post(
  '/verifier-code',
  limiteurVerificationCode,
  asyncHandler(authController.verifierCodeReinitialisation),
);
authRouter.post(
  '/reinitialiser-mot-de-passe',
  limiteurVerificationCode,
  asyncHandler(authController.reinitialiserMotDePasse),
);

// Activation d'un compte invité par un administrateur (page publique)
authRouter.get(
  '/invitation/:token',
  limiteurVerificationCode,
  asyncHandler(authController.validerInvitation),
);
authRouter.post(
  '/activer-compte',
  limiteurVerificationCode,
  asyncHandler(authController.activerCompte),
);

authRouter.get('/moi', requireAuth, asyncHandler(authController.profil));
authRouter.patch('/moi', requireAuth, asyncHandler(authController.mettreAJourProfil));
authRouter.patch('/moi/mot-de-passe', requireAuth, asyncHandler(authController.changerMotDePasse));

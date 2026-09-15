import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import {
  activationCompteSchema,
  changementMotDePasseSchema,
  connexionSchema,
  demandeReinitialisationSchema,
  inscriptionSchema,
  miseAJourProfilSchema,
  reinitialisationSchema,
  verificationCodeSchema,
} from '../validators/auth.validator';
import { UnauthorizedError, ValidationError } from '../utils/AppError';
import { effacerCookieRefresh, lireCookieRefresh, poserCookieRefresh } from '../utils/cookies';

export const authController = {
  async inscrire(req: Request, res: Response) {
    const input = inscriptionSchema.parse(req.body);
    const { utilisateur, accessToken, refreshToken } = await authService.inscrire(input);
    poserCookieRefresh(res, refreshToken);
    // Le refresh token reste dans le cookie httpOnly ; le corps ne renvoie que
    // l'access token court (« token ») et l'utilisateur.
    res.status(201).json({ utilisateur, token: accessToken });
  },

  async connecter(req: Request, res: Response) {
    const input = connexionSchema.parse(req.body);
    const { utilisateur, accessToken, refreshToken } = await authService.connecter(input);
    poserCookieRefresh(res, refreshToken);
    res.status(200).json({ utilisateur, token: accessToken });
  },

  async profil(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const utilisateur = await authService.profil(req.user.sub);
    res.status(200).json({ utilisateur });
  },

  async mettreAJourProfil(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const input = miseAJourProfilSchema.parse(req.body);
    const utilisateur = await authService.mettreAJourProfil(req.user.sub, input);
    res.status(200).json({ utilisateur });
  },

  // Upload multipart (champ `photo`) — multer a rempli req.file en amont.
  async televerserPhoto(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!req.file) {
      throw new ValidationError('Image manquante ou format non supporté (PNG, JPG ou WEBP, ≤ 2 Mo)');
    }
    const utilisateur = await authService.televerserPhoto(req.user.sub, req.file);
    res.status(200).json({ utilisateur });
  },

  async supprimerPhoto(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const utilisateur = await authService.supprimerPhoto(req.user.sub);
    res.status(200).json({ utilisateur });
  },

  async changerMotDePasse(req: Request, res: Response) {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const input = changementMotDePasseSchema.parse(req.body);
    await authService.changerMotDePasse(req.user.sub, input);
    res.status(200).json({ message: 'Mot de passe mis à jour avec succès' });
  },

  async demanderCodeReinitialisation(req: Request, res: Response) {
    const input = demandeReinitialisationSchema.parse(req.body);
    await authService.demanderCodeReinitialisation(input.email);
    // Message générique (anti-énumération) : identique que le compte existe ou non.
    res.status(200).json({
      message: 'Si un compte existe pour cette adresse, un code de vérification vient d’être envoyé.',
    });
  },

  async verifierCodeReinitialisation(req: Request, res: Response) {
    const input = verificationCodeSchema.parse(req.body);
    await authService.verifierCodeReinitialisation(input.email, input.code);
    res.status(200).json({ message: 'Code vérifié' });
  },

  async reinitialiserMotDePasse(req: Request, res: Response) {
    const input = reinitialisationSchema.parse(req.body);
    await authService.reinitialiserMotDePasse(input.email, input.code, input.nouveauMotDePasse);
    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  },

  async validerInvitation(req: Request, res: Response) {
    const token = activationCompteSchema.shape.token.safeParse(req.params.token);
    if (!token.success) {
      throw new ValidationError("Lien d'invitation invalide");
    }
    const invitation = await authService.validerInvitation(token.data);
    res.status(200).json({ invitation });
  },

  async activerCompte(req: Request, res: Response) {
    const input = activationCompteSchema.parse(req.body);
    const { utilisateur, accessToken, refreshToken } = await authService.activerCompte(
      input.token,
      input.motDePasse,
    );
    poserCookieRefresh(res, refreshToken);
    res.status(200).json({ utilisateur, token: accessToken });
  },

  // Renouvelle l'access token à partir du refresh token (cookie httpOnly), avec
  // rotation du refresh token. Appelé silencieusement par le frontend.
  async rafraichir(req: Request, res: Response) {
    const refresh = lireCookieRefresh(req);
    if (!refresh) {
      throw new UnauthorizedError('Session absente — reconnectez-vous', 'TOKEN_INVALIDE');
    }
    const { utilisateur, accessToken, refreshToken } = await authService.rafraichir(refresh);
    poserCookieRefresh(res, refreshToken);
    res.status(200).json({ utilisateur, token: accessToken });
  },

  // Déconnexion : révoque le refresh token et efface le cookie.
  async deconnexion(req: Request, res: Response) {
    await authService.deconnecter(lireCookieRefresh(req));
    effacerCookieRefresh(res);
    res.status(204).send();
  },
};

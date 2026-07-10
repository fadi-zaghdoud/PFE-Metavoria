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

export const authController = {
  async inscrire(req: Request, res: Response) {
    const input = inscriptionSchema.parse(req.body);
    const result = await authService.inscrire(input);
    res.status(201).json(result);
  },

  async connecter(req: Request, res: Response) {
    const input = connexionSchema.parse(req.body);
    const result = await authService.connecter(input);
    res.status(200).json(result);
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
    res.status(200).json({ message: 'Code de vérification envoyé par e-mail' });
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
    const result = await authService.activerCompte(input.token, input.motDePasse);
    res.status(200).json(result);
  },
};

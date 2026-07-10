import type { Request, Response } from 'express';
import { utilisateurService } from '../services/utilisateur.service';
import {
  changerRoleSchema,
  changerStatutActifSchema,
  invitationSchema,
  listeUtilisateursQuerySchema,
} from '../validators/utilisateur.validator';
import { ValidationError } from '../utils/AppError';

function parseIdParam(rawId: string | string[] | undefined): number {
  const id = Number(typeof rawId === 'string' ? rawId : Number.NaN);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("Identifiant d'utilisateur invalide");
  }
  return id;
}

export const utilisateurController = {
  async lister(req: Request, res: Response) {
    const filtres = listeUtilisateursQuerySchema.parse(req.query);
    const utilisateurs = await utilisateurService.lister(filtres);
    res.status(200).json({ utilisateurs });
  },

  async changerRole(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const input = changerRoleSchema.parse(req.body);
    const utilisateur = await utilisateurService.changerRole(id, input.role);
    res.status(200).json({ utilisateur });
  },

  async changerStatutActif(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const input = changerStatutActifSchema.parse(req.body);
    const utilisateur = await utilisateurService.changerStatutActif(id, input.actif);
    res.status(200).json({ utilisateur });
  },

  async inviter(req: Request, res: Response) {
    const input = invitationSchema.parse(req.body);
    const utilisateur = await utilisateurService.inviter(input);
    res.status(201).json({ utilisateur, message: `Invitation envoyée à ${utilisateur.email}` });
  },

  async renvoyerInvitation(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const utilisateur = await utilisateurService.renvoyerInvitation(id);
    res.status(200).json({ utilisateur, message: `Invitation renvoyée à ${utilisateur.email}` });
  },
};

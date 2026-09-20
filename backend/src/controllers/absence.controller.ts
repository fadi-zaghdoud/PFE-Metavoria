import type { Request, Response } from 'express';
import { absenceService } from '../services/absence.service';
import {
  creerAbsenceSchema,
  filtreAbsencesSchema,
  majAbsenceSchema,
} from '../validators/absence.validator';
import { UnauthorizedError, ValidationError } from '../utils/AppError';

function acteurId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

function parseIdParam(rawId: string | string[] | undefined): number {
  const id = Number(typeof rawId === 'string' ? rawId : Number.NaN);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError("Identifiant d'absence invalide");
  return id;
}

export const absenceController = {
  async lister(req: Request, res: Response) {
    const filtres = filtreAbsencesSchema.parse(req.query);
    const absences = await absenceService.lister(filtres);
    res.status(200).json({ absences });
  },

  async creer(req: Request, res: Response) {
    const input = creerAbsenceSchema.parse(req.body);
    const absence = await absenceService.creer(acteurId(req), input);
    res.status(201).json({ absence });
  },

  async mettreAJour(req: Request, res: Response) {
    const input = majAbsenceSchema.parse(req.body);
    const absence = await absenceService.mettreAJour(acteurId(req), parseIdParam(req.params.id), input);
    res.status(200).json({ absence });
  },

  async supprimer(req: Request, res: Response) {
    await absenceService.supprimer(acteurId(req), parseIdParam(req.params.id));
    res.status(204).send();
  },
};

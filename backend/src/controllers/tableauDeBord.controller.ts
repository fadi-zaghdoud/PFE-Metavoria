import type { Request, Response } from 'express';
import { tableauDeBordService } from '../services/tableauDeBord.service';
import type { Acteur } from '../services/ticket.service';
import { tableauDeBordQuerySchema } from '../validators/tableauDeBord.validator';
import { UnauthorizedError } from '../utils/AppError';

function acteur(req: Request): Acteur {
  if (!req.user) throw new UnauthorizedError();
  return { id: req.user.sub, role: req.user.role };
}

export const tableauDeBordController = {
  async indicateurs(req: Request, res: Response) {
    const q = tableauDeBordQuerySchema.parse(req.query);
    res.status(200).json(await tableauDeBordService.indicateurs(acteur(req), q));
  },

  async tendance(req: Request, res: Response) {
    const q = tableauDeBordQuerySchema.parse(req.query);
    res.status(200).json(await tableauDeBordService.tendance(acteur(req), q));
  },

  async ia(req: Request, res: Response) {
    const q = tableauDeBordQuerySchema.parse(req.query);
    res.status(200).json(await tableauDeBordService.ia(acteur(req), q));
  },

  async aTraiter(req: Request, res: Response) {
    const q = tableauDeBordQuerySchema.parse(req.query);
    res.status(200).json(await tableauDeBordService.aTraiter(acteur(req), q));
  },
};

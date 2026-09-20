import type { Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { filtreAuditSchema } from '../validators/audit.validator';

export const auditController = {
  async consulter(req: Request, res: Response) {
    const filtres = filtreAuditSchema.parse(req.query);
    res.status(200).json(await auditService.consulter(filtres));
  },
};

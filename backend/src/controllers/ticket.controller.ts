import type { Request, Response } from 'express';
import { ticketService, type Acteur } from '../services/ticket.service';
import {
  affectationSchema,
  changerPrioriteSchema,
  changerStatutSchema,
  commentaireSchema,
  creerTicketSchema,
  listeTicketsQuerySchema,
  satisfactionSchema,
} from '../validators/ticket.validator';
import { UnauthorizedError, ValidationError } from '../utils/AppError';

function acteur(req: Request): Acteur {
  if (!req.user) throw new UnauthorizedError();
  return { id: req.user.sub, role: req.user.role };
}

function parseIdParam(rawId: string | string[] | undefined): number {
  const id = Number(typeof rawId === 'string' ? rawId : Number.NaN);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Identifiant de ticket invalide');
  }
  return id;
}

export const ticketController = {
  async lister(req: Request, res: Response) {
    const filtres = listeTicketsQuerySchema.parse(req.query);
    const tickets = await ticketService.lister(acteur(req), filtres);
    res.status(200).json({ tickets });
  },

  async creer(req: Request, res: Response) {
    const input = creerTicketSchema.parse(req.body);
    const ticket = await ticketService.creer(acteur(req), input);
    res.status(201).json({ ticket });
  },

  async detail(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.detail(acteur(req), id);
    res.status(200).json({ ticket });
  },

  async changerStatut(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { statut } = changerStatutSchema.parse(req.body);
    const ticket = await ticketService.changerStatut(acteur(req), id, statut);
    res.status(200).json({ ticket });
  },

  async changerPriorite(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { priorite } = changerPrioriteSchema.parse(req.body);
    const ticket = await ticketService.changerPriorite(acteur(req), id, priorite);
    res.status(200).json({ ticket });
  },

  async affecter(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { technicienId } = affectationSchema.parse(req.body);
    const ticket = await ticketService.affecter(acteur(req), id, technicienId);
    res.status(200).json({ ticket });
  },

  async commenter(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { contenu } = commentaireSchema.parse(req.body);
    const commentaire = await ticketService.commenter(acteur(req), id, contenu);
    res.status(201).json({ commentaire });
  },

  async evaluerSatisfaction(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { note, commentaire } = satisfactionSchema.parse(req.body);
    const ticket = await ticketService.evaluerSatisfaction(acteur(req), id, note, commentaire);
    res.status(200).json({ ticket });
  },

  async statistiques(req: Request, res: Response) {
    const stats = await ticketService.statistiques(acteur(req));
    res.status(200).json(stats);
  },
};

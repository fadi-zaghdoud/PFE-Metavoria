import type { Request, Response } from 'express';
import { ticketService, type Acteur } from '../services/ticket.service';
import {
  affectationSchema,
  changerCategorieSchema,
  changerPrioriteSchema,
  commentaireSchema,
  creerTicketSchema,
  listeTicketsQuerySchema,
  satisfactionSchema,
  statistiquesQuerySchema,
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

  async prendreEnCharge(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.prendreEnCharge(acteur(req), id);
    res.status(200).json({ ticket });
  },

  async resoudre(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.resoudre(acteur(req), id);
    res.status(200).json({ ticket });
  },

  async cloturer(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.cloturer(acteur(req), id);
    res.status(200).json({ ticket });
  },

  async changerCategorie(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const { categorieId } = changerCategorieSchema.parse(req.body);
    const ticket = await ticketService.changerCategorie(acteur(req), id, categorieId);
    res.status(200).json({ ticket });
  },

  // 202 Accepted : la génération RAG (15-30 s) part en arrière-plan ; on renvoie tout de
  // suite le ticket avec la ligne SOLUTION en EN_COURS (l'UI sonde ensuite jusqu'à PRETE).
  async demanderSuggestion(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.demanderSuggestion(acteur(req), id);
    res.status(202).json({ ticket });
  },

  // 202 Accepted : la génération du résumé (21-55 s) part en arrière-plan (ligne RESUME EN_COURS).
  async demanderResume(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    const ticket = await ticketService.demanderResume(acteur(req), id);
    res.status(202).json({ ticket });
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
    const filtres = statistiquesQuerySchema.parse(req.query);
    const stats = await ticketService.statistiques(acteur(req), filtres);
    res.status(200).json(stats);
  },
};

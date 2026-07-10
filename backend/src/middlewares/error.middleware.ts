import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` });
}

// Middleware d'erreur centralisé (4 paramètres = signature requise par Express).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Données invalides', details: z.flattenError(err).fieldErrors });
    return;
  }

  console.error('Erreur non gérée :', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}

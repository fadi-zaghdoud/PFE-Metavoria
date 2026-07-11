import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { notificationService } from '../services/notification.service';
import { sseHub } from '../utils/sseHub';
import { env } from '../config/env';
import type { JwtPayload } from '../middlewares/auth.middleware';
import { UnauthorizedError, ValidationError } from '../utils/AppError';

// Intervalle du commentaire keep-alive : maintient la connexion SSE ouverte
// à travers les proxies (nginx ferme une connexion inactive après ~60 s).
const PING_INTERVAL_MS = 25_000;

function userId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

function parseIdParam(rawId: string | string[] | undefined): number {
  const id = Number(typeof rawId === 'string' ? rawId : Number.NaN);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('Identifiant de notification invalide');
  }
  return id;
}

export const notificationController = {
  // Flux SSE temps réel. L'authentification se fait par un token en query car
  // l'API navigateur EventSource ne permet pas d'envoyer d'en-tête Authorization.
  async flux(req: Request, res: Response) {
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (!token) {
      throw new UnauthorizedError("Jeton d'authentification manquant", 'TOKEN_INVALIDE');
    }
    let utilisateurId: number;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
      utilisateurId = payload.sub;
    } catch {
      throw new UnauthorizedError('Votre session a expiré — reconnectez-vous', 'TOKEN_INVALIDE');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Demande à nginx de ne pas bufferiser ce flux (sinon les événements sont retenus).
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n'); // délai de reconnexion côté client
    res.write(': connecté\n\n');

    sseHub.ajouter(utilisateurId, res);

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        /* connexion fermée : le handler 'close' fait le ménage */
      }
    }, PING_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(ping);
      sseHub.retirer(utilisateurId, res);
    });
  },

  async lister(req: Request, res: Response) {
    const data = await notificationService.lister(userId(req));
    res.status(200).json(data);
  },

  async marquerLu(req: Request, res: Response) {
    const id = parseIdParam(req.params.id);
    await notificationService.marquerLu(userId(req), id);
    res.status(204).send();
  },

  async marquerToutLu(req: Request, res: Response) {
    await notificationService.marquerToutLu(userId(req));
    res.status(204).send();
  },
};

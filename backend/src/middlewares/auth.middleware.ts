import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ForbiddenError, UnauthorizedError } from '../utils/AppError';
import type { Role } from '../generated/prisma/enums';

export interface JwtPayload {
  sub: number; // id de l'utilisateur
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Vérifie le jeton JWT présent dans l'en-tête Authorization: Bearer <token>
// et attache l'utilisateur authentifié (id + rôle) à req.user.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  // Le code TOKEN_INVALIDE permet au frontend de distinguer une session expirée
  // (déconnexion automatique) d'un simple 401 métier (ex. mot de passe incorrect).
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Jeton d\'authentification manquant', 'TOKEN_INVALIDE');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Votre session a expiré — reconnectez-vous', 'TOKEN_INVALIDE');
  }
}

// Contrôle d'accès basé sur les rôles (RBAC) : à utiliser après requireAuth.
// Ex. router.delete('/users/:id', requireAuth, requireRole('ADMINISTRATEUR'), ...)
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Rôle insuffisant pour cette action');
    }
    next();
  };
}

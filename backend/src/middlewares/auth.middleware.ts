import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
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

// Vérifie la signature du jeton PUIS revalide le compte en base. Un compte
// désactivé — ou dont le rôle a changé — est ainsi rejeté (ou reçoit son rôle à
// jour) immédiatement, sans attendre l'expiration du jeton : c'est la révocation
// « quasi-immédiate ». L'algorithme est épinglé (HS256) contre les attaques de
// confusion d'algorithme. Réutilisé par le flux SSE (jeton en query).
export async function authentifierToken(token: string): Promise<JwtPayload> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JwtPayload;
  } catch {
    throw new UnauthorizedError('Votre session a expiré — reconnectez-vous', 'TOKEN_INVALIDE');
  }

  const utilisateur = await utilisateurRepository.findById(payload.sub);
  if (!utilisateur || !utilisateur.actif) {
    throw new UnauthorizedError('Session invalide — reconnectez-vous', 'TOKEN_INVALIDE');
  }

  // Rôle FRAIS issu de la base, jamais celui (potentiellement périmé) du jeton.
  return { sub: utilisateur.id, role: utilisateur.role };
}

// Vérifie le jeton JWT présent dans l'en-tête Authorization: Bearer <token>
// et attache l'utilisateur authentifié (id + rôle à jour) à req.user.
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  // Le code TOKEN_INVALIDE permet au frontend de distinguer une session expirée
  // (déconnexion automatique) d'un simple 401 métier (ex. mot de passe incorrect).
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Jeton d\'authentification manquant', 'TOKEN_INVALIDE');
  }

  const token = header.slice('Bearer '.length);
  req.user = await authentifierToken(token);
  next();
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

import type { Request, Response } from 'express';
import { env } from '../config/env';

// Le refresh token voyage dans un cookie httpOnly (inaccessible au JavaScript,
// donc à l'abri d'un vol par XSS). Restreint au chemin /api/auth : il n'est
// envoyé qu'aux routes de rafraîchissement et de déconnexion.
const NOM_COOKIE_REFRESH = 'refresh_token';
const CHEMIN_COOKIE = '/api/auth';

export function poserCookieRefresh(res: Response, refreshToken: string): void {
  res.cookie(NOM_COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production', // HTTPS obligatoire en production
    sameSite: 'lax', // bloque l'envoi sur requête POST cross-site (anti-CSRF)
    path: CHEMIN_COOKIE,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

export function effacerCookieRefresh(res: Response): void {
  res.clearCookie(NOM_COOKIE_REFRESH, { path: CHEMIN_COOKIE });
}

// Lecture manuelle du cookie (évite la dépendance cookie-parser).
export function lireCookieRefresh(req: Request): string | null {
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const morceau of brut.split(';')) {
    const [nom, ...reste] = morceau.trim().split('=');
    if (nom === NOM_COOKIE_REFRESH) return decodeURIComponent(reste.join('='));
  }
  return null;
}

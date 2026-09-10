import type { NextFunction, Request, Response } from 'express';
import { executerAvecContexte } from '../utils/contexteRequete';

// Ouvre le contexte de requête pour toute la chaîne de traitement (voir
// `utils/contexteRequete.ts`). À monter TRÈS TÔT dans `app.ts` — avant les routes, et
// avant l'authentification : l'IP est connue dès l'entrée, l'identité de l'acteur est
// ajoutée plus tard par `requireAuth` via `enrichirContexte`.
//
// `req.ip` est fiable ici : `trust proxy` est configuré dans `app.ts`, sans quoi toutes
// les requêtes derrière nginx porteraient l'IP du reverse-proxy.
export function contexteRequete(req: Request, _res: Response, next: NextFunction): void {
  executerAvecContexte(
    {
      ip: req.ip,
      // Tronqué : un user-agent est libre et peut être arbitrairement long. 255 suffit à
      // identifier un navigateur, et borne ce qu'un client peut faire écrire en base.
      userAgent: req.get('user-agent')?.slice(0, 255),
    },
    () => next(),
  );
}

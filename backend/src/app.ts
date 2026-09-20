import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { contexteRequete } from './middlewares/contexte.middleware';

export const app = express();

// Un seul proxy de confiance devant l'API (nginx en Docker) : nécessaire pour
// que req.ip reflète le client réel et que le rate limiting par IP fonctionne.
app.set('trust proxy', 1);

// En-têtes de sécurité. L'API ne sert QUE du JSON (aucune ressource à charger) :
// CSP entièrement verrouillée, HSTS (force HTTPS en production), pas de referrer.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
// Limite la taille du corps JSON : borne la surface d'attaque par gros payloads
// (la plus longue entrée métier — description de ticket — fait 5000 caractères).
app.use(express.json({ limit: '32kb' }));

// Journalisation des requêtes. On masque les secrets éventuellement présents en
// query (jeton du flux SSE, code OTP) : ils ne doivent jamais toucher les logs.
morgan.token('url', (req) => {
  const url = (req as express.Request).originalUrl || req.url || '';
  return url.replace(/([?&](?:token|code)=)[^&]+/gi, '$1[REDACTED]');
});
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Ouvre le contexte de requête (IP, user-agent) pour toute la chaîne de traitement :
// c'est lui qui permet au journal d'audit de savoir « depuis où » sans que les services
// aient à recevoir `req` en paramètre. Monté APRÈS `trust proxy` (sinon `req.ip` serait
// celui du reverse-proxy) et AVANT les routes.
app.use(contexteRequete);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

export const app = express();

// Un seul proxy de confiance devant l'API (nginx en Docker) : nécessaire pour
// que req.ip reflète le client réel et que le rate limiting par IP fonctionne.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

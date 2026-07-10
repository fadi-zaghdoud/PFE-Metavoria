import { Router } from 'express';
import { authRouter } from './auth.routes';
import { utilisateursRouter } from './utilisateurs.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/utilisateurs', utilisateursRouter);

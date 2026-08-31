import { Router } from 'express';
import { authRouter } from './auth.routes';
import { utilisateursRouter } from './utilisateurs.routes';
import { ticketsRouter } from './tickets.routes';
import { categoriesRouter } from './categories.routes';
import { notificationsRouter } from './notifications.routes';
import { iaRouter } from './ia.routes';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/utilisateurs', utilisateursRouter);
apiRouter.use('/tickets', ticketsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/ia', iaRouter);

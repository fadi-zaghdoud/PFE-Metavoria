import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API Smart Ticketing démarrée sur http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} reçu — arrêt propre du serveur...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

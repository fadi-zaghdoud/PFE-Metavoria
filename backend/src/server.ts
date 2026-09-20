import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { auditService } from './services/audit.service';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API Smart Ticketing démarrée sur http://localhost:${env.PORT}`);

  // Rétention du journal d'audit (§7). Lancée APRÈS `listen` et sans être attendue :
  // l'API sert déjà quand la purge s'exécute, donc ni sa lenteur ni son échec ne peuvent
  // retarder ou empêcher le démarrage. `purgerExpirees` absorbe elle-même ses erreurs.
  //
  // Seul déclencheur de la purge : le projet n'a pas de planificateur. Une instance qui
  // tournerait plus de douze mois sans redémarrer ne purgerait pas — limite documentée
  // dans `services/audit.service.ts`.
  void auditService.purgerExpirees();
});

async function shutdown(signal: string) {
  console.log(`\n${signal} reçu — arrêt propre du serveur...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

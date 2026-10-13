// Outillage des tests d'intégration (fichiers *.itest.ts) : ils écrivent dans une VRAIE base
// PostgreSQL et la vident. D'où la garde : elle refuse toute base dont le nom ne finit pas
// par « _test », AVANT la moindre requête — le client Prisma et l'application ne sont
// chargés qu'après elle. Sans DATABASE_URL explicite, `config/env` lit backend/.env, qui
// pointe sur la base de développement : la garde l'arrête.
//
// En CI : une base éphémère (service Postgres du job « backend-integration »). En local :
// une base jetable, par exemple
//   docker run -d --name st-test-db -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
//     -e POSTGRES_DB=smart_ticketing_test -p 55434:5432 pgvector/pgvector:pg17
//   DATABASE_URL=postgresql://test:test@localhost:55434/smart_ticketing_test npx prisma migrate deploy
//   DATABASE_URL=postgresql://test:test@localhost:55434/smart_ticketing_test npm run test:integration
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../generated/prisma/enums';

export function garderBaseDeTest(): void {
  const base = new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
  if (!base.endsWith('_test')) {
    throw new Error(
      `Refus : les tests d'intégration écrivent puis vident la base, et « ${base} » n'est pas une base de test (nom en « _test » attendu).`,
    );
  }
}

// Passe la garde, puis charge le client Prisma et l'application, démarre un serveur sur un
// port libre et vide la base. À appeler dans `before`.
export async function preparer() {
  garderBaseDeTest();
  const { prisma } = await import('../config/prisma.js');
  const { app } = await import('../app.js');
  // CASCADE emporte toutes les tables qui référencent les comptes ou les catégories
  // (tickets, événements, suggestions, notifications…).
  await prisma.$executeRawUnsafe('TRUNCATE TABLE utilisateurs, categories RESTART IDENTITY CASCADE');
  const serveur = app.listen(0, '127.0.0.1');
  await once(serveur, 'listening');
  const { port } = serveur.address() as AddressInfo;
  return {
    prisma,
    url: `http://127.0.0.1:${port}/api`,
    fermer: async () => {
      await new Promise<void>((fin) => serveur.close(() => fin()));
      await prisma.$disconnect();
    },
  };
}

// Jeton d'accès de même forme que ceux de l'application (sub, role ; HS256).
export const jeton = (u: { id: number; role: Role }): string =>
  jwt.sign({ sub: u.id, role: u.role }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });

export async function lire<T>(url: string, token?: string): Promise<{ statut: number; corps: T }> {
  const reponse = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { statut: reponse.status, corps: (await reponse.json()) as T };
}

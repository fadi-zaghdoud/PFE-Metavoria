import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Instance unique du client Prisma, partagée par toute l'application
// (évite d'épuiser le pool de connexions PostgreSQL en développement avec hot-reload).
export const prisma = new PrismaClient({ adapter });

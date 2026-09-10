import { prisma } from '../config/prisma';
import type { Prisma, ResultatAudit } from '../generated/prisma/client';

// Accès au journal d'audit. Volontairement minimal : une écriture, et les lectures que la
// page d'administration consommera (lot C). Ce dépôt n'importe PAS `logger` — ce serait
// une boucle, le journal se journalisant lui-même.

export interface EcritureAudit {
  action: string;
  acteurId: number | null;
  acteurNom: string;
  cibleType: string | null;
  cibleId: number | null;
  resultat: ResultatAudit;
  ip: string | null;
  userAgent: string | null;
  details: Prisma.InputJsonValue | undefined;
}

export const auditRepository = {
  creer(donnees: EcritureAudit) {
    return prisma.journalAudit.create({ data: donnees });
  },
};

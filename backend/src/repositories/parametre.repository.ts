import { prisma } from '../config/prisma';

export const parametreRepository = {
  findByCle(cle: string) {
    return prisma.parametre.findUnique({ where: { cle } });
  },

  findMany() {
    return prisma.parametre.findMany({ orderBy: { cle: 'asc' } });
  },

  // Upsert : un paramètre jamais réglé n'a AUCUNE ligne en base (l'application tourne
  // alors sur le défaut du registre) ; le premier réglage la crée, les suivants la mettent
  // à jour. `dateMaj` est posée par Prisma (@updatedAt) dans les deux cas.
  upsert(cle: string, valeur: string, description: string | null, majParId: number | null) {
    return prisma.parametre.upsert({
      where: { cle },
      create: { cle, valeur, description, majParId },
      update: { valeur, majParId },
    });
  },
};

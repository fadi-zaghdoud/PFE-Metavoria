import { prisma } from '../config/prisma';

export const categorieRepository = {
  findMany() {
    return prisma.categorie.findMany({ orderBy: { nom: 'asc' } });
  },

  findById(id: number) {
    return prisma.categorie.findUnique({ where: { id } });
  },
};

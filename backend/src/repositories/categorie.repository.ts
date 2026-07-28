import { prisma } from '../config/prisma';

export const categorieRepository = {
  findMany() {
    return prisma.categorie.findMany({ orderBy: { nom: 'asc' } });
  },

  findById(id: number) {
    return prisma.categorie.findUnique({ where: { id } });
  },

  // Résolution nom → catégorie (nom @unique). Sert à mapper le label du classifieur
  // IA sur une catégorie réelle ; renvoie null si le label n'existe plus (modèle périmé).
  findByNom(nom: string) {
    return prisma.categorie.findUnique({ where: { nom } });
  },
};

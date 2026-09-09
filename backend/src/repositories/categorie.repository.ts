import { prisma } from '../config/prisma';

export const categorieRepository = {
  findMany() {
    return prisma.categorie.findMany({ orderBy: { nom: 'asc' } });
  },

  findById(id: number) {
    return prisma.categorie.findUnique({ where: { id } });
  },

  // Verification en lot des categories reçues (specialites d'un technicien).
  findManyByIds(ids: number[]) {
    return prisma.categorie.findMany({ where: { id: { in: ids } }, select: { id: true } });
  },

  // Résolution nom → catégorie (nom @unique). Sert à mapper le label du classifieur
  // IA sur une catégorie réelle ; renvoie null si le label n'existe plus (modèle périmé).
  findByNom(nom: string) {
    return prisma.categorie.findUnique({ where: { nom } });
  },

  // Recherche INSENSIBLE À LA CASSE, en excluant éventuellement une catégorie (son propre id,
  // lors d'un renommage). La contrainte DB @unique de Postgres est sensible à la casse
  // (« sécurité » ≠ « Sécurité ») : sans ce contrôle applicatif, on créerait des quasi-doublons
  // qui casseraient le pont-par-nom avec le modèle IA (deux catégories pour une même classe).
  findByNomInsensible(nom: string, saufId?: number) {
    return prisma.categorie.findFirst({
      where: {
        nom: { equals: nom, mode: 'insensitive' },
        ...(saufId !== undefined ? { id: { not: saufId } } : {}),
      },
    });
  },

  // CRUD admin (Phase A). L'unicité du nom est garantie par la contrainte DB (@unique) →
  // une violation remonte en P2002, traduite en 409 par le service (filet après le contrôle
  // insensible à la casse : couvre la course entre deux créations simultanées).
  create(data: { nom: string; description: string | null }) {
    return prisma.categorie.create({ data });
  },

  update(id: number, data: { nom?: string; description?: string | null }) {
    return prisma.categorie.update({ where: { id }, data });
  },

  deleteById(id: number) {
    return prisma.categorie.delete({ where: { id } });
  },

  // Nombre de tickets rattachés (TOUS statuts, synthétiques inclus) — garde de suppression :
  // on refuse d'orphaniser des tickets (le schéma est en onDelete: SetNull, on bloque AVANT).
  countTickets(id: number) {
    return prisma.ticket.count({ where: { categorieId: id } });
  },
};

import { prisma } from '../config/prisma';

export interface CreerNotificationData {
  utilisateurId: number;
  type: string; // CHANGEMENT_STATUT | AFFECTATION | NOUVEAU_COMMENTAIRE
  contenu: string;
  ticketId: number; // ticket concerné, pour la redirection au clic
}

export const notificationRepository = {
  create(data: CreerNotificationData) {
    return prisma.notification.create({ data });
  },

  findManyByUser(utilisateurId: number) {
    return prisma.notification.findMany({
      where: { utilisateurId },
      orderBy: { dateEnvoi: 'desc' },
      take: 50,
    });
  },

  countNonLues(utilisateurId: number) {
    return prisma.notification.count({ where: { utilisateurId, lu: false } });
  },

  findById(id: number) {
    return prisma.notification.findUnique({ where: { id } });
  },

  marquerLu(id: number) {
    return prisma.notification.update({ where: { id }, data: { lu: true } });
  },

  marquerToutLu(utilisateurId: number) {
    return prisma.notification.updateMany({ where: { utilisateurId, lu: false }, data: { lu: true } });
  },
};

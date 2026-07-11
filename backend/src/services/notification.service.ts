import { notificationRepository } from '../repositories/notification.repository';
import { emailService } from './email.service';
import { sseHub } from '../utils/sseHub';
import { NotFoundError } from '../utils/AppError';

export type TypeNotification =
  | 'CHANGEMENT_STATUT'
  | 'AFFECTATION'
  | 'NOUVEAU_COMMENTAIRE'
  | 'EVALUATION';

interface DestinataireNotification {
  id: number;
  email: string;
  prenom: string;
}

interface NotifierInput {
  destinataire: DestinataireNotification;
  type: TypeNotification;
  sujet: string; // titre court (notification in-app + objet e-mail)
  message: string; // corps lisible
  ticketId: number;
}

export const notificationService = {
  // Crée la notification in-app puis envoie l'e-mail. Entièrement best-effort :
  // une notification (in-app ou e-mail) ne doit jamais faire échouer l'action
  // métier déjà validée — toute erreur est journalisée puis absorbée.
  async notifier({ destinataire, type, sujet, message, ticketId }: NotifierInput) {
    try {
      const notification = await notificationRepository.create({
        utilisateurId: destinataire.id,
        type,
        contenu: message,
        ticketId,
      });
      // Poussée temps réel vers les onglets ouverts du destinataire (SSE).
      sseHub.publier(destinataire.id, 'notification', notification);
      await emailService.envoyerNotificationTicket(
        destinataire.email,
        destinataire.prenom,
        sujet,
        message,
        ticketId,
      );
    } catch (err) {
      console.error('Notification non délivrée :', err);
    }
  },

  async lister(utilisateurId: number) {
    const [notifications, nonLues] = await Promise.all([
      notificationRepository.findManyByUser(utilisateurId),
      notificationRepository.countNonLues(utilisateurId),
    ]);
    return { notifications, nonLues };
  },

  async marquerLu(utilisateurId: number, id: number) {
    const notification = await notificationRepository.findById(id);
    if (!notification || notification.utilisateurId !== utilisateurId) {
      throw new NotFoundError('Notification introuvable');
    }
    return notificationRepository.marquerLu(id);
  },

  async marquerToutLu(utilisateurId: number) {
    await notificationRepository.marquerToutLu(utilisateurId);
  },
};

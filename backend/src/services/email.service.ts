import { env } from '../config/env';
import { smtpConfigured, transporteurMail } from '../config/mailer';
import { AppError } from '../utils/AppError';
import { escapeHtml } from '../utils/escapeHtml';

export const emailService = {
  // Envoie le lien d'invitation permettant à un compte créé par un administrateur
  // de choisir son mot de passe. Le token en clair ne transite que par cet e-mail.
  async envoyerInvitation(destinataire: string, prenom: string, token: string, validiteHeures: number) {
    const lien = `${env.FRONTEND_URL}/activer-compte?token=${token}`;
    const prenomHtml = escapeHtml(prenom); // échappé pour le corps HTML

    if (!smtpConfigured) {
      console.warn(`⚠️  SMTP non configuré — lien d'invitation pour ${destinataire} : ${lien}`);
      return;
    }

    try {
      await transporteurMail.sendMail({
        from: env.SMTP_FROM,
        to: destinataire,
        subject: 'Invitation à rejoindre Smart Ticketing — Metavoria',
        text: `Bonjour ${prenom},\n\nUn compte vous a été créé sur Smart Ticketing, la plateforme de support de Metavoria.\n\nPour l'activer, choisissez votre mot de passe via ce lien (valable ${validiteHeures} h) :\n${lien}\n\nSi vous n'êtes pas concerné par cette invitation, ignorez cet e-mail.`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1e293b;margin:0 0 8px">Bienvenue sur Smart Ticketing</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
              Bonjour ${prenomHtml},<br/>
              un compte vous a été créé sur la plateforme de support de Metavoria.
              Choisissez votre mot de passe pour l'activer — le lien est valable
              <strong>${validiteHeures} heures</strong>.
            </p>
            <p style="text-align:center;margin:0 0 20px">
              <a href="${lien}" style="display:inline-block;background:#4f46e5;color:#ffffff;
                 text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;
                 border-radius:12px">Activer mon compte</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
              <span style="word-break:break-all">${lien}</span>
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Échec d'envoi de l'e-mail d'invitation :", err);
      throw new AppError(502, "L'envoi de l'e-mail d'invitation a échoué. Réessayez dans quelques instants.");
    }
  },

  // Notifie un utilisateur d'un événement sur un ticket (changement de statut,
  // affectation, nouveau commentaire). Best-effort : l'appelant (notificationService)
  // ignore l'échec pour ne jamais bloquer l'action métier déjà validée.
  async envoyerNotificationTicket(
    destinataire: string,
    prenom: string,
    sujet: string,
    message: string,
    ticketId: number,
  ) {
    const lien = `${env.FRONTEND_URL}/tickets/${ticketId}`;
    // sujet et message contiennent des valeurs libres (titre de ticket) : échappées
    // pour le corps HTML afin d'empêcher toute injection de balises.
    const sujetHtml = escapeHtml(sujet);
    const prenomHtml = escapeHtml(prenom);
    const messageHtml = escapeHtml(message);

    if (!smtpConfigured) {
      console.warn(`⚠️  SMTP non configuré — notification pour ${destinataire} : ${message} (${lien})`);
      return;
    }

    try {
      await transporteurMail.sendMail({
        from: env.SMTP_FROM,
        to: destinataire,
        subject: `${sujet} — Smart Ticketing`,
        text: `Bonjour ${prenom},\n\n${message}\n\nConsulter le ticket : ${lien}\n\nL'équipe support Metavoria`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1e293b;margin:0 0 8px">${sujetHtml}</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
              Bonjour ${prenomHtml},<br/>${messageHtml}
            </p>
            <p style="text-align:center;margin:0 0 20px">
              <a href="${lien}" style="display:inline-block;background:#4f46e5;color:#ffffff;
                 text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;
                 border-radius:12px">Consulter le ticket</a>
            </p>
            <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
              <span style="word-break:break-all">${lien}</span>
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Échec d'envoi de l'e-mail de notification :", err);
      throw new AppError(502, "L'envoi de l'e-mail de notification a échoué.");
    }
  },

  // Envoie le code OTP de réinitialisation. À n'appeler QUE pour un compte
  // existant et actif — la vérification d'existence se fait dans la couche service.
  async envoyerCodeReinitialisation(destinataire: string, code: string, validiteMinutes: number) {
    if (!smtpConfigured) {
      // Repli développement : sans SMTP configuré, le code est visible dans les
      // logs serveur plutôt que silencieusement perdu.
      console.warn(`⚠️  SMTP non configuré — code de réinitialisation pour ${destinataire} : ${code}`);
      return;
    }

    try {
      await transporteurMail.sendMail({
        from: env.SMTP_FROM,
        to: destinataire,
        subject: `${code} — votre code de vérification Smart Ticketing`,
        text: `Votre code de vérification est : ${code}\n\nIl est valable ${validiteMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1e293b;margin:0 0 8px">Code de vérification</h2>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
              Utilisez ce code pour réinitialiser votre mot de passe Smart Ticketing.
              Il est valable <strong>${validiteMinutes} minutes</strong>.
            </p>
            <div style="background:#eef2ff;border-radius:12px;padding:18px;text-align:center;
                        font-size:32px;font-weight:bold;letter-spacing:10px;color:#4338ca">
              ${code}
            </div>
            <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:20px 0 0">
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail :
              votre mot de passe reste inchangé.
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Échec d'envoi de l'e-mail de réinitialisation :", err);
      throw new AppError(502, "L'envoi de l'e-mail a échoué. Réessayez dans quelques instants.");
    }
  },
};

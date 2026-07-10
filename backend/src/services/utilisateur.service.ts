import { randomBytes } from 'node:crypto';
import { utilisateurRepository, type FiltresUtilisateurs } from '../repositories/utilisateur.repository';
import { emailService } from './email.service';
import { ConflictError, NotFoundError, ValidationError } from '../utils/AppError';
import { toPublicUser } from '../utils/toPublicUser';
import { sha256Hex } from '../utils/hash';
import type { Role } from '../generated/prisma/enums';

const VALIDITE_INVITATION_HEURES = 72;

export interface InvitationInput {
  nom: string;
  prenom: string;
  email: string;
  service?: string;
  poste?: string;
  role: Role;
}

function genererTokenInvitation() {
  const tokenBrut = randomBytes(32).toString('hex');
  return {
    tokenBrut,
    tokenHash: sha256Hex(tokenBrut),
    expiration: new Date(Date.now() + VALIDITE_INVITATION_HEURES * 3600_000),
  };
}

// Service réservé à l'administration (voir requireRole('ADMINISTRATEUR') sur les routes associées).
export const utilisateurService = {
  async lister(filtres: FiltresUtilisateurs) {
    const utilisateurs = await utilisateurRepository.findMany(filtres);
    return utilisateurs.map(toPublicUser);
  },

  // Crée un compte sans mot de passe (statut « En attente ») et envoie le lien
  // d'invitation. L'invité choisit lui-même son mot de passe : l'administrateur
  // ne connaît jamais le moindre secret du compte.
  async inviter(input: InvitationInput) {
    const existant = await utilisateurRepository.findByEmail(input.email);
    if (existant) {
      throw new ConflictError('Un compte existe déjà avec cet email');
    }

    const { tokenBrut, tokenHash, expiration } = genererTokenInvitation();

    const utilisateur = await utilisateurRepository.create({
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      service: input.service,
      poste: input.poste,
      role: input.role,
      tokenInvitation: tokenHash,
      tokenInvitationExpire: expiration,
    });

    try {
      await emailService.envoyerInvitation(
        utilisateur.email,
        utilisateur.prenom,
        tokenBrut,
        VALIDITE_INVITATION_HEURES,
      );
    } catch (err) {
      // Sans e-mail reçu, le compte est inutilisable : on annule la création
      // pour que l'administrateur puisse simplement réessayer.
      await utilisateurRepository.delete(utilisateur.id);
      throw err;
    }

    return toPublicUser(utilisateur);
  },

  // Regénère un token (l'ancien devient immédiatement invalide) et renvoie l'e-mail.
  async renvoyerInvitation(id: number) {
    const utilisateur = await utilisateurRepository.findById(id);
    if (!utilisateur) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    if (utilisateur.motDePasse) {
      throw new ValidationError('Ce compte est déjà activé');
    }
    if (!utilisateur.actif) {
      throw new ValidationError('Ce compte est désactivé — réactivez-le avant de renvoyer une invitation');
    }

    const { tokenBrut, tokenHash, expiration } = genererTokenInvitation();

    await utilisateurRepository.update(id, {
      tokenInvitation: tokenHash,
      tokenInvitationExpire: expiration,
    });

    await emailService.envoyerInvitation(
      utilisateur.email,
      utilisateur.prenom,
      tokenBrut,
      VALIDITE_INVITATION_HEURES,
    );

    return toPublicUser({ ...utilisateur, tokenInvitation: tokenHash, tokenInvitationExpire: expiration });
  },

  async changerRole(id: number, role: Role) {
    const existant = await utilisateurRepository.findById(id);
    if (!existant) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    const utilisateur = await utilisateurRepository.update(id, { role });
    return toPublicUser(utilisateur);
  },

  async changerStatutActif(id: number, actif: boolean) {
    const existant = await utilisateurRepository.findById(id);
    if (!existant) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    const utilisateur = await utilisateurRepository.update(id, { actif });
    return toPublicUser(utilisateur);
  },
};

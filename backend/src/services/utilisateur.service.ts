import { randomBytes } from 'node:crypto';
import { utilisateurRepository, type FiltresUtilisateurs } from '../repositories/utilisateur.repository';
import { emailService } from './email.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/AppError';
import { toPublicUser } from '../utils/toPublicUser';
import { sha256Hex } from '../utils/hash';
import { logAudit } from '../utils/logger';
import { categorieRepository } from '../repositories/categorie.repository';
import { dateDuJour, jourDeDate, jourVersDate } from './absence.disponibilite';
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
  // Enrichi des specialites et de l'absence en cours : l'administration des comptes en a
  // besoin (multi-select, pastille « absent »). Le MOTIF n'est pas remonte ici — il
  // n'appartient qu'a la page Absences ; cette liste sert aussi a choisir un technicien.
  async lister(filtres: FiltresUtilisateurs) {
    const jour = jourVersDate(dateDuJour(new Date()));
    const utilisateurs = await utilisateurRepository.findMany({ ...filtres, jour });
    return utilisateurs.map((u) => {
      const { specialites = [], absences = [], ...reste } = u as typeof u & {
        specialites?: { categorieId: number }[];
        absences?: { dateFin: Date }[];
      };
      return {
        ...toPublicUser(reste as typeof u),
        specialites: specialites.map((sp) => sp.categorieId),
        absenceJusquau: absences[0] ? jourDeDate(absences[0].dateFin) : null,
      };
    });
  },

  // Definit les specialites d'un TECHNICIEN (§6.2) : quelles categories il couvre.
  // Reserve a l'administrateur. Les categories doivent exister ; les doublons envoyes par
  // l'interface sont absorbes plutot que refuses (cocher deux fois la meme case n'est pas
  // une erreur de l'utilisateur).
  async definirSpecialites(id: number, categorieIds: number[]) {
    const utilisateur = await utilisateurRepository.findById(id);
    if (!utilisateur) throw new NotFoundError('Utilisateur introuvable');
    if (utilisateur.role !== 'TECHNICIEN') {
      throw new ValidationError('Seul un technicien peut avoir des specialites');
    }

    const uniques = [...new Set(categorieIds)];
    if (uniques.length > 0) {
      const existantes = await categorieRepository.findManyByIds(uniques);
      if (existantes.length !== uniques.length) throw new ValidationError('Categorie invalide');
    }

    await utilisateurRepository.remplacerSpecialites(id, uniques);
    logAudit('UTILISATEUR_SPECIALITES', { utilisateurId: id, categorieIds: uniques });
    return uniques;
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

  // acteurId = administrateur qui effectue l'action. Les gardes empêchent qu'un
  // administrateur se retire ses propres droits (auto-verrouillage) ou que le
  // DERNIER administrateur actif de la plateforme disparaisse.
  async changerRole(acteurId: number, id: number, role: Role) {
    const existant = await utilisateurRepository.findById(id);
    if (!existant) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    if (id === acteurId) {
      throw new ForbiddenError('Vous ne pouvez pas modifier votre propre rôle');
    }
    // Rétrograder le dernier administrateur actif laisserait la plateforme sans admin.
    if (existant.role === 'ADMINISTRATEUR' && existant.actif && role !== 'ADMINISTRATEUR') {
      const admins = await utilisateurRepository.countAdminsActifs();
      if (admins <= 1) {
        throw new ConflictError('Au moins un administrateur actif doit subsister');
      }
    }
    const utilisateur = await utilisateurRepository.update(id, { role });
    return toPublicUser(utilisateur);
  },

  async changerStatutActif(acteurId: number, id: number, actif: boolean) {
    const existant = await utilisateurRepository.findById(id);
    if (!existant) {
      throw new NotFoundError('Utilisateur introuvable');
    }
    if (id === acteurId) {
      throw new ForbiddenError('Vous ne pouvez pas modifier votre propre statut');
    }
    // Désactiver le dernier administrateur actif verrouillerait l'administration.
    if (!actif && existant.role === 'ADMINISTRATEUR' && existant.actif) {
      const admins = await utilisateurRepository.countAdminsActifs();
      if (admins <= 1) {
        throw new ConflictError('Au moins un administrateur actif doit subsister');
      }
    }
    const utilisateur = await utilisateurRepository.update(id, { actif });
    return toPublicUser(utilisateur);
  },
};

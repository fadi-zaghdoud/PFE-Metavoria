import { prisma } from '../config/prisma';
import type { Role } from '../generated/prisma/enums';

export interface CreerUtilisateurInput {
  nom: string;
  prenom: string;
  email: string;
  // Déjà hashé — le hachage se fait dans la couche service.
  // Absent pour un compte invité (activé plus tard via le lien d'invitation).
  motDePasse?: string;
  role?: Role;
  service?: string;
  poste?: string;
  tokenInvitation?: string; // hash SHA-256
  tokenInvitationExpire?: Date;
}

export interface MettreAJourUtilisateurInput {
  nom?: string;
  prenom?: string;
  service?: string | null;
  poste?: string | null;
  motDePasse?: string; // déjà hashé
  role?: Role;
  actif?: boolean;
  codeReinitialisation?: string | null; // hash SHA-256 du code OTP
  codeReinitialisationExpire?: Date | null;
  codeReinitialisationEmis?: Date | null;
  codeReinitialisationTentatives?: number;
  tokenInvitation?: string | null; // hash SHA-256
  tokenInvitationExpire?: Date | null;
}

export interface FiltresUtilisateurs {
  role?: Role;
  service?: string;
  actif?: boolean;
}

// Couche repository : seule couche à parler directement à Prisma.
// Les services ne connaissent pas les détails de la persistance.
export const utilisateurRepository = {
  findByEmail(email: string) {
    return prisma.utilisateur.findUnique({ where: { email } });
  },

  findById(id: number) {
    return prisma.utilisateur.findUnique({ where: { id } });
  },

  findByTokenInvitation(tokenHash: string) {
    return prisma.utilisateur.findUnique({ where: { tokenInvitation: tokenHash } });
  },

  delete(id: number) {
    return prisma.utilisateur.delete({ where: { id } });
  },

  create(data: CreerUtilisateurInput) {
    return prisma.utilisateur.create({ data });
  },

  update(id: number, data: MettreAJourUtilisateurInput) {
    return prisma.utilisateur.update({ where: { id }, data });
  },

  // `jour` (optionnel) : quand il est fourni, chaque utilisateur porte ses specialites et
  // l'absence qui couvre ce jour. Sert l'administration des comptes (multi-select des
  // specialites + pastille « absent »). Le predicat d'absence reproduit les bornes
  // incluses de `estAbsentLe` (services/absence.disponibilite.ts).
  findMany(filtres: FiltresUtilisateurs & { jour?: Date } = {}) {
    return prisma.utilisateur.findMany({
      where: {
        role: filtres.role,
        service: filtres.service,
        actif: filtres.actif,
      },
      include: filtres.jour
        ? {
            specialites: { select: { categorieId: true } },
            absences: {
              where: { dateDebut: { lte: filtres.jour }, dateFin: { gte: filtres.jour } },
              select: { dateFin: true },
            },
          }
        : undefined,
      orderBy: { dateCreation: 'desc' },
    });
  },

  // Remplace INTEGRALEMENT les specialites d'un technicien (et non un ajout incremental) :
  // l'interface envoie l'etat complet des cases cochees, pas un delta.
  async remplacerSpecialites(technicienId: number, categorieIds: number[]) {
    await prisma.$transaction([
      prisma.technicienCategorie.deleteMany({ where: { technicienId } }),
      prisma.technicienCategorie.createMany({
        data: categorieIds.map((categorieId) => ({ technicienId, categorieId })),
      }),
    ]);
  },

  // Nombre d'administrateurs actifs — garde-fou contre la suppression du dernier
  // administrateur (rétrogradation ou désactivation).
  countAdminsActifs() {
    return prisma.utilisateur.count({ where: { role: 'ADMINISTRATEUR', actif: true } });
  },

  // Pour l'affichage de noms dans les statistiques (id -> prénom/nom).
  findManyByIds(ids: number[]) {
    return prisma.utilisateur.findMany({
      where: { id: { in: ids } },
      select: { id: true, prenom: true, nom: true },
    });
  },
};

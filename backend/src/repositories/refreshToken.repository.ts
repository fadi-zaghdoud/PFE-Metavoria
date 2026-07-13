import { prisma } from '../config/prisma';

// Persistance des jetons de rafraîchissement. Seul le hash SHA-256 du jeton opaque
// est stocké : un vol de la base ne permet pas de rejouer un refresh token.
export const refreshTokenRepository = {
  create(data: { utilisateurId: number; tokenHash: string; expireLe: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke(id: number) {
    return prisma.refreshToken.update({ where: { id }, data: { revoke: true } });
  },

  // Révoque toutes les sessions actives d'un utilisateur (déconnexion globale,
  // désactivation, ou détection de réutilisation d'un jeton volé).
  revokeAllForUser(utilisateurId: number) {
    return prisma.refreshToken.updateMany({
      where: { utilisateurId, revoke: false },
      data: { revoke: true },
    });
  },

  // Nettoyage : supprime les jetons révoqués ou expirés d'un utilisateur (borne la
  // croissance de la table). Appelé à la connexion.
  supprimerObsoletes(utilisateurId: number) {
    return prisma.refreshToken.deleteMany({
      where: { utilisateurId, OR: [{ revoke: true }, { expireLe: { lt: new Date() } }] },
    });
  },
};

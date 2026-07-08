import { prisma } from '../config/prisma';
import type { Role } from '../generated/prisma/enums';

export interface CreerUtilisateurInput {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string; // déjà hashé — le hachage se fait dans la couche service
  role?: Role;
  service?: string;
  poste?: string;
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

  create(data: CreerUtilisateurInput) {
    return prisma.utilisateur.create({ data });
  },
};

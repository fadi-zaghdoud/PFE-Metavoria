import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { ConflictError, UnauthorizedError } from '../utils/AppError';
import type { JwtPayload } from '../middlewares/auth.middleware';
import type { Role } from '../generated/prisma/enums';

export interface InscriptionInput {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  service?: string;
  poste?: string;
}

export interface ConnexionInput {
  email: string;
  motDePasse: string;
}

function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

// Retire le hash du mot de passe avant de renvoyer l'utilisateur au client.
function toPublicUser<T extends { motDePasse: string }>(user: T) {
  const { motDePasse: _motDePasse, ...publicUser } = user;
  return publicUser;
}

export const authService = {
  async inscrire(input: InscriptionInput) {
    const existant = await utilisateurRepository.findByEmail(input.email);
    if (existant) {
      throw new ConflictError('Un compte existe déjà avec cet email');
    }

    const motDePasseHash = await bcrypt.hash(input.motDePasse, env.BCRYPT_SALT_ROUNDS);

    // Toute inscription publique crée un compte Employé.
    // La promotion vers Technicien/Administrateur est réservée à l'administration (phase ultérieure).
    const role: Role = 'EMPLOYE';

    const utilisateur = await utilisateurRepository.create({
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      motDePasse: motDePasseHash,
      role,
      service: input.service,
      poste: input.poste,
    });

    const token = signToken({ sub: utilisateur.id, role: utilisateur.role });
    return { utilisateur: toPublicUser(utilisateur), token };
  },

  async connecter(input: ConnexionInput) {
    const utilisateur = await utilisateurRepository.findByEmail(input.email);
    if (!utilisateur) {
      throw new UnauthorizedError('Email ou mot de passe incorrect');
    }

    const motDePasseValide = await bcrypt.compare(input.motDePasse, utilisateur.motDePasse);
    if (!motDePasseValide) {
      throw new UnauthorizedError('Email ou mot de passe incorrect');
    }

    const token = signToken({ sub: utilisateur.id, role: utilisateur.role });
    return { utilisateur: toPublicUser(utilisateur), token };
  },

  async profil(userId: number) {
    const utilisateur = await utilisateurRepository.findById(userId);
    if (!utilisateur) {
      throw new UnauthorizedError('Utilisateur introuvable');
    }
    return toPublicUser(utilisateur);
  },
};

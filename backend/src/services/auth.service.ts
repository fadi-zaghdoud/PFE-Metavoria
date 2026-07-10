import { randomInt, timingSafeEqual } from 'node:crypto';
import { sha256Hex } from '../utils/hash';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { emailService } from './email.service';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../utils/AppError';
import { toPublicUser } from '../utils/toPublicUser';
import type { JwtPayload } from '../middlewares/auth.middleware';
import type { Role } from '../generated/prisma/enums';

// ── Politique OTP ────────────────────────────────────────────────────────────
const VALIDITE_CODE_MINUTES = 10;
const MAX_TENTATIVES_CODE = 5;
const COOLDOWN_RENVOI_SECONDES = 60;

const MESSAGE_COMPTE_NON_ACTIVE =
  "Ce compte n'est pas encore activé — utilisez le lien d'invitation reçu par e-mail";

// Hash factice pré-calculé : comparé quand l'email n'existe pas, pour que la
// durée de réponse de /connexion ne révèle pas l'existence d'un compte.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice-anti-timing', 10);

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

export interface MiseAJourProfilInput {
  nom?: string;
  prenom?: string;
  service?: string;
  poste?: string;
}

export interface ChangementMotDePasseInput {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
}

function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

const hacherCode = sha256Hex;

// Comparaison en temps constant des hashs de codes OTP.
function codesIdentiques(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA, 'hex');
  const b = Buffer.from(hashB, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

type UtilisateurEntite = NonNullable<Awaited<ReturnType<typeof utilisateurRepository.findByEmail>>>;

// Valide le code OTP d'un utilisateur. En cas d'échec : incrémente le compteur
// de tentatives et invalide le code une fois la limite atteinte.
async function validerCodeOtp(utilisateur: UtilisateurEntite, code: string): Promise<void> {
  if (!utilisateur.codeReinitialisation || !utilisateur.codeReinitialisationExpire) {
    throw new ValidationError('Aucun code en attente — demandez un nouveau code');
  }

  if (utilisateur.codeReinitialisationExpire < new Date()) {
    throw new ValidationError('Ce code a expiré — demandez un nouveau code');
  }

  if (utilisateur.codeReinitialisationTentatives >= MAX_TENTATIVES_CODE) {
    throw new TooManyRequestsError('Trop de tentatives — demandez un nouveau code');
  }

  if (!codesIdentiques(hacherCode(code), utilisateur.codeReinitialisation)) {
    const tentatives = utilisateur.codeReinitialisationTentatives + 1;
    const restantes = MAX_TENTATIVES_CODE - tentatives;

    if (restantes <= 0) {
      // Limite atteinte : le code est immédiatement invalidé.
      await utilisateurRepository.update(utilisateur.id, {
        codeReinitialisation: null,
        codeReinitialisationExpire: null,
        codeReinitialisationEmis: null,
        codeReinitialisationTentatives: 0,
      });
      throw new TooManyRequestsError('Trop de tentatives — le code a été invalidé, demandez-en un nouveau');
    }

    await utilisateurRepository.update(utilisateur.id, {
      codeReinitialisationTentatives: tentatives,
    });
    throw new ValidationError(
      `Code incorrect (${restantes} tentative${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''})`,
    );
  }
}

export const authService = {
  async inscrire(input: InscriptionInput) {
    const existant = await utilisateurRepository.findByEmail(input.email);
    if (existant) {
      throw new ConflictError('Un compte existe déjà avec cet email');
    }

    const motDePasseHash = await bcrypt.hash(input.motDePasse, env.BCRYPT_SALT_ROUNDS);

    // Toute inscription publique crée un compte Employé.
    // La promotion vers Technicien/Administrateur est réservée à l'administration.
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

    // Toujours exécuter une comparaison bcrypt, même si le compte n'existe pas
    // ou n'a pas encore de mot de passe (compte invité), pour ne pas révéler
    // l'existence d'un email par le temps de réponse.
    const motDePasseValide = await bcrypt.compare(
      input.motDePasse,
      utilisateur?.motDePasse ?? HASH_FACTICE,
    );

    if (utilisateur && !utilisateur.motDePasse) {
      throw new ForbiddenError(MESSAGE_COMPTE_NON_ACTIVE);
    }

    if (!utilisateur || !motDePasseValide) {
      throw new UnauthorizedError('Email ou mot de passe incorrect');
    }

    if (!utilisateur.actif) {
      throw new ForbiddenError('Ce compte a été désactivé — contactez un administrateur');
    }

    const token = signToken({ sub: utilisateur.id, role: utilisateur.role });
    return { utilisateur: toPublicUser(utilisateur), token };
  },

  // ── Activation d'un compte invité ──────────────────────────────────────────
  // Renvoie les informations minimales pour accueillir l'invité sur la page
  // d'activation, sans rien révéler d'autre du compte.
  async validerInvitation(tokenBrut: string) {
    const utilisateur = await utilisateurRepository.findByTokenInvitation(hacherCode(tokenBrut));

    if (!utilisateur || !utilisateur.actif || utilisateur.motDePasse) {
      throw new ValidationError("Lien d'invitation invalide ou déjà utilisé");
    }
    if (!utilisateur.tokenInvitationExpire || utilisateur.tokenInvitationExpire < new Date()) {
      throw new ValidationError(
        "Ce lien d'invitation a expiré — demandez à un administrateur de renvoyer l'invitation",
      );
    }

    return { prenom: utilisateur.prenom, email: utilisateur.email };
  },

  async activerCompte(tokenBrut: string, motDePasse: string) {
    const utilisateur = await utilisateurRepository.findByTokenInvitation(hacherCode(tokenBrut));

    if (!utilisateur || !utilisateur.actif || utilisateur.motDePasse) {
      throw new ValidationError("Lien d'invitation invalide ou déjà utilisé");
    }
    if (!utilisateur.tokenInvitationExpire || utilisateur.tokenInvitationExpire < new Date()) {
      throw new ValidationError(
        "Ce lien d'invitation a expiré — demandez à un administrateur de renvoyer l'invitation",
      );
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, env.BCRYPT_SALT_ROUNDS);

    // Le token est consommé : l'activation ne peut pas être rejouée.
    const active = await utilisateurRepository.update(utilisateur.id, {
      motDePasse: motDePasseHash,
      tokenInvitation: null,
      tokenInvitationExpire: null,
    });

    // Auto-connexion : l'invité arrive directement sur son espace.
    const token = signToken({ sub: active.id, role: active.role });
    return { utilisateur: toPublicUser(active), token };
  },

  async profil(userId: number) {
    const utilisateur = await utilisateurRepository.findById(userId);
    if (!utilisateur) {
      throw new UnauthorizedError('Utilisateur introuvable');
    }
    return toPublicUser(utilisateur);
  },

  async mettreAJourProfil(userId: number, input: MiseAJourProfilInput) {
    const utilisateur = await utilisateurRepository.update(userId, input);
    return toPublicUser(utilisateur);
  },

  async changerMotDePasse(userId: number, input: ChangementMotDePasseInput) {
    const utilisateur = await utilisateurRepository.findById(userId);
    if (!utilisateur?.motDePasse) {
      throw new UnauthorizedError('Utilisateur introuvable');
    }

    const motDePasseValide = await bcrypt.compare(input.motDePasseActuel, utilisateur.motDePasse);
    if (!motDePasseValide) {
      throw new UnauthorizedError('Mot de passe actuel incorrect');
    }

    const motDePasseHash = await bcrypt.hash(input.nouveauMotDePasse, env.BCRYPT_SALT_ROUNDS);
    await utilisateurRepository.update(userId, { motDePasse: motDePasseHash });
  },

  // ── Étape 1 : demande de code ──────────────────────────────────────────────
  // Choix produit assumé (voir cahier des charges de la refonte auth) : on
  // indique explicitement si l'email n'existe pas. Aucun e-mail n'est alors
  // envoyé. Le rate limiting par IP limite l'énumération de comptes.
  async demanderCodeReinitialisation(email: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);

    if (!utilisateur || !utilisateur.actif) {
      throw new NotFoundError('Aucun compte n\'est associé à cette adresse e-mail');
    }

    // Un compte invité n'a pas encore de mot de passe à réinitialiser.
    if (!utilisateur.motDePasse) {
      throw new ValidationError(MESSAGE_COMPTE_NON_ACTIVE);
    }

    // Anti-spam : un seul code par minute et par compte.
    if (utilisateur.codeReinitialisationEmis) {
      const depuisMs = Date.now() - utilisateur.codeReinitialisationEmis.getTime();
      const resteS = COOLDOWN_RENVOI_SECONDES - Math.floor(depuisMs / 1000);
      if (resteS > 0) {
        throw new TooManyRequestsError(
          `Un code vient d'être envoyé — patientez ${resteS} s avant d'en redemander un`,
        );
      }
    }

    // Code à 6 chiffres cryptographiquement aléatoire (000000–999999).
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await utilisateurRepository.update(utilisateur.id, {
      codeReinitialisation: hacherCode(code),
      codeReinitialisationExpire: new Date(Date.now() + VALIDITE_CODE_MINUTES * 60_000),
      codeReinitialisationEmis: new Date(),
      codeReinitialisationTentatives: 0,
    });

    try {
      await emailService.envoyerCodeReinitialisation(utilisateur.email, code, VALIDITE_CODE_MINUTES);
    } catch (err) {
      // Échec d'envoi : on invalide le code pour ne pas laisser un secret orphelin.
      await utilisateurRepository.update(utilisateur.id, {
        codeReinitialisation: null,
        codeReinitialisationExpire: null,
        codeReinitialisationEmis: null,
        codeReinitialisationTentatives: 0,
      });
      throw err instanceof AppError
        ? err
        : new AppError(502, "L'envoi de l'e-mail a échoué. Réessayez dans quelques instants.");
    }
  },

  // ── Étape 2 : vérification du code (sans le consommer) ────────────────────
  async verifierCodeReinitialisation(email: string, code: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);
    if (!utilisateur || !utilisateur.actif) {
      throw new NotFoundError('Aucun compte n\'est associé à cette adresse e-mail');
    }
    await validerCodeOtp(utilisateur, code);
  },

  // ── Étape 3 : réinitialisation (revalide le code puis l'invalide) ─────────
  async reinitialiserMotDePasse(email: string, code: string, nouveauMotDePasse: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);
    if (!utilisateur || !utilisateur.actif) {
      throw new NotFoundError('Aucun compte n\'est associé à cette adresse e-mail');
    }

    await validerCodeOtp(utilisateur, code);

    const motDePasseHash = await bcrypt.hash(nouveauMotDePasse, env.BCRYPT_SALT_ROUNDS);

    // Invalidation immédiate : un code utilisé ne peut jamais être rejoué.
    await utilisateurRepository.update(utilisateur.id, {
      motDePasse: motDePasseHash,
      codeReinitialisation: null,
      codeReinitialisationExpire: null,
      codeReinitialisationEmis: null,
      codeReinitialisationTentatives: 0,
    });
  },
};

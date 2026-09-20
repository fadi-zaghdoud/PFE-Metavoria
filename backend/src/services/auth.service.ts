import { randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { sha256Hex } from '../utils/hash';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { refreshTokenRepository } from '../repositories/refreshToken.repository';
import { emailService } from './email.service';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../utils/AppError';
import {
  estConfigure,
  supprimerCloudinary,
  TRANSFORMATION_AVATAR,
  uploaderBuffer,
} from '../config/cloudinary';
import { toPublicUser } from '../utils/toPublicUser';
import { logAudit } from '../utils/logger';
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

// Jeton d'accès JWT de courte durée (ACCESS_TOKEN_TTL). Algorithme épinglé (HS256).
function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

// Refresh token opaque : seul son hash SHA-256 est stocké, le secret n'est
// renvoyé qu'au client (cookie httpOnly).
async function creerRefreshToken(utilisateurId: number): Promise<string> {
  const brut = randomBytes(32).toString('hex');
  const expireLe = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await refreshTokenRepository.create({ utilisateurId, tokenHash: sha256Hex(brut), expireLe });
  return brut;
}

// Émet une session : access token court + refresh token rotatif.
async function emettreSession(utilisateur: { id: number; role: Role }) {
  const accessToken = signAccessToken({ sub: utilisateur.id, role: utilisateur.role });
  const refreshToken = await creerRefreshToken(utilisateur.id);
  return { accessToken, refreshToken };
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

// Nom affichable, copie dans le journal d'audit : c'est le nom D'EPOQUE, qui doit rester
// lisible meme apres la suppression du compte.
function nomComplet(u: { prenom: string; nom: string }): string {
  return `${u.prenom} ${u.nom}`;
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

    const session = await emettreSession(utilisateur);
    return { utilisateur: toPublicUser(utilisateur), ...session };
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

    // TRAÇABILITÉ DES ÉCHECS (§7) — le signal de sécurité le plus utile : cinq refus
    // depuis la même adresse en une minute est une tentative de force brute, qu'aucune
    // journalisation console ne pouvait rendre lisible.
    //
    // ⚠️ CONTRAINTE ABSOLUE : les réponses HTTP ne changent PAS. Cette méthode masque
    // délibérément l'existence d'un e-mail — comparaison bcrypt systématique contre un
    // hash factice (anti-timing) et message identique pour « compte inconnu » et « mot de
    // passe faux ». Les trois modes d'échec sont distingués DANS LE JOURNAL, jamais dans
    // la réponse : l'administrateur voit la différence, l'attaquant ne la voit pas.
    //
    // L'acteur est passé explicitement : à la connexion, aucun jeton n'a encore été
    // vérifié, le contexte ne porte donc aucune identité. `id` est l'identité CONFIRMÉE
    // (null si le compte n'existe pas), `nom` l'identité PRÉSENTÉE (l'e-mail saisi).
    const acteurTente = {
      id: utilisateur?.id ?? null,
      nom: utilisateur ? nomComplet(utilisateur) : input.email,
    };
    const echec = (motif: string) =>
      logAudit(
        'CONNEXION_ECHEC',
        { emailTente: input.email, motif, compteExistant: utilisateur !== null },
        { resultat: 'ECHEC', acteur: acteurTente, cible: { type: 'UTILISATEUR', id: utilisateur?.id ?? null } },
      );

    if (utilisateur && !utilisateur.motDePasse) {
      echec('COMPTE_NON_ACTIVE');
      throw new ForbiddenError(MESSAGE_COMPTE_NON_ACTIVE);
    }

    if (!utilisateur || !motDePasseValide) {
      // Deux situations distinctes derrière une réponse volontairement identique.
      echec(utilisateur ? 'MOT_DE_PASSE_INVALIDE' : 'COMPTE_INEXISTANT');
      throw new UnauthorizedError('Email ou mot de passe incorrect');
    }

    if (!utilisateur.actif) {
      echec('COMPTE_DESACTIVE');
      throw new ForbiddenError('Ce compte a été désactivé — contactez un administrateur');
    }

    // Nettoie les sessions obsolètes puis émet une session courte + refresh rotatif.
    await refreshTokenRepository.supprimerObsoletes(utilisateur.id);
    const session = await emettreSession(utilisateur);
    logAudit(
      'CONNEXION',
      { email: utilisateur.email, role: utilisateur.role },
      { acteur: acteurTente, cible: { type: 'UTILISATEUR', id: utilisateur.id } },
    );
    return { utilisateur: toPublicUser(utilisateur), ...session };
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

    logAudit(
      'COMPTE_ACTIVE',
      { utilisateurId: active.id, email: active.email },
      { acteur: { id: active.id, nom: nomComplet(active) } },
    );

    // Auto-connexion : l'invité arrive directement sur son espace.
    const session = await emettreSession(active);
    return { utilisateur: toPublicUser(active), ...session };
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

  // Photo de profil — strictement self-service : l'identifiant vient du jeton, jamais
  // du corps de la requête, donc personne ne peut changer la photo d'un autre compte.
  // Volontairement HORS journal d'audit : celui-ci trace les actions d'administration et
  // de sécurité ; y verser un changement d'avatar diluerait ce signal.
  async televerserPhoto(
    userId: number,
    fichier: { buffer: Buffer; mimetype: string; size: number },
  ) {
    if (!estConfigure()) {
      throw new ValidationError("Le stockage des images n'est pas configuré");
    }
    const precedent = await utilisateurRepository.findById(userId);
    if (!precedent) throw new UnauthorizedError('Utilisateur introuvable');

    // Même traitement d'erreur que les pièces jointes : une panne du service externe
    // ressort en 502 explicite plutôt qu'en 500 opaque.
    let stockage: { url: string; publicId: string };
    try {
      stockage = await uploaderBuffer(
        fichier.buffer,
        'smart-ticketing/avatars',
        'image',
        TRANSFORMATION_AVATAR,
      );
    } catch (err) {
      console.error(
        '[PhotoProfil] upload Cloudinary échoué :',
        err instanceof Error ? err.message : err,
      );
      throw new AppError(502, "L'envoi de la photo a échoué (réessayez plus tard).");
    }

    const utilisateur = await utilisateurRepository.update(userId, {
      photoUrl: stockage.url,
      photoCloudinaryId: stockage.publicId,
    });

    // L'ancienne image n'est détruite qu'APRÈS l'enregistrement de la nouvelle : si la
    // mise à jour échouait, la photo encore référencée en base existerait toujours.
    if (precedent.photoCloudinaryId) {
      await supprimerCloudinary(precedent.photoCloudinaryId);
    }
    return toPublicUser(utilisateur);
  },

  async supprimerPhoto(userId: number) {
    const precedent = await utilisateurRepository.findById(userId);
    if (!precedent) throw new UnauthorizedError('Utilisateur introuvable');

    const utilisateur = await utilisateurRepository.update(userId, {
      photoUrl: null,
      photoCloudinaryId: null,
    });
    if (precedent.photoCloudinaryId) {
      await supprimerCloudinary(precedent.photoCloudinaryId);
    }
    // L'interface retombe d'elle-même sur les initiales sur fond coloré.
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
  // Réponse TOUJOURS générique (anti-énumération) : que le compte existe ou non,
  // qu'il soit invité (sans mot de passe) ou en cooldown, l'appelant reçoit la
  // même réponse. Aucune information sur l'existence du compte ne fuit.
  async demanderCodeReinitialisation(email: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);

    // Pas de compte actif disposant d'un mot de passe à réinitialiser → on ne
    // fait rien, en silence (sans révéler l'inexistence ou l'état « invité »).
    if (!utilisateur || !utilisateur.actif || !utilisateur.motDePasse) return;

    // Anti-spam : un seul code par minute et par compte (appliqué en silence).
    if (utilisateur.codeReinitialisationEmis) {
      const depuisMs = Date.now() - utilisateur.codeReinitialisationEmis.getTime();
      if (depuisMs < COOLDOWN_RENVOI_SECONDES * 1000) return;
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
      // Échec d'envoi : on invalide le code orphelin et on journalise, mais on ne
      // remonte PAS l'erreur au client — sinon l'échec ne surviendrait que pour un
      // compte existant, ce qui révélerait son existence.
      await utilisateurRepository.update(utilisateur.id, {
        codeReinitialisation: null,
        codeReinitialisationExpire: null,
        codeReinitialisationEmis: null,
        codeReinitialisationTentatives: 0,
      });
      console.error('Échec envoi code de réinitialisation :', err);
    }
  },

  // ── Étape 2 : vérification du code (sans le consommer) ────────────────────
  async verifierCodeReinitialisation(email: string, code: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);
    if (!utilisateur || !utilisateur.actif) {
      // Ne révèle pas l'inexistence du compte : même message qu'un code invalide.
      throw new ValidationError('Code incorrect ou expiré — demandez un nouveau code');
    }
    await validerCodeOtp(utilisateur, code);
  },

  // ── Étape 3 : réinitialisation (revalide le code puis l'invalide) ─────────
  async reinitialiserMotDePasse(email: string, code: string, nouveauMotDePasse: string) {
    const utilisateur = await utilisateurRepository.findByEmail(email);
    if (!utilisateur || !utilisateur.actif) {
      throw new ValidationError('Code incorrect ou expiré — demandez un nouveau code');
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

    // Un changement de mot de passe révoque toutes les sessions existantes.
    await refreshTokenRepository.revokeAllForUser(utilisateur.id);

    logAudit(
      'MOT_DE_PASSE_REINITIALISE',
      { utilisateurId: utilisateur.id, email: utilisateur.email },
      { acteur: { id: utilisateur.id, nom: nomComplet(utilisateur) } },
    );
  },

  // ── Rotation du refresh token ──────────────────────────────────────────────
  // Valide le refresh token, le révoque (rotation) et émet une nouvelle session.
  // Réutilisation d'un jeton déjà tourné = vol probable → révocation globale.
  async rafraichir(refreshBrut: string) {
    const existant = await refreshTokenRepository.findByHash(sha256Hex(refreshBrut));
    if (!existant) {
      throw new UnauthorizedError('Session invalide — reconnectez-vous', 'TOKEN_INVALIDE');
    }
    if (existant.revoke) {
      // Détection de réutilisation : par précaution, on coupe toutes les sessions.
      await refreshTokenRepository.revokeAllForUser(existant.utilisateurId);
      throw new UnauthorizedError('Session invalide — reconnectez-vous', 'TOKEN_INVALIDE');
    }
    if (existant.expireLe < new Date()) {
      await refreshTokenRepository.revoke(existant.id);
      throw new UnauthorizedError('Session expirée — reconnectez-vous', 'TOKEN_INVALIDE');
    }

    const utilisateur = await utilisateurRepository.findById(existant.utilisateurId);
    if (!utilisateur || !utilisateur.actif) {
      await refreshTokenRepository.revoke(existant.id);
      throw new UnauthorizedError('Session invalide — reconnectez-vous', 'TOKEN_INVALIDE');
    }

    // Rotation : l'ancien jeton est révoqué, un nouveau est émis.
    await refreshTokenRepository.revoke(existant.id);
    const session = await emettreSession(utilisateur);
    return { utilisateur: toPublicUser(utilisateur), ...session };
  },

  // Déconnexion : révoque le refresh token présenté (best-effort).
  async deconnecter(refreshBrut: string | null) {
    if (!refreshBrut) return;
    const existant = await refreshTokenRepository.findByHash(sha256Hex(refreshBrut));
    if (existant && !existant.revoke) {
      await refreshTokenRepository.revoke(existant.id);
      logAudit(
        'DECONNEXION',
        { utilisateurId: existant.utilisateurId },
        { cible: { type: 'UTILISATEUR', id: existant.utilisateurId } },
      );
    }
  },
};

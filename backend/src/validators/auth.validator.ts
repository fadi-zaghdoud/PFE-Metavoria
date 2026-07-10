import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Briques réutilisables — chaque règle doit exister côté backend même si le
// frontend valide déjà (la validation frontend n'est qu'un confort UX).
// ─────────────────────────────────────────────────────────────────────────────

// Lettres Unicode (accents inclus), espaces, apostrophes et traits d'union.
const REGEX_NOM = /^[\p{L}\p{M}' -]+$/u;

export const nomSchema = (libelle: string) =>
  z
    .string(`Le ${libelle} est requis`)
    .trim()
    .min(1, `Le ${libelle} est requis`)
    .max(100, `Le ${libelle} ne peut pas dépasser 100 caractères`)
    .regex(REGEX_NOM, `Le ${libelle} contient des caractères non autorisés`);

export const emailSchema = z
  .string('L\'email est requis')
  .trim()
  .toLowerCase()
  .max(254, "L'email ne peut pas dépasser 254 caractères")
  .pipe(z.email('Format d\'email invalide'));

// Politique de mot de passe : 8–128 caractères, au moins une minuscule,
// une majuscule et un chiffre.
export const motDePasseFortSchema = z
  .string('Le mot de passe est requis')
  .min(8, 'Au moins 8 caractères')
  .max(128, 'Au plus 128 caractères')
  .regex(/[a-z]/, 'Au moins une lettre minuscule')
  .regex(/[A-Z]/, 'Au moins une lettre majuscule')
  .regex(/\d/, 'Au moins un chiffre');

export const champLibreSchema = (libelle: string) =>
  z.string().trim().max(100, `Le ${libelle} ne peut pas dépasser 100 caractères`).optional();

const codeOtpSchema = z
  .string('Le code est requis')
  .trim()
  .regex(/^\d{6}$/, 'Le code doit contenir exactement 6 chiffres');

// ─────────────────────────────────────────────────────────────────────────────
// Schémas des endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const inscriptionSchema = z.object({
  nom: nomSchema('nom'),
  prenom: nomSchema('prénom'),
  email: emailSchema,
  motDePasse: motDePasseFortSchema,
  service: champLibreSchema('service'),
  poste: champLibreSchema('poste'),
});

export const connexionSchema = z.object({
  email: emailSchema,
  motDePasse: z.string('Le mot de passe est requis').min(1, 'Le mot de passe est requis').max(128),
});

export const miseAJourProfilSchema = z.object({
  nom: nomSchema('nom').optional(),
  prenom: nomSchema('prénom').optional(),
  service: champLibreSchema('service'),
  poste: champLibreSchema('poste'),
});

export const changementMotDePasseSchema = z.object({
  motDePasseActuel: z.string('Le mot de passe actuel est requis').min(1, 'Le mot de passe actuel est requis').max(128),
  nouveauMotDePasse: motDePasseFortSchema,
});

export const demandeReinitialisationSchema = z.object({
  email: emailSchema,
});

export const verificationCodeSchema = z.object({
  email: emailSchema,
  code: codeOtpSchema,
});

export const reinitialisationSchema = z.object({
  email: emailSchema,
  code: codeOtpSchema,
  nouveauMotDePasse: motDePasseFortSchema,
});

// Activation d'un compte invité (token reçu par e-mail, valable 72 h).
export const activationCompteSchema = z.object({
  token: z
    .string('Le token est requis')
    .trim()
    .regex(/^[a-f0-9]{64}$/, "Lien d'invitation invalide"),
  motDePasse: motDePasseFortSchema,
});

export type InscriptionDto = z.infer<typeof inscriptionSchema>;
export type ConnexionDto = z.infer<typeof connexionSchema>;
export type MiseAJourProfilDto = z.infer<typeof miseAJourProfilSchema>;
export type ChangementMotDePasseDto = z.infer<typeof changementMotDePasseSchema>;
export type DemandeReinitialisationDto = z.infer<typeof demandeReinitialisationSchema>;
export type VerificationCodeDto = z.infer<typeof verificationCodeSchema>;
export type ReinitialisationDto = z.infer<typeof reinitialisationSchema>;
export type ActivationCompteDto = z.infer<typeof activationCompteSchema>;

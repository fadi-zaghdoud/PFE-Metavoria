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

// Mots de passe manifestement faibles/compromis à rejeter même s'ils respectent
// la complexité formelle (ex. « Password123 »). Liste locale — aucun appel réseau.
// `TERMES_INTERDITS` est recherché en sous-chaîne (attrape « Metavoria2024! »).
const MOTS_DE_PASSE_COURANTS = new Set([
  'password1', 'password123', 'motdepasse1', 'azerty123', 'qwerty123', 'passw0rd1',
  'p@ssw0rd1', 'admin1234', 'welcome123', 'bienvenue1', 'changeme123', 'iloveyou1',
  'soleil123', 'football1', 'sunshine1', 'princess1', 'superman1', 'monkey1234',
]);
const TERMES_INTERDITS = [
  'password', 'motdepasse', 'azerty', 'qwerty', 'metavoria', 'smartticketing',
  'welcome', 'bienvenue', 'iloveyou', 'letmein', 'changeme',
];

function estMotDePasseCompromis(mdp: string): boolean {
  const bas = mdp.toLowerCase();
  if (MOTS_DE_PASSE_COURANTS.has(bas)) return true;
  if (TERMES_INTERDITS.some((terme) => bas.includes(terme))) return true;
  // Un seul caractère répété (« Aaaaaaaaaa1 » réduit à sa base).
  if (/^(.)\1+$/.test(mdp)) return true;
  // Séquences numériques ou alphabétiques triviales.
  const sequences = ['01234567890', 'abcdefghijklmnopqrstuvwxyz', 'azertyuiop', 'qwertyuiop'];
  return sequences.some((seq) => seq.includes(bas) && bas.length >= 6);
}

// Politique de mot de passe : 10–128 caractères, au moins une minuscule, une
// majuscule et un chiffre, et refus des mots de passe courants/compromis.
export const motDePasseFortSchema = z
  .string('Le mot de passe est requis')
  .min(10, 'Au moins 10 caractères')
  .max(128, 'Au plus 128 caractères')
  .regex(/[a-z]/, 'Au moins une lettre minuscule')
  .regex(/[A-Z]/, 'Au moins une lettre majuscule')
  .regex(/\d/, 'Au moins un chiffre')
  .refine((mdp) => !estMotDePasseCompromis(mdp), {
    message: 'Ce mot de passe est trop courant ou prévisible — choisissez-en un autre',
  });

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

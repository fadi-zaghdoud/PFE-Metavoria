import { z } from 'zod';
import { champLibreSchema, emailSchema, nomSchema } from './auth.validator';

const roleEnum = z.enum(['EMPLOYE', 'TECHNICIEN', 'ADMINISTRATEUR']);

// Invitation d'un collaborateur par un administrateur : le compte est créé
// sans mot de passe, l'invité le choisit lui-même via le lien reçu par e-mail.
export const invitationSchema = z.object({
  nom: nomSchema('nom'),
  prenom: nomSchema('prénom'),
  email: emailSchema,
  service: champLibreSchema('service'),
  poste: champLibreSchema('poste'),
  role: roleEnum,
});

export const listeUtilisateursQuerySchema = z.object({
  role: roleEnum.optional(),
  service: z.string().trim().optional(),
  actif: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const changerRoleSchema = z.object({
  role: roleEnum,
});

// Specialites d'un technicien : la liste COMPLETE des categories couvertes. Un tableau
// vide est valide et signifie « aucune specialite » — le technicien reste alors candidat
// aux affectations de repli.
export const specialitesSchema = z.object({
  categorieIds: z.array(z.number().int().positive()).max(50),
});

export const changerStatutActifSchema = z.object({
  actif: z.boolean(),
});

export type ListeUtilisateursQueryDto = z.infer<typeof listeUtilisateursQuerySchema>;
export type ChangerRoleDto = z.infer<typeof changerRoleSchema>;
export type ChangerStatutActifDto = z.infer<typeof changerStatutActifSchema>;
export type SpecialitesDto = z.infer<typeof specialitesSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;

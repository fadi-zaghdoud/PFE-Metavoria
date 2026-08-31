import { z } from 'zod';

// CRUD des catégories (Phase A, admin). Le nom est unique (contrainte DB) ; la description
// est facultative. Longueurs bornées comme les autres entrées métier (surface d'attaque).

const nom = z
  .string('Le nom est requis')
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères')
  .max(50, 'Le nom ne peut pas dépasser 50 caractères');

const description = z
  .string()
  .trim()
  .max(200, 'La description ne peut pas dépasser 200 caractères');

export const creerCategorieSchema = z.object({
  nom,
  description: description.optional(),
});

// Mise à jour partielle : nom et/ou description. Au moins un champ requis.
export const majCategorieSchema = z
  .object({
    nom: nom.optional(),
    description: description.optional(),
  })
  .refine((d) => d.nom !== undefined || d.description !== undefined, {
    message: 'Fournissez au moins un champ à modifier (nom ou description)',
  });

export type CreerCategorieDto = z.infer<typeof creerCategorieSchema>;
export type MajCategorieDto = z.infer<typeof majCategorieSchema>;

import { z } from 'zod';

export const inscriptionSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis'),
  prenom: z.string().trim().min(1, 'Le prénom est requis'),
  email: z.string().trim().email('Email invalide'),
  motDePasse: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  service: z.string().trim().optional(),
  poste: z.string().trim().optional(),
});

export const connexionSchema = z.object({
  email: z.string().trim().email('Email invalide'),
  motDePasse: z.string().min(1, 'Le mot de passe est requis'),
});

export type InscriptionDto = z.infer<typeof inscriptionSchema>;
export type ConnexionDto = z.infer<typeof connexionSchema>;

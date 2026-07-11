import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Briques réutilisables
// ─────────────────────────────────────────────────────────────────────────────

const statutEnum = z.enum(['NOUVEAU', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE']);
const prioriteEnum = z.enum(['FAIBLE', 'MOYENNE', 'HAUTE', 'CRITIQUE']);

const idPositif = z.coerce.number().int().positive();

// ─────────────────────────────────────────────────────────────────────────────
// Schémas des endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Création d'un ticket : la catégorie est facultative (elle sera suggérée
// automatiquement par l'IA en Phase 5). La priorité par défaut est MOYENNE.
export const creerTicketSchema = z.object({
  titre: z
    .string('Le titre est requis')
    .trim()
    .min(5, 'Le titre doit contenir au moins 5 caractères')
    .max(150, 'Le titre ne peut pas dépasser 150 caractères'),
  description: z
    .string('La description est requise')
    .trim()
    .min(10, 'La description doit contenir au moins 10 caractères')
    .max(5000, 'La description ne peut pas dépasser 5000 caractères'),
  categorieId: idPositif.optional(),
  priorite: prioriteEnum.optional(),
});

export const listeTicketsQuerySchema = z.object({
  statut: statutEnum.optional(),
  priorite: prioriteEnum.optional(),
  categorieId: idPositif.optional(),
  technicienId: idPositif.optional(),
  nonAssignes: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().trim().max(200).optional(),
});

export const changerStatutSchema = z.object({
  statut: statutEnum,
});

export const changerPrioriteSchema = z.object({
  priorite: prioriteEnum,
});

// technicienId null = désaffecter le ticket.
export const affectationSchema = z.object({
  technicienId: idPositif.nullable(),
});

export const commentaireSchema = z.object({
  contenu: z
    .string('Le commentaire est requis')
    .trim()
    .min(1, 'Le commentaire ne peut pas être vide')
    .max(5000, 'Le commentaire ne peut pas dépasser 5000 caractères'),
});

export const satisfactionSchema = z.object({
  note: z.coerce
    .number('La note est requise')
    .int('La note doit être un entier')
    .min(1, 'La note minimale est 1')
    .max(5, 'La note maximale est 5'),
  commentaire: z
    .string()
    .trim()
    .max(2000, 'Le commentaire ne peut pas dépasser 2000 caractères')
    .optional(),
});

export type CreerTicketDto = z.infer<typeof creerTicketSchema>;
export type ListeTicketsQueryDto = z.infer<typeof listeTicketsQuerySchema>;
export type ChangerStatutDto = z.infer<typeof changerStatutSchema>;
export type ChangerPrioriteDto = z.infer<typeof changerPrioriteSchema>;
export type AffectationDto = z.infer<typeof affectationSchema>;
export type CommentaireDto = z.infer<typeof commentaireSchema>;
export type SatisfactionDto = z.infer<typeof satisfactionSchema>;

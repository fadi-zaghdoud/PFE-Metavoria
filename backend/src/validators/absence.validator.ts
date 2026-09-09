import { z } from 'zod';
import { estJourValide } from '../services/absence.disponibilite';

// Saisie d'une absence (administration). Les dates sont des JOURS CALENDAIRES
// « YYYY-MM-DD » et non des instants : une absence est un intervalle de calendrier,
// pas un intervalle d'horodatages (voir services/absence.disponibilite.ts).

const jour = z
  .string('La date est requise')
  .trim()
  .refine(estJourValide, 'Date invalide (format attendu : AAAA-MM-JJ)');

export const motifAbsenceEnum = z.enum(['CONGE', 'MALADIE', 'FORMATION', 'AUTRE']);

const corpsAbsence = z.object({
  technicienId: z.number().int().positive('Technicien invalide'),
  dateDebut: jour,
  dateFin: jour,
  motif: motifAbsenceEnum,
  commentaire: z.string().trim().max(200, 'Le commentaire ne peut pas dépasser 200 caractères').optional(),
});

// Le seul ordre vraiment invalide. Une absence PASSÉE reste autorisée : c'est le cas le
// plus courant en pratique (« il était malade lundi, on l'apprend mardi »), et elle n'a
// aucun effet sur l'affectation, qui ne regarde que le jour courant.
const finApresDebut = (v: { dateDebut: string; dateFin: string }) => v.dateFin >= v.dateDebut;
const messageOrdre = {
  message: 'La date de fin doit être postérieure ou égale à la date de début',
  path: ['dateFin'],
};

export const creerAbsenceSchema = corpsAbsence.refine(finApresDebut, messageOrdre);

// Modification : mêmes règles, technicien non modifiable (déplacer une absence d'une
// personne à une autre n'a pas de sens — on la supprime et on la ressaisit).
export const majAbsenceSchema = corpsAbsence.omit({ technicienId: true }).refine(finApresDebut, messageOrdre);

export const filtreAbsencesSchema = z.object({
  // Fenêtre temporelle, calculée par rapport au jour courant côté serveur.
  periode: z.enum(['EN_COURS', 'A_VENIR', 'PASSEES', 'TOUTES']).optional(),
  technicienId: z.coerce.number().int().positive().optional(),
});

export type CreerAbsenceDto = z.infer<typeof creerAbsenceSchema>;
export type MajAbsenceDto = z.infer<typeof majAbsenceSchema>;
export type FiltreAbsencesDto = z.infer<typeof filtreAbsencesSchema>;

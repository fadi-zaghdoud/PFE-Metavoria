import { z } from 'zod';

// Un jour du calendrier, AAAA-MM-JJ, qui existe (« 2026-02-30 » est refusé).
const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Date invalide');

const idPositif = z.coerce.number().int().positive();

// Paramètres communs aux points d'accès du tableau de bord : la période (jours entiers en
// UTC, bornes comprises ; sans `du`, depuis le premier ticket ; sans `au`, jusqu'à
// aujourd'hui) et les filtres de /tickets/statistiques, au même sens.
export const tableauDeBordQuerySchema = z
  .object({
    du: jour.optional(),
    au: jour.optional(),
    technicienId: idPositif.optional(),
    categorieId: idPositif.optional(),
    service: z.string().trim().max(100).optional(),
  })
  .refine((q) => !q.du || !q.au || q.du <= q.au, {
    message: 'La date de début doit précéder la date de fin',
    path: ['du'],
  });

export type TableauDeBordQueryDto = z.infer<typeof tableauDeBordQuerySchema>;

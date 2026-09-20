import { z } from 'zod';

// Filtres de consultation du journal d'audit (administration).
// Toutes les bornes sont optionnelles : sans filtre, on lit les dernières entrées.
export const filtreAuditSchema = z.object({
  action: z.string().trim().max(64).optional(),
  acteurId: z.coerce.number().int().positive().optional(),
  resultat: z.enum(['SUCCES', 'ECHEC']).optional(),
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
  // Borne DURE : un journal peut devenir volumineux, et rien ne justifie qu'une requête
  // en ramène tout. 100 par défaut, 200 au maximum.
  limite: z.coerce.number().int().min(1).max(200).default(100),
  // Curseur du « charger plus » : identifiant de la DERNIÈRE ligne déjà affichée.
  avantId: z.coerce.number().int().positive().optional(),
});

export type FiltreAuditDto = z.infer<typeof filtreAuditSchema>;

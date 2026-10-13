import { apiRequest } from '../../lib/apiClient';

// Points d'accès du tableau de bord (lecture seule, agrégés en SQL côté serveur). Les
// définitions des indicateurs sont consignées au journal technique.

export type Granularite = 'jour' | 'semaine' | 'mois';

export interface PeriodeTableau {
  du: string; // AAAA-MM-JJ, inclus (jours UTC)
  au: string;
  jours: number;
  granularite: Granularite;
  precedente: { du: string; au: string } | null;
}

interface Moyenne {
  heures: number | null;
  n: number; // effectif de la moyenne
}

// `precedent` : la valeur de la période précédente, ou null si cette période n'a pas de
// données pour l'indicateur — l'interface n'affiche alors aucune variation.
export interface IndicateursTableau {
  periode: PeriodeTableau;
  resolus: { valeur: number; precedent: number | null };
  tempsResolution: Moyenne & { precedent: Moyenne | null };
  ouverts: {
    valeur: number;
    precedent: number | null;
    // Tickets ouverts AUJOURD'HUI par statut ; null si la période s'arrête avant aujourd'hui.
    statuts: { NOUVEAU: number; EN_ATTENTE: number; EN_COURS: number } | null;
  };
  priseEnCharge: Moyenne & { precedent: Moyenne | null };
}

export interface TendanceTableau {
  periode: PeriodeTableau;
  points: { debut: string; crees: number; resolus: number }[];
}

export interface FiltresTableau {
  du?: string;
  au?: string;
  categorieId?: number;
  technicienId?: number;
  service?: string;
}

function requete(filtres: FiltresTableau): string {
  const params = new URLSearchParams();
  if (filtres.du) params.set('du', filtres.du);
  if (filtres.au) params.set('au', filtres.au);
  if (filtres.categorieId) params.set('categorieId', String(filtres.categorieId));
  if (filtres.technicienId) params.set('technicienId', String(filtres.technicienId));
  if (filtres.service) params.set('service', filtres.service);
  const texte = params.toString();
  return texte ? `?${texte}` : '';
}

export const tableauDeBordApi = {
  indicateurs: (filtres: FiltresTableau, token: string) =>
    apiRequest<IndicateursTableau>(`/tableau-de-bord/indicateurs${requete(filtres)}`, { token }),
  tendance: (filtres: FiltresTableau, token: string) =>
    apiRequest<TendanceTableau>(`/tableau-de-bord/tendance${requete(filtres)}`, { token }),
};

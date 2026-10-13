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

// Module IA sur la période — réservé au support. Les effectifs accompagnent toujours les
// parts : « tranchées » = acceptées + corrigées par un technicien.
export interface IaTableau {
  periode: PeriodeTableau;
  categories: { proposees: number; tranchees: number; acceptees: number; corrigees: number; enAttente: number };
  solutions: { generees: number; abstentions: number; echecs: number };
}

export interface TicketATraiter {
  id: number;
  titre: string;
  statut: 'NOUVEAU' | 'EN_ATTENTE' | 'EN_COURS';
  priorite: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
  dateCreation: string;
  joursOuvert: number;
}

// « À traiter » : le présent, sans période.
export interface ATraiterTableau {
  ouverts: number;
  sansTechnicien: number;
  sansPriseEnCharge: { total: number; tickets: TicketATraiter[] };
  plusAnciens: { total: number; tickets: TicketATraiter[] };
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
  ia: (filtres: FiltresTableau, token: string) =>
    apiRequest<IaTableau>(`/tableau-de-bord/ia${requete(filtres)}`, { token }),
  // Sans période : seules la catégorie, le technicien et le service sont transmis.
  aTraiter: ({ categorieId, technicienId, service }: FiltresTableau, token: string) =>
    apiRequest<ATraiterTableau>(`/tableau-de-bord/a-traiter${requete({ categorieId, technicienId, service })}`, {
      token,
    }),
};

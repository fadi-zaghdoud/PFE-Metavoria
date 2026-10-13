// Périodes du tableau de bord : bornes, période précédente, granularité de la courbe.
// Fonctions PURES, testées sans base (tableauDeBord.periode.test.ts).
//
// Une période est faite de JOURS ENTIERS EN UTC, bornes comprises (« du 31/05 au 09/06 » =
// 10 jours) : c'est la convention du stockage (dates en UTC) et du point d'accès
// /tickets/statistiques, dont le tableau de bord réutilise les répartitions. La période
// précédente a la même durée et finit la veille du premier jour.

export type Granularite = 'jour' | 'semaine' | 'mois';

export interface Periode {
  du: string; // AAAA-MM-JJ, inclus
  au: string; // AAAA-MM-JJ, inclus
  jours: number;
  granularite: Granularite;
  // Absente pour « Tout » : la période commence au premier ticket, rien n'existe avant.
  precedente: { du: string; au: string } | null;
}

const JOUR_MS = 86_400_000;

// Granularité de la courbe : jusqu'à 45 jours, un point par jour ; jusqu'à un an, un point
// par semaine (du lundi) ; au-delà, un point par mois. Assez de points pour une tendance,
// pas au point d'en faire du bruit.
export const SEUIL_JOURS_QUOTIDIEN = 45;
export const SEUIL_JOURS_HEBDOMADAIRE = 366;

export const versJour = (date: Date): string => date.toISOString().slice(0, 10);
const enDate = (jour: string): Date => new Date(`${jour}T00:00:00Z`);

export function ajouterJours(jour: string, n: number): string {
  return versJour(new Date(enDate(jour).getTime() + n * JOUR_MS));
}

// Nombre de jours de `du` à `au`, bornes comprises.
export function nombreDeJours(du: string, au: string): number {
  return Math.round((enDate(au).getTime() - enDate(du).getTime()) / JOUR_MS) + 1;
}

export function granularitePour(jours: number): Granularite {
  if (jours <= SEUIL_JOURS_QUOTIDIEN) return 'jour';
  if (jours <= SEUIL_JOURS_HEBDOMADAIRE) return 'semaine';
  return 'mois';
}

// Résout la période demandée. Sans `au`, elle s'arrête aujourd'hui. Sans `du`, c'est
// « Tout » : elle part du premier ticket du périmètre (ou d'aujourd'hui s'il n'y en a
// aucun) et n'a pas de période précédente. Des bornes inversées sont refusées.
export function resoudrePeriode({
  du,
  au,
  aujourdhui,
  premierTicket,
}: {
  du?: string;
  au?: string;
  aujourdhui: string;
  premierTicket: string | null;
}): Periode {
  const fin = au ?? aujourdhui;
  const debut = du ?? (premierTicket && premierTicket <= fin ? premierTicket : fin);
  if (debut > fin) throw new RangeError('La date de début doit précéder la date de fin');
  const jours = nombreDeJours(debut, fin);
  return {
    du: debut,
    au: fin,
    jours,
    granularite: granularitePour(jours),
    precedente: du ? { du: ajouterJours(debut, -jours), au: ajouterJours(debut, -1) } : null,
  };
}

// La valeur de la période précédente n'est donnée que si cette période a des données pour
// l'indicateur — un effectif non nul. Sans elle, l'interface n'affiche pas de variation.
export function valeurPrecedente<T>(valeur: T, effectif: number): T | null {
  return effectif > 0 ? valeur : null;
}

// Heures arrondies au dixième, comme /tickets/statistiques ; null reste null.
export const arrondiHeures = (heures: number | null): number | null =>
  heures == null ? null : Math.round(heures * 10) / 10;

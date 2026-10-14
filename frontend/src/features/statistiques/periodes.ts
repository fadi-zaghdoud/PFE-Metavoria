// Périodes proposées par l'en-tête du tableau de bord, traduites en bornes (jours UTC,
// bornes comprises) — la convention du serveur, qui en déduit la période précédente et la
// granularité. « Tout » n'envoie aucune borne : le serveur part du premier ticket.

export type ChoixPeriode = '7j' | '30j' | '90j' | '12m' | 'tout' | 'dates';

export const CHOIX_PERIODE: { cle: ChoixPeriode; libelle: string; titre: string }[] = [
  { cle: '7j', libelle: '7 j', titre: '7 derniers jours' },
  { cle: '30j', libelle: '30 j', titre: '30 derniers jours' },
  { cle: '90j', libelle: '90 j', titre: '90 derniers jours' },
  { cle: '12m', libelle: '12 mois', titre: '12 derniers mois' },
  { cle: 'tout', libelle: 'Tout', titre: 'Depuis le premier ticket' },
  { cle: 'dates', libelle: 'Dates', titre: 'Choisir les dates' },
];

// 12 mois par défaut : montre toutes les données d'une base de démonstration (corpus étalé
// sur 90 jours) sans période précédente fictive. Voir le journal, « La période de
// démonstration ».
export const PERIODE_PAR_DEFAUT: ChoixPeriode = '12m';

const versJour = (d: Date) => d.toISOString().slice(0, 10);

export function aujourdhuiUtc(): string {
  return versJour(new Date());
}

function moinsJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return versJour(d);
}

export function bornesPour(
  choix: ChoixPeriode,
  dates: { du?: string; au?: string },
  aujourdhui = aujourdhuiUtc(),
): { du?: string; au?: string } {
  switch (choix) {
    case '7j':
      return { du: moinsJours(aujourdhui, 6), au: aujourdhui };
    case '30j':
      return { du: moinsJours(aujourdhui, 29), au: aujourdhui };
    case '90j':
      return { du: moinsJours(aujourdhui, 89), au: aujourdhui };
    case '12m': {
      // Du même jour un an plus tôt, exclu, à aujourd'hui inclus.
      const d = new Date(`${aujourdhui}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      d.setUTCDate(d.getUTCDate() + 1);
      return { du: versJour(d), au: aujourdhui };
    }
    case 'tout':
      return {};
    case 'dates':
      // Des bornes inversées ne partent pas : on attend que la saisie soit cohérente.
      if (dates.du && dates.au && dates.du > dates.au) return { du: dates.du, au: dates.du };
      return { du: dates.du, au: dates.au };
  }
}

// « 31 mai 2026 », « du 21 au 30 mai 2026 »… Les jours sont des dates UTC : on les affiche
// en UTC, sans quoi un fuseau négatif montrerait la veille.
export function jourLisible(jour: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...options });
}

export function intervalleLisible(du: string, au: string): string {
  if (du === au) return `le ${jourLisible(du)}`;
  return `du ${jourLisible(du)} au ${jourLisible(au)}`;
}

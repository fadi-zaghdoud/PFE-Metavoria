// Disponibilité d'un technicien à une date donnée (Chantier 1, Étape 2bis).
// Module PUR : aucun accès base, aucune horloge implicite — l'instant courant est TOUJOURS
// passé en paramètre. C'est ce qui rend le comportement aux bornes et au changement de jour
// intégralement testable (voir absence.disponibilite.test.ts).
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI UN JOUR CALENDAIRE ET NON UN TIMESTAMP
// Une absence est un INTERVALLE DE CALENDRIER, pas un intervalle d'instants. « Absent du 10
// au 20 » couvre le 20 en entier ; avec un timestamp, `dateFin = 20 à 00h00` ne couvrirait
// pas le 20 du tout. Les colonnes sont donc en `@db.Date` et toute la comparaison se fait
// sur des chaînes « YYYY-MM-DD », où l'ordre lexicographique EST l'ordre chronologique
// (y compris à cheval sur un mois ou une année). Bornes INCLUSES des deux côtés.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEUX FUSEAUX POUR DEUX QUESTIONS DIFFÉRENTES — la subtilité de ce module
//   « Quel jour sommes-nous ? »            -> FUSEAU MÉTIER (les gens vivent à Tunis).
//                                             Le serveur tourne en UTC dans Docker : à
//                                             23h30 UTC il est déjà le lendemain à Tunis,
//                                             et un `new Date()` naïf placerait le
//                                             technicien un jour en arrière.
//   « Quel jour représente cette valeur ? » -> UTC. Prisma matérialise une colonne DATE à
//                                             MINUIT UTC (vérifié : DATE '2026-08-20'
//                                             revient en 2026-08-20T00:00:00.000Z). La
//                                             relire dans le fuseau métier fonctionnerait
//                                             par chance pour un décalage positif, mais
//                                             renverrait LA VEILLE pour un décalage négatif
//                                             (America/New_York -> 2026-08-19).
// Confondre les deux est l'erreur de décalage classique. Elles ont donc deux fonctions.
// ─────────────────────────────────────────────────────────────────────────────

// Fuseau de l'entreprise. Constante volontairement NON configurable par variable
// d'environnement : une mauvaise valeur décalerait silencieusement toutes les absences,
// et ce projet n'a qu'un lieu d'exploitation.
export const FUSEAU_METIER = 'Africa/Tunis';

// Jour calendaire au format « YYYY-MM-DD », sans heure ni fuseau.
export type JourCalendaire = string;

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function estJourValide(valeur: string): boolean {
  if (!FORMAT_JOUR.test(valeur)) return false;
  // Rejette les dates syntaxiquement correctes mais inexistantes (2026-02-30, 2026-13-01) :
  // le round-trip ne redonne la même chaîne que si le jour existe réellement.
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valeur;
}

// « Quel jour sommes-nous, là où vivent les gens ? » — l'instant est passé en paramètre.
// `formatToParts` plutôt qu'un format localisé : le résultat ne dépend d'aucune locale.
export function dateDuJour(maintenant: Date, fuseau: string = FUSEAU_METIER): JourCalendaire {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(maintenant);

  const valeurDe = (type: Intl.DateTimeFormatPartTypes) =>
    parties.find((p) => p.type === type)?.value ?? '';

  return `${valeurDe('year')}-${valeurDe('month')}-${valeurDe('day')}`;
}

// « Quel jour représente cette valeur venue de la base ? » — lecture en UTC (voir en-tête).
// À utiliser à la FRONTIÈRE (dépôt/service) : le cœur de décision ne manipule que des
// `JourCalendaire`, jamais des `Date`.
export function jourDeDate(valeurBase: Date): JourCalendaire {
  return valeurBase.toISOString().slice(0, 10);
}

// Conversion inverse, pour construire un filtre Prisma sur une colonne `@db.Date`.
export function jourVersDate(jour: JourCalendaire): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Règles d'absence
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodeAbsence {
  dateDebut: JourCalendaire;
  dateFin: JourCalendaire;
}

// Bornes INCLUSES : une absence qui commence aujourd'hui compte dès aujourd'hui, et une
// absence qui finit aujourd'hui couvre encore aujourd'hui. Une absence d'un seul jour a
// `dateDebut === dateFin`.
export function estAbsentLe(periode: PeriodeAbsence, jour: JourCalendaire): boolean {
  return periode.dateDebut <= jour && jour <= periode.dateFin;
}

// Première absence couvrant `jour`, ou null. Les chevauchements étant interdits en
// écriture, il ne peut y en avoir qu'une — cette fonction n'a donc pas à arbitrer.
export function absenceCouvrant<T extends PeriodeAbsence>(
  absences: readonly T[],
  jour: JourCalendaire,
): T | null {
  return absences.find((a) => estAbsentLe(a, jour)) ?? null;
}

// Contrôle de chevauchement (règle validée : interdits pour un même technicien).
// Deux périodes se chevauchent si chacune commence avant ou le jour où l'autre finit.
// Des périodes CONTIGUËS (10-15 puis 16-20) ne se chevauchent PAS.
export function chevauchent(a: PeriodeAbsence, b: PeriodeAbsence): boolean {
  return a.dateDebut <= b.dateFin && b.dateDebut <= a.dateFin;
}

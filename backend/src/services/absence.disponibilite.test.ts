// Table de vérité de la disponibilité (Chantier 1, Étape 2bis).
// Runtime de test intégré (node:test), aucune dépendance ; fonctions PURES → aucun I/O ni DB.
// Lancer : node --import tsx --test src/services/absence.disponibilite.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUSEAU_METIER,
  absenceCouvrant,
  chevauchent,
  dateDuJour,
  estAbsentLe,
  estJourValide,
  jourDeDate,
  jourVersDate,
} from './absence.disponibilite';

// Absence de référence : du 10 au 20 août 2026 inclus.
const AOUT_10_20 = { dateDebut: '2026-08-10', dateFin: '2026-08-20' };

// ── Les 4 bornes ─────────────────────────────────────────────────────────────

test('borne — le JOUR DE DÉBUT est un jour absent (borne incluse)', () => {
  assert.equal(estAbsentLe(AOUT_10_20, '2026-08-10'), true);
});

test('borne — le JOUR DE FIN est un jour absent (borne incluse)', () => {
  assert.equal(estAbsentLe(AOUT_10_20, '2026-08-20'), true);
});

test('borne — la VEILLE du début : présent', () => {
  assert.equal(estAbsentLe(AOUT_10_20, '2026-08-09'), false);
});

test('borne — le LENDEMAIN de la fin : présent', () => {
  assert.equal(estAbsentLe(AOUT_10_20, '2026-08-21'), false);
});

test('milieu de période : absent', () => {
  assert.equal(estAbsentLe(AOUT_10_20, '2026-08-15'), true);
});

// ── Absence d'un seul jour ───────────────────────────────────────────────────

test('absence UN SEUL JOUR (début === fin) : absent ce jour-là uniquement', () => {
  const unJour = { dateDebut: '2026-08-14', dateFin: '2026-08-14' };
  assert.equal(estAbsentLe(unJour, '2026-08-14'), true);
  assert.equal(estAbsentLe(unJour, '2026-08-13'), false);
  assert.equal(estAbsentLe(unJour, '2026-08-15'), false);
});

// ── Absence passée / future ──────────────────────────────────────────────────

test('absence FUTURE : le technicien est disponible aujourd hui', () => {
  assert.equal(estAbsentLe({ dateDebut: '2026-12-01', dateFin: '2026-12-15' }, '2026-09-09'), false);
});

test('absence PASSÉE : le technicien est disponible aujourd hui', () => {
  assert.equal(estAbsentLe({ dateDebut: '2026-01-05', dateFin: '2026-01-20' }, '2026-09-09'), false);
});

// L'ordre lexicographique doit rester l'ordre chronologique à cheval sur mois et année :
// c'est ce qui autorise la comparaison de chaînes plutôt qu'un parsing de dates.
test('à cheval sur une ANNÉE : 2026-12-28 → 2027-01-03 couvre le 1er janvier', () => {
  const versAnneeSuivante = { dateDebut: '2026-12-28', dateFin: '2027-01-03' };
  assert.equal(estAbsentLe(versAnneeSuivante, '2027-01-01'), true);
  assert.equal(estAbsentLe(versAnneeSuivante, '2026-12-27'), false);
  assert.equal(estAbsentLe(versAnneeSuivante, '2027-01-04'), false);
});

// ── LE test de fuseau ────────────────────────────────────────────────────────
// Le serveur tourne en UTC dans Docker, l'entreprise vit à Tunis (UTC+1). À 23h30 UTC
// le 20 août, il est déjà 00h30 le 21 à Tunis. Un `new Date()` naïf placerait le
// technicien un jour en arrière — et le croirait absent le jour de son retour.

test('FUSEAU — 23h30 UTC le 20 août = le 21 août à Tunis', () => {
  const instant = new Date('2026-08-20T23:30:00.000Z');
  assert.equal(dateDuJour(instant, FUSEAU_METIER), '2026-08-21');
});

test('FUSEAU — le calcul naïf en UTC donne bien un jour DIFFÉRENT (le bug évité)', () => {
  const instant = new Date('2026-08-20T23:30:00.000Z');
  const naif = instant.toISOString().slice(0, 10); // ce qu'aurait donné un new Date() brut
  assert.equal(naif, '2026-08-20');
  assert.notEqual(dateDuJour(instant, FUSEAU_METIER), naif);
});

test('FUSEAU — conséquence métier : à cet instant le technicien est de retour, le calcul naïf le croirait absent', () => {
  const instant = new Date('2026-08-20T23:30:00.000Z');
  const jourReel = dateDuJour(instant, FUSEAU_METIER);
  const jourNaif = instant.toISOString().slice(0, 10);
  assert.equal(estAbsentLe(AOUT_10_20, jourReel), false); // 21 -> disponible
  assert.equal(estAbsentLe(AOUT_10_20, jourNaif), true); // 20 -> faussement absent
});

test('FUSEAU — en journée, UTC et Tunis tombent sur le même jour', () => {
  const instant = new Date('2026-08-20T09:00:00.000Z');
  assert.equal(dateDuJour(instant, FUSEAU_METIER), '2026-08-20');
});

// Prouve que la fonction est réellement pilotée par le fuseau et non codée en dur.
test('FUSEAU — la fonction suit le fuseau reçu, elle n est pas codée en dur', () => {
  const instant = new Date('2026-08-20T23:30:00.000Z');
  assert.equal(dateDuJour(instant, 'America/New_York'), '2026-08-20');
  assert.equal(dateDuJour(instant, 'Asia/Tokyo'), '2026-08-21');
});

// ── Conversions à la frontière base ──────────────────────────────────────────
// Prisma matérialise une colonne DATE à MINUIT UTC (vérifié en base) : la relecture
// doit se faire en UTC, jamais dans le fuseau métier.

test('jourDeDate lit en UTC la valeur d une colonne @db.Date', () => {
  assert.equal(jourDeDate(new Date('2026-08-20T00:00:00.000Z')), '2026-08-20');
});

test('aller-retour jourVersDate → jourDeDate stable', () => {
  for (const jour of ['2026-01-01', '2026-08-20', '2026-12-31', '2027-02-28']) {
    assert.equal(jourDeDate(jourVersDate(jour)), jour);
  }
});

test('jourVersDate produit MINUIT UTC (même matérialisation que Prisma)', () => {
  assert.equal(jourVersDate('2026-08-20').toISOString(), '2026-08-20T00:00:00.000Z');
});

// ── Validation de format ─────────────────────────────────────────────────────

test('estJourValide accepte un jour réel et rejette le reste', () => {
  assert.equal(estJourValide('2026-08-20'), true);
  assert.equal(estJourValide('2026-02-29'), false); // 2026 n'est pas bissextile
  assert.equal(estJourValide('2024-02-29'), true); // 2024 l'est
  assert.equal(estJourValide('2026-02-30'), false);
  assert.equal(estJourValide('2026-13-01'), false);
  assert.equal(estJourValide('20/08/2026'), false);
  assert.equal(estJourValide('2026-8-20'), false);
  assert.equal(estJourValide(''), false);
});

// ── absenceCouvrant ──────────────────────────────────────────────────────────

test('absenceCouvrant renvoie l absence du jour, ou null', () => {
  const absences = [
    { dateDebut: '2026-01-05', dateFin: '2026-01-20', motif: 'CONGE' },
    { dateDebut: '2026-08-10', dateFin: '2026-08-20', motif: 'MALADIE' },
  ];
  assert.equal(absenceCouvrant(absences, '2026-08-15')?.motif, 'MALADIE');
  assert.equal(absenceCouvrant(absences, '2026-08-15')?.dateFin, '2026-08-20');
  assert.equal(absenceCouvrant(absences, '2026-06-01'), null);
  assert.equal(absenceCouvrant([], '2026-08-15'), null);
});

// ── Chevauchement (règle validée : interdit pour un même technicien) ─────────

test('chevauchent — recouvrement partiel, inclusion et identité', () => {
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-18', dateFin: '2026-08-25' }), true);
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-12', dateFin: '2026-08-14' }), true);
  assert.equal(chevauchent(AOUT_10_20, AOUT_10_20), true);
});

test('chevauchent — un seul jour commun compte comme un chevauchement', () => {
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-20', dateFin: '2026-08-30' }), true);
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-01', dateFin: '2026-08-10' }), true);
});

test('chevauchent — des périodes CONTIGUËS ne se chevauchent pas', () => {
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-21', dateFin: '2026-08-30' }), false);
  assert.equal(chevauchent(AOUT_10_20, { dateDebut: '2026-08-01', dateFin: '2026-08-09' }), false);
});

test('chevauchent est symétrique', () => {
  const autre = { dateDebut: '2026-08-18', dateFin: '2026-08-25' };
  assert.equal(chevauchent(AOUT_10_20, autre), chevauchent(autre, AOUT_10_20));
});

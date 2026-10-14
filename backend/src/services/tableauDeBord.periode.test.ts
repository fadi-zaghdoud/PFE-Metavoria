// Périodes du tableau de bord : bornes, période précédente, granularité, valeur précédente.
// Runtime de test intégré (node:test) ; fonctions PURES → aucun I/O ni DB.
// Lancer : node --import tsx --test src/services/tableauDeBord.periode.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterJours,
  arrondiHeures,
  granularitePour,
  nombreDeJours,
  resoudrePeriode,
  valeurPrecedente,
} from './tableauDeBord.periode';

const AUJOURDHUI = '2026-10-12';

test('jours entiers, bornes comprises', () => {
  assert.equal(nombreDeJours('2026-05-31', '2026-06-09'), 10);
  assert.equal(nombreDeJours('2026-10-12', '2026-10-12'), 1);
  assert.equal(ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.equal(ajouterJours('2024-03-01', -1), '2024-02-29'); // année bissextile
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
});

test('période explicite : la précédente a la même durée et finit la veille', () => {
  const p = resoudrePeriode({ du: '2026-05-31', au: '2026-06-09', aujourdhui: AUJOURDHUI, premierTicket: '2026-04-16' });
  assert.deepEqual(p, {
    du: '2026-05-31',
    au: '2026-06-09',
    jours: 10,
    granularite: 'jour',
    precedente: { du: '2026-05-21', au: '2026-05-30' },
  });
});

test('sans fin : la période s’arrête aujourd’hui', () => {
  const p = resoudrePeriode({ du: '2026-10-06', aujourdhui: AUJOURDHUI, premierTicket: null });
  assert.equal(p.au, AUJOURDHUI);
  assert.equal(p.jours, 7);
  assert.deepEqual(p.precedente, { du: '2026-09-29', au: '2026-10-05' });
});

test('« Tout » : du premier ticket à aujourd’hui, sans période précédente', () => {
  const p = resoudrePeriode({ aujourdhui: AUJOURDHUI, premierTicket: '2026-04-16' });
  assert.equal(p.du, '2026-04-16');
  assert.equal(p.au, AUJOURDHUI);
  assert.equal(p.precedente, null);
  assert.equal(p.granularite, 'semaine');
});

test('« Tout » sur une base vide : un seul jour, aujourd’hui', () => {
  const p = resoudrePeriode({ aujourdhui: AUJOURDHUI, premierTicket: null });
  assert.equal(p.du, AUJOURDHUI);
  assert.equal(p.jours, 1);
  assert.equal(p.precedente, null);
});

test('bornes inversées : refusées', () => {
  assert.throws(
    () => resoudrePeriode({ du: '2026-06-10', au: '2026-06-09', aujourdhui: AUJOURDHUI, premierTicket: null }),
    RangeError,
  );
});

test('granularité : jour jusqu’à 45 jours, semaine jusqu’à un an, mois au-delà', () => {
  assert.equal(granularitePour(1), 'jour');
  assert.equal(granularitePour(45), 'jour');
  assert.equal(granularitePour(46), 'semaine');
  assert.equal(granularitePour(365), 'semaine');
  assert.equal(granularitePour(366), 'semaine');
  assert.equal(granularitePour(367), 'mois');
});

test('valeur précédente : seulement si son effectif est non nul', () => {
  assert.equal(valeurPrecedente(80, 80), 80);
  assert.equal(valeurPrecedente(51.7, 80), 51.7);
  assert.equal(valeurPrecedente(0, 0), null);
  assert.equal(valeurPrecedente(null, 0), null);
  assert.equal(valeurPrecedente(0, 12), 0); // des tickets existaient, aucun ouvert : 0 est une donnée
});

test('heures au dixième', () => {
  assert.equal(arrondiHeures(48.64), 48.6);
  assert.equal(arrondiHeures(51.65), 51.7);
  assert.equal(arrondiHeures(null), null);
});

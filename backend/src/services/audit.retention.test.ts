// Table de vérité du calcul de rétention (Chantier 2, Étape A5).
// Runtime de test intégré (node:test) ; `dateLimiteRetention` est PURE — l'instant de
// référence est un paramètre, donc le calcul est vérifiable sans horloge.
// Lancer : node --import tsx --test src/services/audit.retention.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETENTION_JOURNAL_MOIS, dateLimiteRetention } from './audit.service';

const jour = (d: Date) => d.toISOString().slice(0, 10);

test('la durée de rétention est de 12 mois', () => {
  assert.equal(RETENTION_JOURNAL_MOIS, 12);
});

test('recule de 12 mois — cas nominal', () => {
  assert.equal(jour(dateLimiteRetention(new Date('2026-09-10T12:00:00.000Z'))), '2025-09-10');
});

test('franchit correctement la frontière d année', () => {
  assert.equal(jour(dateLimiteRetention(new Date('2026-01-15T00:00:00.000Z'))), '2025-01-15');
});

// Le 29 février n'existe pas en année non bissextile : la normalisation de Date reporte
// au 1er mars. Comportement documenté plutôt que subi — il décale la limite d'un jour
// dans un sens CONSERVATEUR (on purge un jour plus tard, donc on garde un peu plus).
test('29 février — le report est conservateur, jamais destructeur', () => {
  const limite = dateLimiteRetention(new Date('2024-02-29T00:00:00.000Z'));
  assert.equal(jour(limite), '2023-03-01');
  assert.ok(limite > new Date('2023-02-28T00:00:00.000Z'));
});

test('la limite est toujours dans le passé', () => {
  for (const iso of ['2026-09-10', '2026-01-01', '2026-12-31', '2024-02-29']) {
    const maintenant = new Date(`${iso}T00:00:00.000Z`);
    assert.ok(dateLimiteRetention(maintenant) < maintenant, iso);
  }
});

test('la durée est paramétrable pour les tests, sans toucher au défaut', () => {
  assert.equal(jour(dateLimiteRetention(new Date('2026-09-10T00:00:00.000Z'), 1)), '2026-08-10');
  assert.equal(jour(dateLimiteRetention(new Date('2026-09-10T00:00:00.000Z'), 0)), '2026-09-10');
});

test('ne mute pas la date reçue', () => {
  const maintenant = new Date('2026-09-10T00:00:00.000Z');
  const copie = maintenant.getTime();
  dateLimiteRetention(maintenant);
  assert.equal(maintenant.getTime(), copie);
});

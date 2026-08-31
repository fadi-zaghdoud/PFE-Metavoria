// Table de vérité de `deriverStatut` (Phase A, Étape 3) — les 4 statuts du cycle de vie.
// Runtime de test intégré (node:test), aucune dépendance ; fonction PURE → aucun I/O ni DB.
// Lancer : node --import tsx --test src/services/categorie.statut.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriverStatut } from './categorie.statut';

const CLASSES = ['Accès', 'Autre', 'Logiciel', 'Matériel', 'Réseau'];
const SEUIL = 10;

test('ACTIVE — catégorie présente dans les classes du modèle', () => {
  assert.equal(deriverStatut('Réseau', 40, CLASSES, SEUIL), 'ACTIVE');
});

test('APPRENABLE — hors modèle mais n_labels ≥ seuil', () => {
  assert.equal(deriverStatut('Sécurité', 12, CLASSES, SEUIL), 'APPRENABLE');
});

test('EN_APPRENTISSAGE — hors modèle et n_labels < seuil', () => {
  assert.equal(deriverStatut('Sécurité', 3, CLASSES, SEUIL), 'EN_APPRENTISSAGE');
});

test('INDETERMINE — classes du modèle indisponibles (IA down, fail-safe)', () => {
  assert.equal(deriverStatut('Sécurité', 12, null, SEUIL), 'INDETERMINE');
});

// Bord : n_labels == seuil est APPRENABLE (≥, pas >).
test('APPRENABLE — n_labels == seuil (frontière inclusive)', () => {
  assert.equal(deriverStatut('Sécurité', 10, CLASSES, SEUIL), 'APPRENABLE');
});

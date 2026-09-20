// Table de vérité du registre des paramètres (Chantier 1, Étape 2).
// Runtime de test intégré (node:test), aucune dépendance ; fonctions PURES → aucun I/O ni DB.
// Lancer : node --import tsx --test src/config/parametres.registre.test.ts
//
// Ce que ces tests garantissent, et qui EST le contrat du module :
//   1. une base jamais configurée se comporte comme aujourd'hui (MANUEL) ;
//   2. une valeur corrompue ne fait pas basculer le comportement, elle avertit ;
//   3. aucune entrée, même absurde, ne lève — la lecture d'un paramètre ne peut pas
//      casser la création d'un ticket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLE_MODE_AFFECTATION,
  CLES_CONNUES,
  estCleConnue,
  interpreter,
  validerEcriture,
} from './parametres.registre';

// ── Lecture : ligne absente → défaut, sans bruit ──────────────────────────────

test('ligne absente (null) → MANUEL, origine defaut, aucun avertissement', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, null);
  assert.equal(r.valeur, 'MANUEL');
  assert.equal(r.origine, 'defaut');
  assert.equal(r.avertissement, null);
});

test('ligne absente (undefined) → MANUEL', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, undefined);
  assert.equal(r.valeur, 'MANUEL');
  assert.equal(r.origine, 'defaut');
});

// Une application jamais configurée est un état NORMAL : elle ne doit pas polluer
// les journaux. Seul un repli anormal (valeur illisible) mérite un avertissement.
test('base non configurée : aucun avertissement journalisable', () => {
  assert.equal(interpreter(CLE_MODE_AFFECTATION, null).avertissement, null);
});

// ── Lecture : valeurs valides ────────────────────────────────────────────────

test('« AUTO » → AUTO, origine stocke', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, 'AUTO');
  assert.equal(r.valeur, 'AUTO');
  assert.equal(r.origine, 'stocke');
  assert.equal(r.avertissement, null);
});

test('« MANUEL » → MANUEL, origine stocke (et non « defaut »)', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, 'MANUEL');
  assert.equal(r.valeur, 'MANUEL');
  assert.equal(r.origine, 'stocke');
});

// Tolérance en LECTURE : une valeur posée à la main en base (casse, espaces) ne doit
// pas provoquer un repli silencieux qui ferait croire à un mode inactif.
test('lecture tolérante à la casse et aux espaces : « auto » → AUTO', () => {
  assert.equal(interpreter(CLE_MODE_AFFECTATION, 'auto').valeur, 'AUTO');
});

test('lecture tolérante : «  Auto  » (espaces) → AUTO', () => {
  assert.equal(interpreter(CLE_MODE_AFFECTATION, '  Auto  ').valeur, 'AUTO');
});

// ── Lecture : valeur corrompue → défaut + avertissement, JAMAIS une exception ──

test('valeur corrompue → MANUEL, origine defaut_apres_erreur, avertissement présent', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, 'AUTOMATIQUE_TOTAL');
  assert.equal(r.valeur, 'MANUEL');
  assert.equal(r.origine, 'defaut_apres_erreur');
  assert.ok(r.avertissement, 'un avertissement doit être renvoyé');
  assert.match(r.avertissement, /AUTOMATIQUE_TOTAL/);
});

test('chaîne vide → MANUEL + avertissement (et non un mode vide)', () => {
  const r = interpreter(CLE_MODE_AFFECTATION, '');
  assert.equal(r.valeur, 'MANUEL');
  assert.equal(r.origine, 'defaut_apres_erreur');
});

// Direction du repli : le fail-safe doit ramener au comportement ACTUEL (MANUEL),
// jamais activer l'affectation automatique par accident. Règle pré-enregistrée.
test('AUCUNE entrée illisible ne peut produire AUTO (sens du fail-safe)', () => {
  const entrees = ['AUTOMATIQUE', 'auto ; DROP TABLE', '1', 'true', 'null', '{}', 'AUT0', '  '];
  for (const brut of entrees) {
    assert.equal(interpreter(CLE_MODE_AFFECTATION, brut).valeur, 'MANUEL', `entrée : « ${brut} »`);
  }
});

// ── Robustesse : aucun cas ne lève ───────────────────────────────────────────

test('aucune entrée, même absurde, ne lève', () => {
  const entrees: (string | null | undefined)[] = [
    null,
    undefined,
    '',
    '   ',
    'AUTO',
    'nimporte quoi',
    '\n\t',
    '💥',
    'A'.repeat(10_000),
  ];
  for (const brut of entrees) {
    assert.doesNotThrow(() => interpreter(CLE_MODE_AFFECTATION, brut), `entrée : « ${String(brut)} »`);
  }
});

// ── Clés ─────────────────────────────────────────────────────────────────────

test('estCleConnue reconnaît la clé du registre et rejette les autres', () => {
  assert.equal(estCleConnue(CLE_MODE_AFFECTATION), true);
  assert.equal(estCleConnue('SEUIL_CONFIANCE_IA'), false); // §6.5, pas encore au registre
  assert.equal(estCleConnue(''), false);
  assert.equal(estCleConnue('__proto__'), false); // n'hérite pas des clés d'Object
  assert.equal(estCleConnue('toString'), false);
});

test('le registre expose exactement les clés connues', () => {
  assert.deepEqual(CLES_CONNUES, [CLE_MODE_AFFECTATION]);
});

// ── Écriture : stricte, clé inconnue rejetée ─────────────────────────────────

test('écriture d\'une clé inconnue → rejetée avec un message', () => {
  const r = validerEcriture('MODE_TOTALEMENT_INVENTE', 'AUTO');
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.message : '', /inconnu/i);
});

test('écriture valide → ok, valeur sérialisée normalisée', () => {
  const r = validerEcriture(CLE_MODE_AFFECTATION, 'AUTO');
  assert.equal(r.ok, true);
  assert.equal(r.ok === true ? r.valeurSerialisee : null, 'AUTO');
});

test('écriture d\'une valeur hors domaine → rejetée (pas de repli silencieux)', () => {
  const r = validerEcriture(CLE_MODE_AFFECTATION, 'PEUT_ETRE');
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.message : '', /invalide/i);
});

// L'écriture est STRICTE là où la lecture est permissive : une valeur venue de l'API
// doit être propre, sinon l'admin croirait avoir réglé autre chose que ce qui est stocké.
test('écriture d\'un type non textuel → rejetée', () => {
  for (const valeur of [null, undefined, 42, true, {}, []]) {
    const r = validerEcriture(CLE_MODE_AFFECTATION, valeur);
    assert.equal(r.ok, false, `valeur : ${JSON.stringify(valeur)}`);
  }
});

test('validerEcriture ne lève sur aucune entrée', () => {
  assert.doesNotThrow(() => validerEcriture('', null));
  assert.doesNotThrow(() => validerEcriture('__proto__', 'AUTO'));
});

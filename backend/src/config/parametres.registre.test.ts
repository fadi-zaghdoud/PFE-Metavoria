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
  ABSTENTION_DESACTIVEE,
  BORNE_ABSTENTION_MAX,
  BORNE_ABSTENTION_MIN,
  CLE_MODE_AFFECTATION,
  CLE_SEUIL_ABSTENTION,
  CLE_SEUIL_AFFICHAGE,
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

test('estCleConnue reconnaît les clés du registre et rejette les autres', () => {
  assert.equal(estCleConnue(CLE_MODE_AFFECTATION), true);
  assert.equal(estCleConnue(CLE_SEUIL_AFFICHAGE), true); // §6.5 — entré au registre
  assert.equal(estCleConnue(CLE_SEUIL_ABSTENTION), true); // §6.5 — entré au registre
  assert.equal(estCleConnue('SEUIL_CONFIANCE_IA'), false); // nom de travail, jamais retenu
  assert.equal(estCleConnue(''), false);
  assert.equal(estCleConnue('__proto__'), false); // n'hérite pas des clés d'Object
  assert.equal(estCleConnue('toString'), false);
});

test('le registre expose exactement les clés connues', () => {
  assert.deepEqual(CLES_CONNUES, [
    CLE_MODE_AFFECTATION,
    CLE_SEUIL_AFFICHAGE,
    CLE_SEUIL_ABSTENTION,
  ]);
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

// ── Seuils IA (§6.5) — affichage ─────────────────────────────────────────────
// Le contrat est le même que pour le mode : une base non configurée doit reproduire le
// comportement livré (0,5, la valeur qui était en dur dans le frontend).

test('seuil d’affichage : ligne absente → 0,5, sans avertissement', () => {
  const r = interpreter(CLE_SEUIL_AFFICHAGE, null);
  assert.equal(r.valeur, 0.5);
  assert.equal(r.origine, 'defaut');
  assert.equal(r.avertissement, null);
});

test('seuil d’affichage : bornes 0 et 1 acceptées', () => {
  assert.equal(interpreter(CLE_SEUIL_AFFICHAGE, '0').valeur, 0);
  assert.equal(interpreter(CLE_SEUIL_AFFICHAGE, '1').valeur, 1);
});

test('seuil d’affichage : hors bornes → repli sur 0,5 + avertissement', () => {
  for (const brut of ['-0.1', '1.5', '42']) {
    const r = interpreter(CLE_SEUIL_AFFICHAGE, brut);
    assert.equal(r.valeur, 0.5, `entrée : ${brut}`);
    assert.equal(r.origine, 'defaut_apres_erreur');
    assert.ok(r.avertissement);
  }
});

test('seuil d’affichage : virgule décimale et espaces tolérés en LECTURE', () => {
  assert.equal(interpreter(CLE_SEUIL_AFFICHAGE, ' 0,35 ').valeur, 0.35);
});

test('seuil d’affichage : chaîne vide → défaut (et non 0)', () => {
  const r = interpreter(CLE_SEUIL_AFFICHAGE, '');
  assert.equal(r.valeur, 0.5);
  assert.equal(r.origine, 'defaut_apres_erreur');
});

test('seuil d’affichage : arrondi au centième', () => {
  assert.equal(interpreter(CLE_SEUIL_AFFICHAGE, '0.333333').valeur, 0.33);
});

// ── Seuils IA (§6.5) — porte d’abstention ────────────────────────────────────
// Invariant central : une base non configurée laisse la porte FERMÉE. Aucune entrée
// illisible ne doit pouvoir l’ouvrir — l’équivalent du fail-safe « jamais AUTO ».

test('porte : ligne absente → DESACTIVE (fermée), sans avertissement', () => {
  const r = interpreter(CLE_SEUIL_ABSTENTION, null);
  assert.equal(r.valeur, ABSTENTION_DESACTIVEE);
  assert.equal(r.origine, 'defaut');
  assert.equal(r.avertissement, null);
});

test('porte : « DESACTIVE » est un état du domaine, pas une erreur', () => {
  const r = interpreter(CLE_SEUIL_ABSTENTION, 'DESACTIVE');
  assert.equal(r.valeur, ABSTENTION_DESACTIVEE);
  assert.equal(r.origine, 'stocke');
  assert.equal(r.avertissement, null);
});

test('porte : lecture tolérante à la casse pour DESACTIVE', () => {
  assert.equal(interpreter(CLE_SEUIL_ABSTENTION, ' desactive ').valeur, ABSTENTION_DESACTIVEE);
});

test('porte : valeur dans les bornes → acceptée', () => {
  assert.equal(interpreter(CLE_SEUIL_ABSTENTION, '0.35').valeur, 0.35);
  assert.equal(interpreter(CLE_SEUIL_ABSTENTION, String(BORNE_ABSTENTION_MIN)).valeur, 0.05);
  assert.equal(interpreter(CLE_SEUIL_ABSTENTION, String(BORNE_ABSTENTION_MAX)).valeur, 0.95);
});

test('porte : 0 et 1 REFUSÉS (réglages dégénérés) → repli sur fermée', () => {
  for (const brut of ['0', '1']) {
    const r = interpreter(CLE_SEUIL_ABSTENTION, brut);
    assert.equal(r.valeur, ABSTENTION_DESACTIVEE, `entrée : ${brut}`);
    assert.equal(r.origine, 'defaut_apres_erreur');
  }
});

test('AUCUNE entrée illisible ne peut OUVRIR la porte (fail-safe)', () => {
  const entrees = ['', '   ', 'oui', 'true', 'ACTIVE', '-1', '2', 'NaN', 'Infinity', '0x10', '<script>'];
  for (const brut of entrees) {
    assert.equal(
      interpreter(CLE_SEUIL_ABSTENTION, brut).valeur,
      ABSTENTION_DESACTIVEE,
      `entrée : « ${brut} »`,
    );
  }
});

test('porte : aucune entrée, même absurde, ne lève', () => {
  const entrees = [null, undefined, '', '   ', '\u0000', 'DESACTIVE'.repeat(100), '0.5'];
  for (const brut of entrees) {
    assert.doesNotThrow(() => interpreter(CLE_SEUIL_ABSTENTION, brut as string | null));
  }
});

// ── Écriture des seuils : stricte ────────────────────────────────────────────

test('écriture : seuils valides acceptés et sérialisés', () => {
  const a = validerEcriture(CLE_SEUIL_AFFICHAGE, '0.35');
  assert.equal(a.ok && a.valeurSerialisee, '0.35');
  const b = validerEcriture(CLE_SEUIL_ABSTENTION, '0.4');
  assert.equal(b.ok && b.valeurSerialisee, '0.4');
  const c = validerEcriture(CLE_SEUIL_ABSTENTION, 'DESACTIVE');
  assert.equal(c.ok && c.valeurSerialisee, ABSTENTION_DESACTIVEE);
});

test('écriture : seuil hors bornes REJETÉ, pas de repli silencieux', () => {
  for (const [cle, valeur] of [
    [CLE_SEUIL_AFFICHAGE, '1.2'],
    [CLE_SEUIL_ABSTENTION, '0'],
    [CLE_SEUIL_ABSTENTION, '0.99'],
    [CLE_SEUIL_ABSTENTION, 'peut-etre'],
  ] as const) {
    const r = validerEcriture(cle, valeur);
    assert.equal(r.ok, false, `${cle} = ${valeur}`);
  }
});

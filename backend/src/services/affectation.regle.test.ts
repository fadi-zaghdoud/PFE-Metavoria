// Table de vérité de la règle d'affectation (Chantier 1, Étape 3).
// Runtime de test intégré (node:test), aucune dépendance ; fonction PURE → aucun I/O ni DB.
// Lancer : node --import tsx --test src/services/affectation.regle.test.ts
//
// Couvre les replis pré-enregistrés R1→R5 et R8, les 3 rangs de départage pris isolément,
// et les 3 motifs de repli. La règle est reproductible : mêmes entrées, même sortie,
// quel que soit l'ordre de la liste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirTechnicien, type CandidatAffectation } from './affectation.regle';

const RESEAU = 1;
const LOGICIEL = 2;
const MATERIEL = 3;

// Fabrique de candidat : disponible, sans spécialité, charge nulle, jamais servi.
function candidat(over: Partial<CandidatAffectation> & { id: number }): CandidatAffectation {
  return {
    categories: [],
    charge: 0,
    dernierTicketAssigne: null,
    absenceEnCours: null,
    ...over,
  };
}

const ABSENT = { dateFin: '2026-08-20' };

// ── R4 / R8 : aucune affectation possible ────────────────────────────────────

test('R4 — aucun technicien actif : pas d affectation, raison AUCUN_TECHNICIEN', () => {
  const r = choisirTechnicien([], RESEAU);
  assert.equal(r.affecte, false);
  assert.equal(r.affecte === false ? r.raison : null, 'AUCUN_TECHNICIEN');
});

test('R4 — liste vide et catégorie inconnue : même raison', () => {
  const r = choisirTechnicien([], null);
  assert.equal(r.affecte === false ? r.raison : null, 'AUCUN_TECHNICIEN');
});

test('R8 — TOUS les techniciens absents : pas d affectation, raison TOUS_ABSENTS', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, absenceEnCours: ABSENT }),
      candidat({ id: 2, absenceEnCours: ABSENT, categories: [RESEAU] }),
    ],
    RESEAU,
  );
  assert.equal(r.affecte, false);
  assert.equal(r.affecte === false ? r.raison : null, 'TOUS_ABSENTS');
});

// R4 et R8 rendent tous deux « pas d affectation », mais pas pour la même raison :
// l administrateur doit pouvoir distinguer « je n ai pas de technicien » de
// « ils sont tous en congé ».
test('R4 et R8 sont distingués, pas confondus', () => {
  const r4 = choisirTechnicien([], RESEAU);
  const r8 = choisirTechnicien([candidat({ id: 1, absenceEnCours: ABSENT })], RESEAU);
  assert.notEqual(
    r4.affecte === false ? r4.raison : null,
    r8.affecte === false ? r8.raison : null,
  );
});

// ── R1 / R2 : catégorie inexploitable → repli sur la charge seule ────────────
// R1 (IA indisponible) et R2 (confiance sous le seuil) arrivent ici sous la même forme :
// `categorieId = null`. L arbitrage confiance/seuil appartient à l appelant.

test('R1/R2 — catégorie null : repli sur la charge, motif REPLI_CHARGE', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 5, categories: [RESEAU] }),
      candidat({ id: 2, charge: 2 }),
      candidat({ id: 3, charge: 9 }),
    ],
    null,
  );
  assert.equal(r.affecte, true);
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
  assert.equal(r.affecte === true ? r.motif : null, 'REPLI_CHARGE');
});

// ── R5 / cas nominal : la catégorie sélectionne le spécialiste ───────────────
// R5 (le demandeur a choisi sa catégorie) et le cas nominal (catégorie suggérée par l IA
// au-dessus du seuil) arrivent ici sous la même forme : un `categorieId` non nul.

test('nominal — un spécialiste disponible est retenu, motif SPECIALITE', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 0 }),
      candidat({ id: 2, charge: 3, categories: [RESEAU] }),
      candidat({ id: 3, charge: 1, categories: [LOGICIEL] }),
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
  assert.equal(r.affecte === true ? r.motif : null, 'SPECIALITE');
});

test('nominal — entre plusieurs spécialistes, le moins chargé gagne', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 7, categories: [RESEAU] }),
      candidat({ id: 2, charge: 2, categories: [RESEAU] }),
      candidat({ id: 3, charge: 4, categories: [RESEAU] }),
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

test('un technicien couvrant PLUSIEURS catégories est éligible à chacune', () => {
  const polyvalent = candidat({ id: 1, categories: [RESEAU, LOGICIEL, MATERIEL] });
  for (const cat of [RESEAU, LOGICIEL, MATERIEL]) {
    const r = choisirTechnicien([polyvalent], cat);
    assert.equal(r.affecte === true ? r.motif : null, 'SPECIALITE', `catégorie ${cat}`);
  }
});

// LA SPÉCIALITÉ EST UN FILTRE DUR, PAS UN BONUS — conséquence assumée de la règle :
// un spécialiste chargé passe devant un généraliste inoccupé.
test('la spécialité prime sur la charge : un spécialiste chargé bat un généraliste à 0', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 0 }), // inoccupé mais non spécialiste
      candidat({ id: 2, charge: 12, categories: [RESEAU] }), // spécialiste très chargé
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

// ── R3 : aucun spécialiste pour cette catégorie ─────────────────────────────

test('R3 — personne ne couvre la catégorie : repli, motif REPLI_AUCUN_SPECIALISTE', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 5, categories: [LOGICIEL] }),
      candidat({ id: 2, charge: 1, categories: [MATERIEL] }),
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
  assert.equal(r.affecte === true ? r.motif : null, 'REPLI_AUCUN_SPECIALISTE');
});

test('R3 — aucune spécialité renseignée nulle part : repli également', () => {
  const r = choisirTechnicien([candidat({ id: 1 }), candidat({ id: 2, charge: 3 })], RESEAU);
  assert.equal(r.affecte === true ? r.technicienId : null, 1);
  assert.equal(r.affecte === true ? r.motif : null, 'REPLI_AUCUN_SPECIALISTE');
});

// ── Tous les spécialistes absents ───────────────────────────────────────────
// Cas qui ne demande AUCUNE branche dédiée : l absence étant filtrée avant la spécialité,
// le pool de spécialistes disponibles est vide et l on retombe sur le repli. Seul le
// motif distingue la situation.

test('tous les spécialistes absents : repli, motif REPLI_SPECIALISTES_ABSENTS', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 0, categories: [RESEAU], absenceEnCours: ABSENT }),
      candidat({ id: 2, charge: 0, categories: [RESEAU], absenceEnCours: ABSENT }),
      candidat({ id: 3, charge: 6 }), // généraliste disponible
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 3);
  assert.equal(r.affecte === true ? r.motif : null, 'REPLI_SPECIALISTES_ABSENTS');
});

test('un seul spécialiste absent sur deux : l autre spécialiste est retenu', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 0, categories: [RESEAU], absenceEnCours: ABSENT }),
      candidat({ id: 2, charge: 8, categories: [RESEAU] }),
      candidat({ id: 3, charge: 0 }),
    ],
    RESEAU,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
  assert.equal(r.affecte === true ? r.motif : null, 'SPECIALITE');
});

// Les deux motifs de repli hors spécialité doivent être DISTINGUÉS : c est tout leur
// intérêt pour le diagnostic de l administrateur.
test('REPLI_SPECIALISTES_ABSENTS et REPLI_AUCUN_SPECIALISTE ne sont pas confondus', () => {
  const absents = choisirTechnicien(
    [
      candidat({ id: 1, categories: [RESEAU], absenceEnCours: ABSENT }),
      candidat({ id: 2 }),
    ],
    RESEAU,
  );
  const aucun = choisirTechnicien([candidat({ id: 1 }), candidat({ id: 2 })], RESEAU);
  assert.equal(absents.affecte === true ? absents.motif : null, 'REPLI_SPECIALISTES_ABSENTS');
  assert.equal(aucun.affecte === true ? aucun.motif : null, 'REPLI_AUCUN_SPECIALISTE');
});

test('les 3 motifs de repli sont bien trois valeurs distinctes', () => {
  const charge = choisirTechnicien([candidat({ id: 1 })], null);
  const absents = choisirTechnicien(
    [candidat({ id: 1, categories: [RESEAU], absenceEnCours: ABSENT }), candidat({ id: 2 })],
    RESEAU,
  );
  const aucun = choisirTechnicien([candidat({ id: 1 })], RESEAU);
  const motifs = [charge, absents, aucun].map((r) => (r.affecte === true ? r.motif : null));
  assert.deepEqual(motifs, ['REPLI_CHARGE', 'REPLI_SPECIALISTES_ABSENTS', 'REPLI_AUCUN_SPECIALISTE']);
  assert.equal(new Set(motifs).size, 3);
});

// ── Rang 1 isolé : la charge ─────────────────────────────────────────────────

test('rang 1 — à spécialité et ancienneté égales, la charge décide', () => {
  const meme = new Date('2026-08-01T10:00:00.000Z');
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 4, dernierTicketAssigne: meme }),
      candidat({ id: 2, charge: 1, dernierTicketAssigne: meme }),
      candidat({ id: 3, charge: 2, dernierTicketAssigne: meme }),
    ],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

test('rang 1 — un technicien à charge 0 est bien éligible (les inoccupés d abord)', () => {
  const r = choisirTechnicien(
    [candidat({ id: 1, charge: 3 }), candidat({ id: 2, charge: 0 })],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

// ── Rang 2 isolé : l ancienneté, à charge ÉGALE ─────────────────────────────

test('rang 2 — charge égale : le moins récemment servi gagne', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 3, dernierTicketAssigne: new Date('2026-08-19T10:00:00.000Z') }),
      candidat({ id: 2, charge: 3, dernierTicketAssigne: new Date('2026-08-02T10:00:00.000Z') }),
      candidat({ id: 3, charge: 3, dernierTicketAssigne: new Date('2026-08-15T10:00:00.000Z') }),
    ],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

test('rang 2 — jamais servi (null) passe devant tout le monde', () => {
  const r = choisirTechnicien(
    [
      candidat({ id: 1, charge: 3, dernierTicketAssigne: new Date('2020-01-01T00:00:00.000Z') }),
      candidat({ id: 2, charge: 3, dernierTicketAssigne: null }),
    ],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

test('rang 2 — n intervient PAS si les charges diffèrent (rang 1 prioritaire)', () => {
  const r = choisirTechnicien(
    [
      // Jamais servi, mais plus chargé : la charge prime sur l ancienneté.
      candidat({ id: 1, charge: 5, dernierTicketAssigne: null }),
      candidat({ id: 2, charge: 1, dernierTicketAssigne: new Date('2026-08-19T10:00:00.000Z') }),
    ],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 2);
});

// ── Rang 3 isolé : l id, à charge ET ancienneté égales ──────────────────────

test('rang 3 — charge et ancienneté égales : le plus petit id tranche', () => {
  const meme = new Date('2026-08-10T10:00:00.000Z');
  const r = choisirTechnicien(
    [
      candidat({ id: 9, charge: 2, dernierTicketAssigne: meme }),
      candidat({ id: 4, charge: 2, dernierTicketAssigne: meme }),
      candidat({ id: 7, charge: 2, dernierTicketAssigne: meme }),
    ],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 4);
});

test('rang 3 — deux candidats jamais servis et à charge égale : id croissant', () => {
  const r = choisirTechnicien(
    [candidat({ id: 8, charge: 0 }), candidat({ id: 3, charge: 0 })],
    null,
  );
  assert.equal(r.affecte === true ? r.technicienId : null, 3);
});

// ── Déterminisme et absence d effet de bord ─────────────────────────────────

test('le résultat ne dépend pas de l ordre de la liste (ordre total)', () => {
  const meme = new Date('2026-08-10T10:00:00.000Z');
  const liste = [
    candidat({ id: 5, charge: 2, dernierTicketAssigne: meme, categories: [RESEAU] }),
    candidat({ id: 2, charge: 2, dernierTicketAssigne: meme, categories: [RESEAU] }),
    candidat({ id: 8, charge: 1, dernierTicketAssigne: meme, categories: [RESEAU] }),
  ];
  const attendu = choisirTechnicien(liste, RESEAU);
  for (const permutation of [
    [...liste].reverse(),
    [liste[1], liste[2], liste[0]],
    [liste[2], liste[0], liste[1]],
  ]) {
    assert.deepEqual(choisirTechnicien(permutation, RESEAU), attendu);
  }
});

test('la liste d entrée n est pas mutée par le tri', () => {
  const liste = [
    candidat({ id: 3, charge: 9 }),
    candidat({ id: 1, charge: 1 }),
    candidat({ id: 2, charge: 5 }),
  ];
  const ordreAvant = liste.map((c) => c.id);
  choisirTechnicien(liste, null);
  assert.deepEqual(liste.map((c) => c.id), ordreAvant);
});

test('choisirTechnicien ne lève sur aucune entrée', () => {
  assert.doesNotThrow(() => choisirTechnicien([], null));
  assert.doesNotThrow(() => choisirTechnicien([], 999));
  assert.doesNotThrow(() => choisirTechnicien([candidat({ id: 1 })], -1));
  assert.doesNotThrow(() =>
    choisirTechnicien([candidat({ id: 1, charge: Number.MAX_SAFE_INTEGER })], null),
  );
});

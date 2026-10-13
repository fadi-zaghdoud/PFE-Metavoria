// Tests d'intégration de /api/tableau-de-bord/techniciens, sur une vraie base PostgreSQL
// (voir baseDeTest.ts : la garde refuse toute base dont le nom ne finit pas par « _test »).
//
// Jeu de données — période étudiée : mars 2026. Chaque attendu se recalcule à la main :
//   A1  tech A, créé 10/02 09:00, « Résolu » le 05/03 09:00 (552 h)
//   A2  tech A, créé 02/03, en cours                         demandeur du service RH
//   A3  tech A, créé 10/03 09:00, « Résolu » le 01/04 09:00 (528 h) — ouvert à la fin de mars
//   B1  tech B, créé 01/03 08:00, clos le 03/03 08:00 SANS événement (48 h)
//   B2  tech B, créé 05/01 09:00, « Résolu » le 01/02 09:00 (648 h) — hors de mars
//   C1  tech C, créé 05/04, en attente — après mars
//   D1  tech C, créé 08/03, « Résolu » SANS aucune date de résolution
//   X1  ancien (compte désactivé), créé 04/03 09:00, « Résolu » le 06/03 09:00 (48 h)
//   X2  administrateur, créé 07/03, en cours
//   U1  sans technicien, nouveau, créé 09/03
// Comptes sans aucun ticket : un second administrateur et un second compte désactivé.
// Absences : tech B absent d'hier à dans cinq jours (motif MALADIE, avec un commentaire) ;
// tech A absent du 01/03 au 05/03, absence passée.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { jeton, lire, preparer } from './baseDeTest';
import { dateDuJour } from '../services/absence.disponibilite';
import type { Role, StatutTicket } from '../generated/prisma/enums';

interface Compte {
  id: number;
  role: Role;
}
interface Ligne {
  id: number;
  prenom: string;
  nom: string;
  ouverts: number;
  resolus: number;
  tempsResolution: { heures: number | null; n: number };
  absenceJusquau: string | null;
}
interface Techniciens {
  periode: { du: string; au: string };
  techniciens: Ligne[];
  sansActivite: number;
}

let ctx: Awaited<ReturnType<typeof preparer>>;
let admin: Compte;
let techA: Compte;
let techB: Compte;
let techC: Compte;
let ancien: Compte;
let employee: Compte;
const MARS = 'du=2026-03-01&au=2026-03-31';
// Jour métier (fuseau de l'entreprise), décalé de n jours.
const jourDecale = (n: number) => {
  const d = new Date(`${dateDuJour(new Date())}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  ctx = await preparer();
  const p = ctx.prisma;
  const compte = async (cle: string, role: Role, service: string | null, actif = true): Promise<Compte> => {
    const u = await p.utilisateur.create({
      data: { nom: cle, prenom: 'Test', email: `${cle}@test.local`, role, service, actif },
    });
    return { id: u.id, role: u.role };
  };
  admin = await compte('admin', 'ADMINISTRATEUR', null);
  await compte('admin-b', 'ADMINISTRATEUR', null);
  techA = await compte('tech-a', 'TECHNICIEN', 'Support IT');
  techB = await compte('tech-b', 'TECHNICIEN', 'Support IT');
  techC = await compte('tech-c', 'TECHNICIEN', 'Support IT');
  ancien = await compte('ancien', 'TECHNICIEN', 'Support IT', false);
  await compte('ancien-b', 'TECHNICIEN', 'Support IT', false);
  employee = await compte('employee-a', 'EMPLOYE', 'Finance');
  const employeeRh = await compte('employee-b', 'EMPLOYE', 'RH');

  const ticket = async (o: {
    cree: string;
    statut: StatutTicket;
    technicien?: number;
    demandeur?: number;
    cloture?: string;
    resolu?: string;
  }) => {
    const t = await p.ticket.create({
      data: {
        titre: 'Ticket de test',
        description: 'Description du ticket de test',
        statut: o.statut,
        dateCreation: new Date(o.cree),
        dateCloture: o.cloture ? new Date(o.cloture) : null,
        demandeurId: o.demandeur ?? employee.id,
        technicienId: o.technicien ?? null,
      },
    });
    if (o.resolu)
      await p.evenementTicket.create({
        data: { ticketId: t.id, type: 'CHANGEMENT_STATUT', nouvelleValeur: 'RESOLU', dateCreation: new Date(o.resolu) },
      });
  };
  await ticket({ cree: '2026-02-10T09:00:00Z', statut: 'RESOLU', technicien: techA.id, resolu: '2026-03-05T09:00:00Z' });
  await ticket({ cree: '2026-03-02T09:00:00Z', statut: 'EN_COURS', technicien: techA.id, demandeur: employeeRh.id });
  await ticket({ cree: '2026-03-10T09:00:00Z', statut: 'RESOLU', technicien: techA.id, resolu: '2026-04-01T09:00:00Z' });
  await ticket({ cree: '2026-03-01T08:00:00Z', statut: 'CLOTURE', technicien: techB.id, cloture: '2026-03-03T08:00:00Z' });
  await ticket({ cree: '2026-01-05T09:00:00Z', statut: 'RESOLU', technicien: techB.id, resolu: '2026-02-01T09:00:00Z' });
  await ticket({ cree: '2026-04-05T09:00:00Z', statut: 'EN_ATTENTE', technicien: techC.id });
  await ticket({ cree: '2026-03-08T09:00:00Z', statut: 'RESOLU', technicien: techC.id });
  await ticket({ cree: '2026-03-04T09:00:00Z', statut: 'RESOLU', technicien: ancien.id, resolu: '2026-03-06T09:00:00Z' });
  await ticket({ cree: '2026-03-07T09:00:00Z', statut: 'EN_COURS', technicien: admin.id });
  await ticket({ cree: '2026-03-09T09:00:00Z', statut: 'NOUVEAU' });

  const absence = (technicienId: number, debut: string, fin: string) =>
    p.absence.create({
      data: {
        technicienId,
        dateDebut: new Date(`${debut}T00:00:00Z`),
        dateFin: new Date(`${fin}T00:00:00Z`),
        motif: 'MALADIE',
        commentaire: 'Hospitalisation prévue',
        creeParId: admin.id,
      },
    });
  await absence(techB.id, jourDecale(-1), jourDecale(5));
  await absence(techA.id, '2026-03-01', '2026-03-05');
});

after(async () => {
  await ctx?.fermer();
});

const techniciens = (requete: string, compte: Compte) =>
  lire<Techniciens>(`${ctx.url}/tableau-de-bord/techniciens?${requete}`, jeton(compte));
const resume = (corps: Techniciens) =>
  corps.techniciens.map((l) => [l.id, l.ouverts, l.resolus, l.tempsResolution.heures]);

test('techniciens : actifs sur la période, les plus chargés d’abord ; les autres seulement comptés', async () => {
  const { statut, corps } = await techniciens(MARS, admin);
  assert.equal(statut, 200);
  assert.deepEqual(resume(corps), [
    [techA.id, 2, 1, 552], // A2 et A3 ouverts au 31/03 ; A1 résolu en mars
    [admin.id, 1, 0, null], // un administrateur qui détient un ticket reste visible
    [ancien.id, 0, 1, 48], // un compte désactivé, actif sur la période
    [techB.id, 0, 1, 48], // B1, clos sans événement ; B2 résolu en février
  ]);
  assert.deepEqual(corps.techniciens[0].tempsResolution, { heures: 552, n: 1 });
  // tech C : C1 créé après mars, D1 résolu sans date. Ni le second administrateur, ni le
  // second compte désactivé ne sont comptés : ce ne sont pas des comptes techniciens actifs.
  assert.equal(corps.sansActivite, 1);
});

test('techniciens : « ouverts » est le stock au dernier jour de la période', async () => {
  const { corps } = await techniciens('du=2026-01-01', admin); // jusqu'à aujourd'hui
  assert.deepEqual(resume(corps), [
    [techA.id, 1, 2, 540], // A2 ouvert ; A1 et A3 résolus (552 h et 528 h)
    [admin.id, 1, 0, null],
    [techC.id, 1, 0, null], // C1, en attente
    [techB.id, 0, 2, 348], // B1 (48 h) et B2 (648 h)
    [ancien.id, 0, 1, 48],
  ]);
  assert.equal(corps.sansActivite, 0);
});

test('techniciens : nom, effectifs et date de fin d’absence — ni e-mail, ni motif', async () => {
  const { corps } = await techniciens(MARS, admin);
  const ligneB = corps.techniciens.find((l) => l.id === techB.id);
  assert.ok(ligneB);
  assert.deepEqual(Object.keys(ligneB).sort(), [
    'absenceJusquau',
    'id',
    'nom',
    'ouverts',
    'prenom',
    'resolus',
    'tempsResolution',
  ]);
  assert.equal(ligneB.absenceJusquau, jourDecale(5));
  assert.equal(corps.techniciens.find((l) => l.id === techA.id)?.absenceJusquau, null); // absence passée
  const texte = JSON.stringify(corps);
  for (const interdit of ['@', 'MALADIE', 'motif', 'Hospitalisation']) assert.ok(!texte.includes(interdit), interdit);
});

test('techniciens : un technicien ne reçoit que sa propre ligne, quel que soit le filtre', async () => {
  const seul = await techniciens(MARS, techA);
  assert.equal(seul.statut, 200);
  assert.deepEqual(resume(seul.corps), [[techA.id, 2, 1, 552]]);
  assert.equal(seul.corps.sansActivite, 0);
  const autre = await techniciens(`${MARS}&technicienId=${techB.id}`, techA);
  assert.deepEqual(resume(autre.corps), [[techA.id, 2, 1, 552]]);
  const inactif = await techniciens(MARS, techC);
  assert.deepEqual(inactif.corps.techniciens, []);
  assert.equal(inactif.corps.sansActivite, 1);
});

test('techniciens : refusé à l’employé', async () => {
  assert.equal((await techniciens(MARS, employee)).statut, 403);
});

test('techniciens : filtres de technicien et de service', async () => {
  const b = await techniciens(`${MARS}&technicienId=${techB.id}`, admin);
  assert.deepEqual(resume(b.corps), [[techB.id, 0, 1, 48]]);
  assert.equal(b.corps.sansActivite, 0);
  const c = await techniciens(`${MARS}&technicienId=${techC.id}`, admin);
  assert.deepEqual(c.corps.techniciens, []);
  assert.equal(c.corps.sansActivite, 1);
  // Service du demandeur : seul A2 vient du service RH.
  const rh = await techniciens(`${MARS}&service=RH`, admin);
  assert.deepEqual(resume(rh.corps), [[techA.id, 1, 0, null]]);
  assert.equal(rh.corps.sansActivite, 2); // tech B et tech C
});

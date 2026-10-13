// Tests d'intégration des points d'accès /api/tableau-de-bord, sur une vraie base PostgreSQL
// (voir baseDeTest.ts : la garde refuse toute base dont le nom ne finit pas par « _test »).
// Lancer : DATABASE_URL=…/smart_ticketing_test npm run test:integration
//
// Jeu de données — période étudiée du 01/03/2026 au 10/03/2026 (10 jours), période
// précédente du 19/02 au 28/02. Chaque attendu se recalcule à la main :
//   T1  créé 02/03 10:00, « Résolu » le 03/03 10:00 (24 h)          Réseau, employée A
//   T2  créé 05/03 08:00, clos le 06/03 08:00 SANS événement (24 h)   Matériel, employée A
//   T3  créé 08/03 09:00, pris en charge à 10:00 (1 h), en cours      Réseau, employée A
//   T4  créé 20/02, « Résolu » le 22/02 (48 h)                       employée A
//   T5  créé 09/03, « Résolu » SANS aucune date de résolution         employée A
//   T6  créé 10/03 15:00, nouveau                                     Matériel, employée B (RH)
//   T7  créé 25/02, pris en charge le 26/02 (24 h), « Résolu » le 04/03 (168 h)   employée A
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { jeton, lire, preparer } from './baseDeTest';
import type { Role, StatutTicket } from '../generated/prisma/enums';

interface Compte {
  id: number;
  role: Role;
}
interface Indicateurs {
  periode: { du: string; au: string; jours: number; granularite: string; precedente: { du: string; au: string } | null };
  resolus: { valeur: number; precedent: number | null };
  tempsResolution: { heures: number | null; n: number; precedent: { heures: number | null; n: number } | null };
  ouverts: { valeur: number; precedent: number | null; statuts: Record<string, number> | null };
  priseEnCharge: { heures: number | null; n: number; precedent: { heures: number | null; n: number } | null };
}
interface Tendance {
  periode: { du: string; au: string; granularite: string };
  points: { debut: string; crees: number; resolus: number }[];
}

let ctx: Awaited<ReturnType<typeof preparer>>;
let admin: Compte;
let employeeB: Compte;
let reseau: number;
const PERIODE = 'du=2026-03-01&au=2026-03-10';

before(async () => {
  ctx = await preparer();
  const p = ctx.prisma;
  const compte = async (cle: string, role: Role, service: string | null): Promise<Compte> => {
    const u = await p.utilisateur.create({
      data: { nom: cle, prenom: 'Test', email: `${cle}@test.local`, role, service },
    });
    return { id: u.id, role: u.role };
  };
  admin = await compte('admin', 'ADMINISTRATEUR', null);
  const tech = await compte('tech', 'TECHNICIEN', 'Support IT');
  const employeeA = await compte('employee-a', 'EMPLOYE', 'Finance');
  employeeB = await compte('employee-b', 'EMPLOYE', 'RH');
  reseau = (await p.categorie.create({ data: { nom: 'Réseau' } })).id;
  const materiel = (await p.categorie.create({ data: { nom: 'Matériel' } })).id;

  const ticket = async (o: {
    cree: string;
    statut: StatutTicket;
    demandeur: number;
    categorie?: number;
    technicien?: number;
    cloture?: string;
    resolu?: string;
    pec?: string;
  }) => {
    const t = await p.ticket.create({
      data: {
        titre: 'Ticket de test',
        description: 'Description du ticket de test',
        statut: o.statut,
        dateCreation: new Date(o.cree),
        dateCloture: o.cloture ? new Date(o.cloture) : null,
        demandeurId: o.demandeur,
        categorieId: o.categorie ?? null,
        technicienId: o.technicien ?? null,
      },
    });
    if (o.pec)
      await p.evenementTicket.create({
        data: { ticketId: t.id, type: 'PRISE_EN_CHARGE', nouvelleValeur: 'EN_COURS', dateCreation: new Date(o.pec) },
      });
    if (o.resolu)
      await p.evenementTicket.create({
        data: { ticketId: t.id, type: 'CHANGEMENT_STATUT', nouvelleValeur: 'RESOLU', dateCreation: new Date(o.resolu) },
      });
  };
  await ticket({ cree: '2026-03-02T10:00:00Z', statut: 'RESOLU', demandeur: employeeA.id, categorie: reseau, technicien: tech.id, resolu: '2026-03-03T10:00:00Z' });
  await ticket({ cree: '2026-03-05T08:00:00Z', statut: 'CLOTURE', demandeur: employeeA.id, categorie: materiel, cloture: '2026-03-06T08:00:00Z' });
  await ticket({ cree: '2026-03-08T09:00:00Z', statut: 'EN_COURS', demandeur: employeeA.id, categorie: reseau, technicien: tech.id, pec: '2026-03-08T10:00:00Z' });
  await ticket({ cree: '2026-02-20T00:00:00Z', statut: 'RESOLU', demandeur: employeeA.id, resolu: '2026-02-22T00:00:00Z' });
  await ticket({ cree: '2026-03-09T12:00:00Z', statut: 'RESOLU', demandeur: employeeA.id });
  await ticket({ cree: '2026-03-10T15:00:00Z', statut: 'NOUVEAU', demandeur: employeeB.id, categorie: materiel });
  await ticket({ cree: '2026-02-25T00:00:00Z', statut: 'RESOLU', demandeur: employeeA.id, technicien: tech.id, pec: '2026-02-26T00:00:00Z', resolu: '2026-03-04T00:00:00Z' });
});

after(async () => {
  await ctx?.fermer();
});

const indicateurs = (requete: string, compte: Compte) =>
  lire<Indicateurs>(`${ctx.url}/tableau-de-bord/indicateurs?${requete}`, jeton(compte));
const tendance = (requete: string, compte: Compte) =>
  lire<Tendance>(`${ctx.url}/tableau-de-bord/tendance?${requete}`, jeton(compte));

test('sans jeton : 401', async () => {
  const { statut } = await lire(`${ctx.url}/tableau-de-bord/indicateurs?${PERIODE}`);
  assert.equal(statut, 401);
});

test('indicateurs de la période, avec ceux de la période précédente', async () => {
  const { statut, corps } = await indicateurs(PERIODE, admin);
  assert.equal(statut, 200);
  assert.deepEqual(corps.periode, {
    du: '2026-03-01',
    au: '2026-03-10',
    jours: 10,
    granularite: 'jour',
    precedente: { du: '2026-02-19', au: '2026-02-28' },
  });
  // Résolus : T1, T2 (clôture faute d'événement) et T7 ; T5 n'a pas de date ; avant : T4.
  assert.deepEqual(corps.resolus, { valeur: 3, precedent: 1 });
  // (24 + 24 + 168) / 3 = 72 h ; avant : 48 h sur T4.
  assert.deepEqual(corps.tempsResolution, { heures: 72, n: 3, precedent: { heures: 48, n: 1 } });
  // Ouverts au soir du 10/03 : T3 et T6 (T5, résolu sans date, n'est jamais ouvert) ;
  // au matin du 01/03 : T7.
  assert.deepEqual(corps.ouverts, { valeur: 2, precedent: 1, statuts: null });
  // 1re prise en charge : T3 en 1 h ; avant : T7 en 24 h.
  assert.deepEqual(corps.priseEnCharge, { heures: 1, n: 1, precedent: { heures: 24, n: 1 } });
});

test('employée : ses seuls tickets, sans valeur précédente vide', async () => {
  const { corps } = await indicateurs(PERIODE, employeeB);
  assert.deepEqual(corps.resolus, { valeur: 0, precedent: null });
  assert.deepEqual(corps.tempsResolution, { heures: null, n: 0, precedent: null });
  // Avant le 01/03, l'employée B n'avait aucun ticket : pas de stock à comparer.
  assert.deepEqual(corps.ouverts, { valeur: 1, precedent: null, statuts: null });
  assert.deepEqual(corps.priseEnCharge, { heures: null, n: 0, precedent: null });
});

test('filtres : service du demandeur et catégorie', async () => {
  const rh = await indicateurs(`${PERIODE}&service=RH`, admin);
  assert.equal(rh.corps.ouverts.valeur, 1);
  assert.equal(rh.corps.resolus.valeur, 0);
  const categorie = await indicateurs(`${PERIODE}&categorieId=${reseau}`, admin);
  assert.deepEqual(categorie.corps.resolus, { valeur: 1, precedent: null });
  assert.deepEqual(categorie.corps.tempsResolution, { heures: 24, n: 1, precedent: null });
  assert.deepEqual(categorie.corps.ouverts, { valeur: 1, precedent: null, statuts: null });
});

test('« Tout » : depuis le premier ticket, sans période précédente', async () => {
  const { corps } = await indicateurs('au=2026-03-10', admin);
  assert.equal(corps.periode.du, '2026-02-20');
  assert.equal(corps.periode.jours, 19);
  assert.equal(corps.periode.precedente, null);
  assert.deepEqual(corps.resolus, { valeur: 4, precedent: null });
  assert.equal(corps.ouverts.precedent, null);
});

test('tendance quotidienne : chaque jour, même vide', async () => {
  const { statut, corps } = await tendance(PERIODE, admin);
  assert.equal(statut, 200);
  assert.equal(corps.periode.granularite, 'jour');
  assert.equal(corps.points.length, 10);
  const jour = (j: string) => corps.points.find((p) => p.debut === j);
  assert.deepEqual(jour('2026-03-01'), { debut: '2026-03-01', crees: 0, resolus: 0 });
  assert.deepEqual(jour('2026-03-04'), { debut: '2026-03-04', crees: 0, resolus: 1 }); // T7
  assert.deepEqual(jour('2026-03-06'), { debut: '2026-03-06', crees: 0, resolus: 1 }); // T2, par sa clôture
  assert.deepEqual(jour('2026-03-10'), { debut: '2026-03-10', crees: 1, resolus: 0 }); // T6
  const total = (cle: 'crees' | 'resolus') => corps.points.reduce((n, p) => n + p[cle], 0);
  assert.equal(total('crees'), 5); // T1, T2, T3, T5, T6
  assert.equal(total('resolus'), 3); // T1, T2, T7 — jamais T5
});

test('tendance hebdomadaire : tranches du lundi, sans trou', async () => {
  const { corps } = await tendance('du=2026-01-01&au=2026-03-10', admin);
  assert.equal(corps.periode.granularite, 'semaine');
  assert.equal(corps.points[0].debut, '2025-12-29'); // le lundi de la semaine du 01/01
  for (let i = 1; i < corps.points.length; i++) {
    const ecart = (Date.parse(corps.points[i].debut) - Date.parse(corps.points[i - 1].debut)) / 86_400_000;
    assert.equal(ecart, 7);
  }
  assert.equal(corps.points.at(-1)?.debut, '2026-03-09');
  assert.equal(corps.points.reduce((n, p) => n + p.crees, 0), 7);
  assert.equal(corps.points.reduce((n, p) => n + p.resolus, 0), 4);
});

test('statuts des ouverts : seulement si la période finit aujourd’hui, et ils somment le stock', async () => {
  const { corps } = await indicateurs('', admin);
  assert.deepEqual(corps.ouverts.statuts, { NOUVEAU: 1, EN_ATTENTE: 0, EN_COURS: 1 });
  const somme = Object.values(corps.ouverts.statuts ?? {}).reduce((n, v) => n + v, 0);
  assert.equal(somme, corps.ouverts.valeur);
});

test('paramètres invalides : 400', async () => {
  for (const requete of ['du=2026-03-10&au=2026-03-01', 'du=2026-02-30', 'au=10/03/2026', 'categorieId=-1']) {
    const { statut } = await indicateurs(requete, admin);
    assert.equal(statut, 400, requete);
  }
});

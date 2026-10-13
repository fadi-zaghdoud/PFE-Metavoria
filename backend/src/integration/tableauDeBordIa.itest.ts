// Tests d'intégration de /api/tableau-de-bord/ia et /a-traiter, sur une vraie base
// PostgreSQL (voir baseDeTest.ts : la garde refuse toute base dont le nom ne finit pas par
// « _test »). Les fichiers d'intégration s'exécutent un par un : chacun vide la base.
//
// Jeu de données — ouverts :
//   O1  Nouveau, sans technicien, créé 10/01          employée A
//   O2  En attente, technicien, créé 01/02            employée A
//   O3  En cours, technicien, créé 20/01              employée B (RH)
//   N1…N6  Nouveaux, sans technicien, créés 01/03…06/03   employée A
//   C1  Résolu (fermé), créé 02/01                    employée A
// Suggestions (période étudiée : mars 2026) :
//   O2  catégorie ACCEPTÉE (02/03) · priorisation (sans effet sur le décompte)
//   O3  catégorie CORRIGÉE (03/03) · solution générée (04/03)
//   O1  catégorie EN ATTENTE (05/03) · solution avec ABSTENTION (05/03)
//   N1  solution en ÉCHEC (06/03)
//   C1  catégorie acceptée le 05/01 — hors période de mars
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { jeton, lire, preparer } from './baseDeTest';
import type { Role, StatutTicket } from '../generated/prisma/enums';

interface Compte {
  id: number;
  role: Role;
}
interface Ia {
  categories: { proposees: number; tranchees: number; acceptees: number; corrigees: number; enAttente: number };
  solutions: { generees: number; abstentions: number; echecs: number };
}
interface TicketListe {
  id: number;
  titre: string;
  statut: string;
  dateCreation: string;
  joursOuvert: number;
}
interface ATraiter {
  ouverts: number;
  sansTechnicien: number;
  sansPriseEnCharge: { total: number; tickets: TicketListe[] };
  plusAnciens: { total: number; tickets: TicketListe[] };
}

let ctx: Awaited<ReturnType<typeof preparer>>;
let admin: Compte;
let tech: Compte;
let employeeB: Compte;
const ids: Record<string, number> = {};
const MARS = 'du=2026-03-01&au=2026-03-31';

before(async () => {
  ctx = await preparer();
  const p = ctx.prisma;
  const compte = async (cle: string, role: Role, service: string | null): Promise<Compte> => {
    const u = await p.utilisateur.create({ data: { nom: cle, prenom: 'Test', email: `${cle}@test.local`, role, service } });
    return { id: u.id, role: u.role };
  };
  admin = await compte('admin', 'ADMINISTRATEUR', null);
  tech = await compte('tech', 'TECHNICIEN', 'Support IT');
  const employeeA = await compte('employee-a', 'EMPLOYE', 'Finance');
  employeeB = await compte('employee-b', 'EMPLOYE', 'RH');

  const ticket = async (cle: string, cree: string, statut: StatutTicket, demandeur: number, technicien?: number) => {
    const t = await p.ticket.create({
      data: {
        titre: `Ticket ${cle}`,
        description: `Description du ticket ${cle}`,
        statut,
        dateCreation: new Date(cree),
        demandeurId: demandeur,
        technicienId: technicien ?? null,
        dateCloture: statut === 'CLOTURE' ? new Date(cree) : null,
      },
    });
    ids[cle] = t.id;
  };
  await ticket('O1', '2026-01-10T09:00:00Z', 'NOUVEAU', employeeA.id);
  await ticket('O2', '2026-02-01T09:00:00Z', 'EN_ATTENTE', employeeA.id, tech.id);
  await ticket('O3', '2026-01-20T09:00:00Z', 'EN_COURS', employeeB.id, tech.id);
  for (let i = 1; i <= 6; i++) await ticket(`N${i}`, `2026-03-0${i}T09:00:00Z`, 'NOUVEAU', employeeA.id);
  await ticket('C1', '2026-01-02T09:00:00Z', 'RESOLU', employeeA.id, tech.id);

  const suggestion = async (
    cle: string,
    type: string,
    date: string,
    o: { validee?: boolean | null; statut?: string; abstenu?: boolean } = {},
  ) =>
    p.suggestionIA.create({
      data: {
        ticketId: ids[cle],
        typeSuggestion: type,
        contenu: type === 'SOLUTION' && !o.abstenu ? 'Solution proposée' : '',
        statut: o.statut ?? 'PRETE',
        valideeParTechnicien: o.validee ?? null,
        details: type === 'SOLUTION' && o.statut !== 'ECHEC' ? { abstenu: o.abstenu ?? false } : undefined,
        dateCreation: new Date(date),
      },
    });
  await suggestion('O2', 'CLASSIFICATION', '2026-03-02T10:00:00Z', { validee: true });
  await suggestion('O2', 'PRIORISATION', '2026-03-02T10:00:00Z');
  await suggestion('O3', 'CLASSIFICATION', '2026-03-03T10:00:00Z', { validee: false });
  await suggestion('O3', 'SOLUTION', '2026-03-04T10:00:00Z', { abstenu: false });
  await suggestion('O1', 'CLASSIFICATION', '2026-03-05T10:00:00Z', { validee: null });
  await suggestion('O1', 'SOLUTION', '2026-03-05T11:00:00Z', { abstenu: true });
  await suggestion('N1', 'SOLUTION', '2026-03-06T10:00:00Z', { statut: 'ECHEC' });
  await suggestion('C1', 'CLASSIFICATION', '2026-01-05T10:00:00Z', { validee: true });
});

after(async () => {
  await ctx?.fermer();
});

const ia = (requete: string, compte: Compte) => lire<Ia>(`${ctx.url}/tableau-de-bord/ia?${requete}`, jeton(compte));
const aTraiter = (requete: string, compte: Compte) =>
  lire<ATraiter>(`${ctx.url}/tableau-de-bord/a-traiter?${requete}`, jeton(compte));

test('module IA : sort des catégories et des solutions sur la période', async () => {
  const { statut, corps } = await ia(MARS, admin);
  assert.equal(statut, 200);
  assert.deepEqual(corps.categories, { proposees: 3, tranchees: 2, acceptees: 1, corrigees: 1, enAttente: 1 });
  assert.deepEqual(corps.solutions, { generees: 1, abstentions: 1, echecs: 1 });
});

test('module IA : la période porte sur la date de la suggestion', async () => {
  const { corps } = await ia('du=2026-01-01&au=2026-03-31', admin);
  assert.deepEqual(corps.categories, { proposees: 4, tranchees: 3, acceptees: 2, corrigees: 1, enAttente: 1 });
});

test('module IA : filtre du service du demandeur', async () => {
  const { corps } = await ia(`${MARS}&service=RH`, admin);
  assert.deepEqual(corps.categories, { proposees: 1, tranchees: 1, acceptees: 0, corrigees: 1, enAttente: 0 });
  assert.deepEqual(corps.solutions, { generees: 1, abstentions: 0, echecs: 0 });
});

test('module IA : réservé au support', async () => {
  assert.equal((await ia(MARS, tech)).statut, 200);
  assert.equal((await ia(MARS, employeeB)).statut, 403);
});

test('à traiter : comptes et deux listes, les plus anciens d’abord, cinq au plus', async () => {
  const { statut, corps } = await aTraiter('', admin);
  assert.equal(statut, 200);
  assert.equal(corps.ouverts, 9); // O1, O2, O3, N1…N6 — jamais C1
  assert.equal(corps.sansTechnicien, 7); // O1, N1…N6
  assert.equal(corps.sansPriseEnCharge.total, 8); // Nouveau ou En attente
  assert.deepEqual(
    corps.sansPriseEnCharge.tickets.map((t) => t.id),
    [ids.O1, ids.O2, ids.N1, ids.N2, ids.N3],
  );
  assert.equal(corps.plusAnciens.total, 9);
  assert.deepEqual(
    corps.plusAnciens.tickets.map((t) => t.id),
    [ids.O1, ids.O3, ids.O2, ids.N1, ids.N2],
  );
  const [plusVieux, suivant] = corps.plusAnciens.tickets;
  assert.equal(plusVieux.statut, 'NOUVEAU');
  assert.equal(plusVieux.dateCreation, '2026-01-10T09:00:00Z');
  assert.ok(plusVieux.joursOuvert > suivant.joursOuvert);
  assert.ok(suivant.joursOuvert >= 0);
});

test('à traiter : l’employée ne voit que ses tickets ouverts', async () => {
  const { corps } = await aTraiter('', employeeB);
  assert.equal(corps.ouverts, 1);
  assert.equal(corps.sansTechnicien, 0);
  assert.deepEqual(corps.sansPriseEnCharge, { total: 0, tickets: [] });
  assert.deepEqual(corps.plusAnciens.tickets.map((t) => t.id), [ids.O3]);
});

test('à traiter : filtre de technicien, sans effet de la période', async () => {
  const filtre = await aTraiter(`technicienId=${tech.id}`, admin);
  assert.equal(filtre.corps.ouverts, 2); // O2, O3
  assert.equal(filtre.corps.sansTechnicien, 0);
  const avecPeriode = await aTraiter(MARS, admin);
  assert.equal(avecPeriode.corps.ouverts, 9); // la période ne restreint pas « À traiter »
});

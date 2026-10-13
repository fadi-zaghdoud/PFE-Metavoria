import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';

// Agrégations du tableau de bord, calculées EN SQL — jamais en chargeant les tickets.
// Lecture seule : aucune de ces requêtes n'écrit.
//
// Définitions (consignées au journal, « Les définitions des indicateurs ») :
//   - date de résolution = dernier événement « Résolu », sinon date de clôture (les tickets
//     synthétiques n'ont pas d'événements : le chargeur pose leur clôture à la résolution) ;
//   - un ticket résolu ou clos SANS date de résolution connue n'est jamais compté ouvert,
//     ni résolu dans une période ;
//   - 1re prise en charge = premier événement PRISE_EN_CHARGE ;
//   - ouverts = stock à la fin de la période : créés avant, pas encore résolus.
// Les bornes arrivent en JOURS (AAAA-MM-JJ) et sont converties par Postgres (`::date`) : une
// date JavaScript passerait par le fuseau du pilote, un jour non.

export interface Perimetre {
  demandeurId?: number; // employé : ses seuls tickets
  technicienId?: number;
  categorieId?: number;
  service?: string; // service du demandeur
}

export type StatutOuvert = 'NOUVEAU' | 'EN_ATTENTE' | 'EN_COURS';

const filtre = (p: Perimetre) => Prisma.sql`
  (${p.demandeurId ?? null}::int IS NULL OR tk.demandeur_id = ${p.demandeurId ?? null}::int)
  AND (${p.technicienId ?? null}::int IS NULL OR tk.technicien_id = ${p.technicienId ?? null}::int)
  AND (${p.categorieId ?? null}::int IS NULL OR tk.categorie_id = ${p.categorieId ?? null}::int)
  AND (${p.service ?? null}::text IS NULL OR d.service = ${p.service ?? null}::text)`;

// Les tickets du périmètre, avec leur date de création, de résolution et de 1re prise en
// charge. `clos` repère les statuts Résolu et Clôturé : un tel ticket sans date de
// résolution connue n'est compté ni ouvert, ni résolu dans une période.
const ticketsDuPerimetre = (p: Perimetre) => Prisma.sql`
  SELECT
    tk.id,
    tk.date_creation AS cree,
    COALESCE(
      (SELECT max(e.date_creation) FROM evenements_ticket e
        WHERE e.ticket_id = tk.id AND e.type = 'CHANGEMENT_STATUT' AND e.nouvelle_valeur = 'RESOLU'),
      tk.date_cloture
    ) AS resolu,
    (SELECT min(e.date_creation) FROM evenements_ticket e
      WHERE e.ticket_id = tk.id AND e.type = 'PRISE_EN_CHARGE') AS pec,
    (tk.statut IN ('RESOLU', 'CLOTURE')) AS clos
  FROM tickets tk
  JOIN utilisateurs d ON d.id = tk.demandeur_id
  WHERE ${filtre(p)}`;

export interface LigneIndicateurs {
  resolus: number;
  heures_resolution: number | null;
  prises_en_charge: number;
  heures_pec: number | null;
  ouverts: number;
  resolus_prec: number;
  heures_resolution_prec: number | null;
  prises_en_charge_prec: number;
  heures_pec_prec: number | null;
  ouverts_prec: number;
  existants_prec: number; // tickets créés avant la fin de la période précédente
}

export const tableauDeBordRepository = {
  // Premier jour de création du périmètre (« Tout »), ou null s'il est vide.
  async premierJour(p: Perimetre): Promise<string | null> {
    const [ligne] = await prisma.$queryRaw<{ jour: string | null }[]>`
      SELECT to_char(min(tk.date_creation), 'YYYY-MM-DD') AS jour
      FROM tickets tk JOIN utilisateurs d ON d.id = tk.demandeur_id
      WHERE ${filtre(p)}`;
    return ligne?.jour ?? null;
  },

  // Les quatre indicateurs, pour la période [du, au] et la précédente [precDu, du[. Sans
  // période précédente, la fenêtre [du, du[ est vide et ses valeurs, ignorées.
  async indicateurs(p: Perimetre, du: string, au: string, precDu: string): Promise<LigneIndicateurs> {
    const [ligne] = await prisma.$queryRaw<LigneIndicateurs[]>`
      WITH t AS (${ticketsDuPerimetre(p)})
      SELECT
        count(*) FILTER (WHERE resolu >= ${du}::date AND resolu < ${au}::date + 1)::int AS resolus,
        (avg(extract(epoch FROM resolu - cree))
          FILTER (WHERE resolu >= ${du}::date AND resolu < ${au}::date + 1) / 3600)::float8 AS heures_resolution,
        count(*) FILTER (WHERE pec >= ${du}::date AND pec < ${au}::date + 1)::int AS prises_en_charge,
        (avg(extract(epoch FROM pec - cree))
          FILTER (WHERE pec >= ${du}::date AND pec < ${au}::date + 1) / 3600)::float8 AS heures_pec,
        count(*) FILTER (
          WHERE cree < ${au}::date + 1 AND NOT (resolu IS NULL AND clos)
            AND (resolu IS NULL OR resolu >= ${au}::date + 1))::int AS ouverts,
        count(*) FILTER (WHERE resolu >= ${precDu}::date AND resolu < ${du}::date)::int AS resolus_prec,
        (avg(extract(epoch FROM resolu - cree))
          FILTER (WHERE resolu >= ${precDu}::date AND resolu < ${du}::date) / 3600)::float8 AS heures_resolution_prec,
        count(*) FILTER (WHERE pec >= ${precDu}::date AND pec < ${du}::date)::int AS prises_en_charge_prec,
        (avg(extract(epoch FROM pec - cree))
          FILTER (WHERE pec >= ${precDu}::date AND pec < ${du}::date) / 3600)::float8 AS heures_pec_prec,
        count(*) FILTER (
          WHERE cree < ${du}::date AND NOT (resolu IS NULL AND clos)
            AND (resolu IS NULL OR resolu >= ${du}::date))::int AS ouverts_prec,
        count(*) FILTER (WHERE cree < ${du}::date)::int AS existants_prec
      FROM t`;
    return ligne;
  },

  // Tickets ouverts AUJOURD'HUI, par statut : la mention sous la carte « Ouverts », quand la
  // période s'arrête aujourd'hui (le statut d'une date passée n'est pas reconstituable).
  async statutsOuverts(p: Perimetre): Promise<Record<StatutOuvert, number>> {
    const lignes = await prisma.$queryRaw<{ statut: StatutOuvert; n: number }[]>`
      SELECT tk.statut::text AS statut, count(*)::int AS n
      FROM tickets tk JOIN utilisateurs d ON d.id = tk.demandeur_id
      WHERE ${filtre(p)} AND tk.statut IN ('NOUVEAU', 'EN_ATTENTE', 'EN_COURS')
      GROUP BY tk.statut`;
    const compte = (s: StatutOuvert) => lignes.find((l) => l.statut === s)?.n ?? 0;
    return { NOUVEAU: compte('NOUVEAU'), EN_ATTENTE: compte('EN_ATTENTE'), EN_COURS: compte('EN_COURS') };
  },

  // Tickets créés et résolus par tranche (jour, semaine du lundi, mois), toutes les tranches
  // de la période comprises, même vides.
  async tendance(
    p: Perimetre,
    du: string,
    au: string,
    unite: 'day' | 'week' | 'month',
  ): Promise<{ debut: string; crees: number; resolus: number }[]> {
    const pas = `1 ${unite}`;
    return prisma.$queryRaw`
      WITH t AS (${ticketsDuPerimetre(p)}),
      tranches AS (
        SELECT generate_series(
          date_trunc(${unite}, ${du}::date::timestamp),
          date_trunc(${unite}, ${au}::date::timestamp),
          ${pas}::interval
        ) AS debut
      ),
      crees AS (
        SELECT date_trunc(${unite}, cree) AS debut, count(*)::int AS n FROM t
        WHERE cree >= ${du}::date AND cree < ${au}::date + 1 GROUP BY 1
      ),
      resolus AS (
        SELECT date_trunc(${unite}, resolu) AS debut, count(*)::int AS n FROM t
        WHERE resolu >= ${du}::date AND resolu < ${au}::date + 1 GROUP BY 1
      )
      SELECT to_char(tr.debut, 'YYYY-MM-DD') AS debut,
             COALESCE(c.n, 0)::int AS crees,
             COALESCE(r.n, 0)::int AS resolus
      FROM tranches tr
      LEFT JOIN crees c ON c.debut = tr.debut
      LEFT JOIN resolus r ON r.debut = tr.debut
      ORDER BY tr.debut`;
  },
};

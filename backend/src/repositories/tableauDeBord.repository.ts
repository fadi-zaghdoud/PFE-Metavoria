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

// Les tickets du périmètre, avec leur technicien, leur date de création, de résolution et de
// 1re prise en charge. `clos` repère les statuts Résolu et Clôturé : un tel ticket sans date
// de résolution connue n'est compté ni ouvert, ni résolu dans une période.
const ticketsDuPerimetre = (p: Perimetre) => Prisma.sql`
  SELECT
    tk.id,
    tk.technicien_id AS technicien,
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

export interface LigneIa {
  proposees: number;
  acceptees: number;
  corrigees: number;
  en_attente: number;
  generees: number;
  abstentions: number;
  echecs: number;
}

export interface TicketATraiter {
  id: number;
  titre: string;
  statut: StatutOuvert;
  priorite: 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
  dateCreation: string;
  joursOuvert: number;
}

// Ni adresse e-mail, ni motif d'absence : seuls le nom et la date de fin d'une absence en
// cours sortent d'ici (MALADIE est une donnée de santé).
export interface LigneTechnicien {
  id: number;
  prenom: string;
  nom: string;
  ouverts: number;
  resolus: number;
  heures_resolution: number | null;
  absence_jusquau: string | null;
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

  // Module IA sur la période (date de la suggestion) et le périmètre (ticket concerné) :
  //   - catégories proposées (suggestions CLASSIFICATION, toutes origines) et leur sort —
  //     acceptée ou corrigée quand le technicien a tranché (résolution, clôture ou
  //     recatégorisation), en attente sinon ;
  //   - solutions du RAG : générées, abstentions (le modèle s'est abstenu, résultat valide),
  //     échecs (service indisponible).
  async ia(p: Perimetre, du: string, au: string): Promise<LigneIa> {
    const [ligne] = await prisma.$queryRaw<LigneIa[]>`
      SELECT
        count(*) FILTER (WHERE s.type_suggestion = 'CLASSIFICATION')::int AS proposees,
        count(*) FILTER (WHERE s.type_suggestion = 'CLASSIFICATION' AND s.validee_par_technicien IS TRUE)::int AS acceptees,
        count(*) FILTER (WHERE s.type_suggestion = 'CLASSIFICATION' AND s.validee_par_technicien IS FALSE)::int AS corrigees,
        count(*) FILTER (WHERE s.type_suggestion = 'CLASSIFICATION' AND s.validee_par_technicien IS NULL)::int AS en_attente,
        count(*) FILTER (
          WHERE s.type_suggestion = 'SOLUTION' AND s.statut = 'PRETE'
            AND COALESCE((s.details ->> 'abstenu')::boolean, false) = false)::int AS generees,
        count(*) FILTER (
          WHERE s.type_suggestion = 'SOLUTION' AND s.statut = 'PRETE'
            AND (s.details ->> 'abstenu')::boolean IS TRUE)::int AS abstentions,
        count(*) FILTER (WHERE s.type_suggestion = 'SOLUTION' AND s.statut = 'ECHEC')::int AS echecs
      FROM suggestions_ia s
      JOIN tickets tk ON tk.id = s.ticket_id
      JOIN utilisateurs d ON d.id = tk.demandeur_id
      WHERE ${filtre(p)} AND s.date_creation >= ${du}::date AND s.date_creation < ${au}::date + 1`;
    return ligne;
  },

  // « À traiter » — le présent, sans période : les comptes des tickets ouverts, puis les
  // plus anciens de deux listes. « Sans prise en charge » se lit au STATUT (Nouveau ou En
  // attente) : prendre en charge est la seule voie vers « En cours », et les tickets
  // synthétiques n'ont pas d'événements. « Sans technicien » se lit à l'affectation.
  async comptesATraiter(p: Perimetre): Promise<{ ouverts: number; sans_technicien: number; sans_prise_en_charge: number }> {
    const [ligne] = await prisma.$queryRaw<{ ouverts: number; sans_technicien: number; sans_prise_en_charge: number }[]>`
      SELECT count(*)::int AS ouverts,
             count(*) FILTER (WHERE tk.technicien_id IS NULL)::int AS sans_technicien,
             count(*) FILTER (WHERE tk.statut IN ('NOUVEAU', 'EN_ATTENTE'))::int AS sans_prise_en_charge
      FROM tickets tk JOIN utilisateurs d ON d.id = tk.demandeur_id
      WHERE ${filtre(p)} AND tk.statut IN ('NOUVEAU', 'EN_ATTENTE', 'EN_COURS')`;
    return ligne;
  },

  async plusAnciensOuverts(p: Perimetre, sansPriseEnCharge: boolean, limite: number): Promise<TicketATraiter[]> {
    return prisma.$queryRaw<TicketATraiter[]>`
      SELECT tk.id, tk.titre, tk.statut::text AS statut, tk.priorite::text AS priorite,
             to_char(tk.date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dateCreation",
             floor(extract(epoch FROM (now() AT TIME ZONE 'UTC') - tk.date_creation) / 86400)::int AS "joursOuvert"
      FROM tickets tk JOIN utilisateurs d ON d.id = tk.demandeur_id
      WHERE ${filtre(p)}
        AND tk.statut IN ('NOUVEAU', 'EN_ATTENTE', 'EN_COURS')
        AND (${sansPriseEnCharge} = false OR tk.statut IN ('NOUVEAU', 'EN_ATTENTE'))
      ORDER BY tk.date_creation ASC, tk.id ASC
      LIMIT ${limite}`;
  },

  // Activité de chaque technicien sur la période, au technicien ACTUEL du ticket :
  //   - ouverts = ses tickets non résolus à la fin de la période (la définition de la carte
  //     « Ouverts », ventilée par technicien) ;
  //   - résolus = ses tickets résolus dans la période, avec leur temps moyen de résolution.
  // Actif = au moins un ticket ouvert ou résolu, c'est-à-dire un ticket détenu, ouvert, à un
  // moment de la période. Les lignes rendues : les comptes techniciens actifs, même sans
  // activité (le service les compte à part), et tout autre détenteur d'activité — un
  // administrateur, un compte désactivé. `jour` (fuseau métier) date l'absence en cours.
  async techniciens(p: Perimetre, du: string, au: string, jour: string): Promise<LigneTechnicien[]> {
    return prisma.$queryRaw<LigneTechnicien[]>`
      WITH t AS (${ticketsDuPerimetre(p)}),
      activite AS (
        SELECT technicien AS id,
          count(*) FILTER (
            WHERE cree < ${au}::date + 1 AND NOT (resolu IS NULL AND clos)
              AND (resolu IS NULL OR resolu >= ${au}::date + 1))::int AS ouverts,
          count(*) FILTER (WHERE resolu >= ${du}::date AND resolu < ${au}::date + 1)::int AS resolus,
          (avg(extract(epoch FROM resolu - cree))
            FILTER (WHERE resolu >= ${du}::date AND resolu < ${au}::date + 1) / 3600)::float8 AS heures_resolution
        FROM t
        WHERE technicien IS NOT NULL
        GROUP BY technicien
      )
      SELECT u.id, u.prenom, u.nom,
             COALESCE(a.ouverts, 0)::int AS ouverts,
             COALESCE(a.resolus, 0)::int AS resolus,
             a.heures_resolution,
             (SELECT to_char(ab.date_fin, 'YYYY-MM-DD') FROM absences ab
               WHERE ab.technicien_id = u.id AND ab.date_debut <= ${jour}::date AND ab.date_fin >= ${jour}::date
               ORDER BY ab.date_fin DESC LIMIT 1) AS absence_jusquau
      FROM utilisateurs u
      LEFT JOIN activite a ON a.id = u.id
      WHERE (${p.technicienId ?? null}::int IS NULL OR u.id = ${p.technicienId ?? null}::int)
        AND ((u.role = 'TECHNICIEN' AND u.actif) OR COALESCE(a.ouverts, 0) + COALESCE(a.resolus, 0) > 0)
      ORDER BY ouverts DESC, resolus DESC, u.prenom, u.nom, u.id`;
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

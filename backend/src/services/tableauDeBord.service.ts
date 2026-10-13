import {
  tableauDeBordRepository,
  type Perimetre,
  type StatutOuvert,
} from '../repositories/tableauDeBord.repository';
import type { TableauDeBordQueryDto } from '../validators/tableauDeBord.validator';
import { ValidationError } from '../utils/AppError';
import type { Acteur } from './ticket.service';
import { dateDuJour } from './absence.disponibilite';
import {
  arrondiHeures,
  resoudrePeriode,
  valeurPrecedente,
  versJour,
  type Granularite,
  type Periode,
} from './tableauDeBord.periode';

// Périmètre selon le rôle : un employé ne voit que ses tickets ; technicien et
// administrateur voient tout — la même règle que /tickets/statistiques.
function perimetreDe(acteur: Acteur, q: TableauDeBordQueryDto): Perimetre {
  return {
    demandeurId: acteur.role === 'EMPLOYE' ? acteur.id : undefined,
    technicienId: q.technicienId,
    categorieId: q.categorieId,
    service: q.service,
  };
}

async function periodeDe(perimetre: Perimetre, q: TableauDeBordQueryDto): Promise<Periode> {
  const premierTicket = q.du ? null : await tableauDeBordRepository.premierJour(perimetre);
  try {
    return resoudrePeriode({ du: q.du, au: q.au, aujourdhui: versJour(new Date()), premierTicket });
  } catch (err) {
    if (err instanceof RangeError) throw new ValidationError(err.message);
    throw err;
  }
}

const TICKETS_PAR_LISTE = 5;

const UNITE_SQL: Record<Granularite, 'day' | 'week' | 'month'> = {
  jour: 'day',
  semaine: 'week',
  mois: 'month',
};

export const tableauDeBordService = {
  // Les quatre indicateurs de la période, chacun avec sa valeur de la période précédente —
  // null quand cette période n'a pas de données pour lui : l'interface n'affiche alors pas
  // de variation. Les moyennes portent leur effectif.
  async indicateurs(acteur: Acteur, q: TableauDeBordQueryDto) {
    const perimetre = perimetreDe(acteur, q);
    const periode = await periodeDe(perimetre, q);
    const l = await tableauDeBordRepository.indicateurs(
      perimetre,
      periode.du,
      periode.au,
      periode.precedente?.du ?? periode.du,
    );
    const avecPrecedente = periode.precedente !== null;
    const precedent = <T>(valeur: T, effectif: number) =>
      avecPrecedente ? valeurPrecedente(valeur, effectif) : null;

    // Le statut d'une date passée n'est pas reconstituable : la répartition par statut
    // n'accompagne que le stock d'aujourd'hui.
    const statuts: Record<StatutOuvert, number> | null =
      periode.au === versJour(new Date()) ? await tableauDeBordRepository.statutsOuverts(perimetre) : null;

    return {
      periode,
      resolus: { valeur: l.resolus, precedent: precedent(l.resolus_prec, l.resolus_prec) },
      tempsResolution: {
        heures: arrondiHeures(l.heures_resolution),
        n: l.resolus,
        precedent: precedent(
          { heures: arrondiHeures(l.heures_resolution_prec), n: l.resolus_prec },
          l.resolus_prec,
        ),
      },
      ouverts: {
        valeur: l.ouverts,
        precedent: precedent(l.ouverts_prec, l.existants_prec),
        statuts,
      },
      priseEnCharge: {
        heures: arrondiHeures(l.heures_pec),
        n: l.prises_en_charge,
        precedent: precedent(
          { heures: arrondiHeures(l.heures_pec_prec), n: l.prises_en_charge_prec },
          l.prises_en_charge_prec,
        ),
      },
    };
  },

  // Module IA sur la période. Les effectifs sont TOUJOURS rendus : l'interface n'affiche
  // jamais une part sans le nombre sur lequel elle porte.
  async ia(acteur: Acteur, q: TableauDeBordQueryDto) {
    const perimetre = perimetreDe(acteur, q);
    const periode = await periodeDe(perimetre, q);
    const l = await tableauDeBordRepository.ia(perimetre, periode.du, periode.au);
    return {
      periode,
      categories: {
        proposees: l.proposees,
        tranchees: l.acceptees + l.corrigees,
        acceptees: l.acceptees,
        corrigees: l.corrigees,
        enAttente: l.en_attente,
      },
      solutions: { generees: l.generees, abstentions: l.abstentions, echecs: l.echecs },
    };
  },

  // « À traiter » : le présent, sans période — les filtres de catégorie, de technicien et de
  // service s'appliquent. Cinq tickets par liste, les plus anciens d'abord.
  async aTraiter(acteur: Acteur, q: TableauDeBordQueryDto) {
    const perimetre = perimetreDe(acteur, q);
    const [comptes, sansPriseEnCharge, plusAnciens] = await Promise.all([
      tableauDeBordRepository.comptesATraiter(perimetre),
      tableauDeBordRepository.plusAnciensOuverts(perimetre, true, TICKETS_PAR_LISTE),
      tableauDeBordRepository.plusAnciensOuverts(perimetre, false, TICKETS_PAR_LISTE),
    ]);
    return {
      ouverts: comptes.ouverts,
      sansTechnicien: comptes.sans_technicien,
      sansPriseEnCharge: { total: comptes.sans_prise_en_charge, tickets: sansPriseEnCharge },
      plusAnciens: { total: comptes.ouverts, tickets: plusAnciens },
    };
  },

  // Techniciens actifs sur la période — au moins un ticket ouvert à sa fin ou résolu en son
  // cours —, les plus chargés d'abord ; les comptes techniciens sans activité ne sont que
  // comptés. Décision D7 : la section nomme des collègues, donc un technicien n'y reçoit que
  // sa propre ligne, quel que soit le filtre demandé. La période est celle des autres
  // sections (même périmètre), pour que « Tout » parte du même premier ticket.
  async techniciens(acteur: Acteur, q: TableauDeBordQueryDto) {
    const perimetre = perimetreDe(acteur, q);
    const periode = await periodeDe(perimetre, q);
    const lignes = await tableauDeBordRepository.techniciens(
      { ...perimetre, technicienId: acteur.role === 'TECHNICIEN' ? acteur.id : q.technicienId },
      periode.du,
      periode.au,
      dateDuJour(new Date()),
    );
    const actifs = lignes.filter((l) => l.ouverts + l.resolus > 0);
    return {
      periode,
      techniciens: actifs.map((l) => ({
        id: l.id,
        prenom: l.prenom,
        nom: l.nom,
        ouverts: l.ouverts,
        resolus: l.resolus,
        tempsResolution: { heures: arrondiHeures(l.heures_resolution), n: l.resolus },
        absenceJusquau: l.absence_jusquau,
      })),
      sansActivite: lignes.length - actifs.length,
    };
  },

  // Tickets créés et résolus par tranche, à la granularité de la période.
  async tendance(acteur: Acteur, q: TableauDeBordQueryDto) {
    const perimetre = perimetreDe(acteur, q);
    const periode = await periodeDe(perimetre, q);
    const points = await tableauDeBordRepository.tendance(
      perimetre,
      periode.du,
      periode.au,
      UNITE_SQL[periode.granularite],
    );
    return { periode, points };
  },
};

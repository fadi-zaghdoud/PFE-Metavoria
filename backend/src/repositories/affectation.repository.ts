import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import { jourVersDate, type JourCalendaire } from '../services/absence.disponibilite';

// Vue « charge courante des techniciens » — UN SEUL calcul pour DEUX usages :
//   - le tableau de bord, qui affiche la charge de tous ceux qui détiennent des tickets ;
//   - l'affectation automatique, qui ne considère que les candidats éligibles.
// Les deux avaient besoin de la même agrégation ; elle vivait enfouie dans `statistiques()`,
// renvoyait des NOMS et non des ids, et omettait les techniciens à 0 — précisément ceux
// qu'une affectation doit préférer.

const STATUTS_OUVERTS = ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE'] as const;

export interface ChargeTechnicien {
  technicienId: number;
  nom: string;
  // Tickets ouverts qui lui sont assignés. Comptage brut, non pondéré par priorité.
  charge: number;
  // Date de création du dernier ticket qui lui a été assigné, TOUS STATUTS CONFONDUS et
  // hors périmètre de filtrage : sans cela, un technicien venant de tout clôturer
  // paraîtrait « jamais servi » et raflerait les affectations suivantes.
  // `null` = jamais servi.
  dernierTicketAssigne: Date | null;
  // Absence couvrant le jour demandé. LE MOTIF N'EST VOLONTAIREMENT PAS REMONTÉ ICI :
  // le graphique de charge du tableau de bord est visible par TOUS les techniciens
  // (garde `estSupport`), et MALADIE est une donnée de santé. En ne le faisant pas
  // transiter par ce chemin, on rend la fuite impossible par construction plutôt que
  // par discipline. Le motif n'est lu que par l'administration des absences.
  absenceEnCours: { dateFin: JourCalendaire } | null;
  // Catégories couvertes (table `technicien_categories`) — sert la règle d'affectation.
  categories: number[];
  // Candidat à l'AFFECTATION AUTOMATIQUE : technicien actif, et rien d'autre.
  // Un administrateur peut détenir des tickets (il reste donc visible dans la charge,
  // pour que l'admin puisse redistribuer) mais n'est jamais auto-affecté : il affecte,
  // il n'est pas affecté. Un compte désactivé détenant encore des tickets ouverts est
  // dans le même cas.
  eligibleAffectation: boolean;
}

export const affectationRepository = {
  // `jour` est passé par l'appelant (jamais calculé ici) : le fuseau métier est une
  // décision de service, et cela garde la requête reproductible.
  // `scope` ne filtre QUE la charge, pour préserver le comportement du tableau de bord
  // (filtres période / catégorie / service). L'affectation automatique n'en passe aucun.
  async chargeCourante(options: {
    jour: JourCalendaire;
    scope?: Prisma.TicketWhereInput;
  }): Promise<ChargeTechnicien[]> {
    const { jour, scope = {} } = options;
    const jourDate = jourVersDate(jour);

    const [techniciensActifs, groupesCharge] = await Promise.all([
      // Tous les techniciens actifs, MÊME À CHARGE NULLE : un `groupBy` ne renvoie pas de
      // ligne vide, or ce sont exactement ceux qu'une affectation doit préférer.
      prisma.utilisateur.findMany({
        where: { role: 'TECHNICIEN', actif: true },
        select: {
          id: true,
          nom: true,
          prenom: true,
          specialites: { select: { categorieId: true } },
        },
      }),
      prisma.ticket.groupBy({
        by: ['technicienId'],
        where: { ...scope, technicienId: { not: null }, statut: { in: [...STATUTS_OUVERTS] } },
        _count: { _all: true },
      }),
    ]);

    const charges = new Map<number, number>();
    for (const g of groupesCharge) {
      if (g.technicienId !== null) charges.set(g.technicienId, g._count._all);
    }

    // Union : les techniciens actifs (candidats) ∪ ceux qui détiennent des tickets ouverts
    // sans être candidats (administrateur, compte désactivé). Les seconds doivent rester
    // VISIBLES dans la charge sans devenir affectables.
    const idsActifs = new Set(techniciensActifs.map((t) => t.id));
    const idsHorsCandidats = [...charges.keys()].filter((id) => !idsActifs.has(id));
    const tousLesIds = [...idsActifs, ...idsHorsCandidats];

    const [porteursHorsCandidats, groupesDernier, absences] = await Promise.all([
      idsHorsCandidats.length
        ? prisma.utilisateur.findMany({
            where: { id: { in: idsHorsCandidats } },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([]),
      // Sans `scope` et sans filtre de statut — voir `dernierTicketAssigne`.
      prisma.ticket.groupBy({
        by: ['technicienId'],
        where: { technicienId: { in: tousLesIds } },
        _max: { dateCreation: true },
      }),
      // Absences EN COURS le jour demandé. Le prédicat reproduit exactement les bornes
      // incluses de `estAbsentLe` (services/absence.disponibilite.ts) — les deux
      // expressions de la même règle doivent évoluer ensemble.
      prisma.absence.findMany({
        where: {
          technicienId: { in: tousLesIds },
          dateDebut: { lte: jourDate },
          dateFin: { gte: jourDate },
        },
        select: { technicienId: true, dateFin: true },
      }),
    ]);

    const dernierParTech = new Map<number, Date | null>();
    for (const g of groupesDernier) {
      if (g.technicienId !== null) dernierParTech.set(g.technicienId, g._max.dateCreation);
    }

    // Les chevauchements étant interdits en écriture, il y a au plus une absence par
    // technicien un jour donné : la Map ne peut pas écraser d'information utile.
    const absenceParTech = new Map<number, { dateFin: JourCalendaire }>();
    for (const a of absences) {
      absenceParTech.set(a.technicienId, { dateFin: a.dateFin.toISOString().slice(0, 10) });
    }

    const ligne = (
      id: number,
      nom: string,
      categories: number[],
      eligibleAffectation: boolean,
    ): ChargeTechnicien => ({
      technicienId: id,
      nom,
      charge: charges.get(id) ?? 0,
      dernierTicketAssigne: dernierParTech.get(id) ?? null,
      absenceEnCours: absenceParTech.get(id) ?? null,
      categories,
      eligibleAffectation,
    });

    return [
      ...techniciensActifs.map((t) =>
        ligne(
          t.id,
          `${t.prenom} ${t.nom}`,
          t.specialites.map((s) => s.categorieId),
          true,
        ),
      ),
      ...porteursHorsCandidats.map((u) => ligne(u.id, `${u.prenom} ${u.nom}`, [], false)),
    ];
  },
};

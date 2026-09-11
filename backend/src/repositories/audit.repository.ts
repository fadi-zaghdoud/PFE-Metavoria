import { prisma } from '../config/prisma';
import type { Prisma, ResultatAudit } from '../generated/prisma/client';

// Accès au journal d'audit. Volontairement minimal : une écriture, et les lectures que la
// page d'administration consommera (lot C). Ce dépôt n'importe PAS `logger` — ce serait
// une boucle, le journal se journalisant lui-même.

export interface EcritureAudit {
  action: string;
  acteurId: number | null;
  acteurNom: string;
  cibleType: string | null;
  cibleId: number | null;
  resultat: ResultatAudit;
  ip: string | null;
  userAgent: string | null;
  details: Prisma.InputJsonValue | undefined;
}

export const auditRepository = {
  creer(donnees: EcritureAudit) {
    return prisma.journalAudit.create({ data: donnees });
  },

  // Lecture paginée du journal.
  //
  // ⚠️ L'ORDRE EST `dateCreation DESC, id DESC`, JAMAIS `id DESC` SEUL. Les entrées
  // reprises de l'historique ont été insérées en dernier — donc les identifiants les plus
  // élevés — mais portent des dates anciennes. Mesuré sur cette base : les 94 lignes
  // occupent un rang différent selon l'un ou l'autre tri. Trier par id remonterait les
  // entrées les PLUS ANCIENNES en tête.
  //
  // Le curseur reste l'`id` (unique, donc position sans ambiguïté) : Prisma localise la
  // ligne puis poursuit dans l'ordre demandé, pas dans l'ordre des identifiants.
  lister(filtres: {
    action?: string;
    acteurId?: number;
    resultat?: ResultatAudit;
    dateDebut?: Date;
    dateFin?: Date;
    limite: number;
    avantId?: number;
  }) {
    const bornes =
      filtres.dateDebut || filtres.dateFin
        ? { gte: filtres.dateDebut, lte: filtres.dateFin }
        : undefined;

    return prisma.journalAudit.findMany({
      where: {
        action: filtres.action,
        acteurId: filtres.acteurId,
        resultat: filtres.resultat,
        dateCreation: bornes,
      },
      orderBy: [{ dateCreation: 'desc' }, { id: 'desc' }],
      take: filtres.limite,
      ...(filtres.avantId ? { cursor: { id: filtres.avantId }, skip: 1 } : {}),
    });
  },

  // Actions réellement présentes en base, pour alimenter le menu de filtre. Sans cela, la
  // liste déroulante ne proposerait que ce qui est déjà affiché à l'écran.
  async actionsConnues(): Promise<string[]> {
    const lignes = await prisma.journalAudit.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return lignes.map((l) => l.action);
  },

  // Événements d'affectation dont la cible n'a PAS pu être rattachée à un compte : le nom
  // stocké désigne plusieurs comptes affectables. Compté pour être AFFICHÉ — la page
  // annonce la limite au lieu de laisser croire à un filtrage exhaustif par personne.
  compterCiblesNonRattachees(): Promise<number> {
    return prisma.evenementTicket.count({
      where: {
        type: { in: ['AFFECTATION', 'AFFECTATION_AUTO', 'DESAFFECTATION'] },
        cibleId: null,
      },
    });
  },

  // Supprime les entrées antérieures à `avant`. Renvoie le nombre de lignes effacées.
  async purger(avant: Date): Promise<number> {
    const { count } = await prisma.journalAudit.deleteMany({ where: { dateCreation: { lt: avant } } });
    return count;
  },
};

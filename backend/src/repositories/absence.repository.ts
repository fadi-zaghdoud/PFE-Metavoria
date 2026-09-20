import { prisma } from '../config/prisma';
import { jourVersDate, type JourCalendaire } from '../services/absence.disponibilite';
import type { MotifAbsence } from '../generated/prisma/enums';

// Accès aux absences. Contrairement à `chargeCourante()`, ce dépôt REMONTE le motif :
// il n'alimente que l'administration des absences, réservée à l'administrateur.

const absenceAvecPersonnes = {
  technicien: { select: { id: true, prenom: true, nom: true } },
  creePar: { select: { id: true, prenom: true, nom: true } },
} as const;

export interface DonneesAbsence {
  technicienId: number;
  dateDebut: JourCalendaire;
  dateFin: JourCalendaire;
  motif: MotifAbsence;
  commentaire?: string | null;
}

export const absenceRepository = {
  findById(id: number) {
    return prisma.absence.findUnique({ where: { id }, include: absenceAvecPersonnes });
  },

  // Triées de la plus récente à la plus ancienne : l'administrateur regarde d'abord
  // ce qui est en cours ou imminent.
  findMany(filtres: { technicienId?: number } = {}) {
    return prisma.absence.findMany({
      where: { technicienId: filtres.technicienId },
      include: absenceAvecPersonnes,
      orderBy: [{ dateDebut: 'desc' }, { id: 'desc' }],
    });
  },

  // Absences d'un technicien susceptibles de CHEVAUCHER la période donnée. Le prédicat
  // est la traduction SQL de `chevauchent()` : deux périodes se recouvrent si chacune
  // commence avant ou le jour où l'autre finit. `exclureId` sert à la modification, pour
  // qu'une absence ne se déclare pas en conflit avec elle-même.
  chevauchantes(
    technicienId: number,
    dateDebut: JourCalendaire,
    dateFin: JourCalendaire,
    exclureId?: number,
  ) {
    return prisma.absence.findMany({
      where: {
        technicienId,
        id: exclureId ? { not: exclureId } : undefined,
        dateDebut: { lte: jourVersDate(dateFin) },
        dateFin: { gte: jourVersDate(dateDebut) },
      },
      include: absenceAvecPersonnes,
    });
  },

  create(donnees: DonneesAbsence, creeParId: number) {
    return prisma.absence.create({
      data: {
        technicienId: donnees.technicienId,
        dateDebut: jourVersDate(donnees.dateDebut),
        dateFin: jourVersDate(donnees.dateFin),
        motif: donnees.motif,
        commentaire: donnees.commentaire ?? null,
        creeParId,
      },
      include: absenceAvecPersonnes,
    });
  },

  update(id: number, donnees: Omit<DonneesAbsence, 'technicienId'>) {
    return prisma.absence.update({
      where: { id },
      data: {
        dateDebut: jourVersDate(donnees.dateDebut),
        dateFin: jourVersDate(donnees.dateFin),
        motif: donnees.motif,
        commentaire: donnees.commentaire ?? null,
      },
      include: absenceAvecPersonnes,
    });
  },

  delete(id: number) {
    return prisma.absence.delete({ where: { id } });
  },
};

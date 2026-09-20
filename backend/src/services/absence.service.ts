import { absenceRepository, type DonneesAbsence } from '../repositories/absence.repository';
import { utilisateurRepository } from '../repositories/utilisateur.repository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/AppError';
import { logAudit } from '../utils/logger';
import { dateDuJour, estAbsentLe, jourDeDate, type JourCalendaire } from './absence.disponibilite';
import type { CreerAbsenceDto, FiltreAbsencesDto, MajAbsenceDto } from '../validators/absence.validator';

// Administration des absences (§6.2 — exclusion des techniciens absents de l'affectation
// automatique). Réservé à l'administrateur : voir requireRole sur les routes.
//
// L'absence est un mécanisme DISTINCT de `utilisateurs.actif` : `actif` coupe la
// connexion (fait pour un départ), une absence ne touche à rien d'autre qu'à
// l'éligibilité à l'affectation automatique. Le technicien garde son accès complet et
// ses tickets déjà assignés ne bougent pas.

export type PeriodeAbsence = 'EN_COURS' | 'A_VENIR' | 'PASSEE';

// Statut CALCULÉ, jamais stocké : il dépend du jour courant et changerait tout seul.
function statutDe(dateDebut: JourCalendaire, dateFin: JourCalendaire, jour: JourCalendaire): PeriodeAbsence {
  if (estAbsentLe({ dateDebut, dateFin }, jour)) return 'EN_COURS';
  return dateDebut > jour ? 'A_VENIR' : 'PASSEE';
}

// Nombre de jours couverts, bornes incluses (une absence d'un seul jour dure 1 jour).
function dureeEnJours(dateDebut: JourCalendaire, dateFin: JourCalendaire): number {
  const ms = new Date(`${dateFin}T00:00:00.000Z`).getTime() - new Date(`${dateDebut}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

type AbsenceEnBase = NonNullable<Awaited<ReturnType<typeof absenceRepository.findById>>>;

function presenter(a: AbsenceEnBase, jour: JourCalendaire) {
  const dateDebut = jourDeDate(a.dateDebut);
  const dateFin = jourDeDate(a.dateFin);
  return {
    id: a.id,
    technicienId: a.technicienId,
    technicien: a.technicien,
    dateDebut,
    dateFin,
    dureeJours: dureeEnJours(dateDebut, dateFin),
    statut: statutDe(dateDebut, dateFin, jour),
    motif: a.motif,
    commentaire: a.commentaire,
    creePar: a.creePar,
    dateCreation: a.dateCreation,
  };
}

// Le technicien doit exister et être un membre du support. Un compte désactivé reste
// acceptable : on peut vouloir enregistrer une absence passée d'un compte depuis fermé.
async function verifierTechnicien(technicienId: number) {
  const technicien = await utilisateurRepository.findById(technicienId);
  if (!technicien) throw new ValidationError('Technicien introuvable');
  if (technicien.role !== 'TECHNICIEN') {
    throw new ValidationError("Seul un technicien peut se voir enregistrer une absence");
  }
  return technicien;
}

// Chevauchements INTERDITS pour un même technicien. Deux absences qui se recouvrent
// n'apportent aucune information — « absent » est un état booléen sur un jour donné —
// mais rendraient ambigus le motif du jour commun, la date de fin affichée sur le
// tableau de bord, et l'effet d'une suppression. L'interdiction garantit qu'il y a AU
// PLUS UNE absence en cours par technicien, ce dont dépendent la règle d'affectation et
// le marqueur de charge.
async function refuserChevauchement(
  technicienId: number,
  dateDebut: JourCalendaire,
  dateFin: JourCalendaire,
  exclureId?: number,
) {
  const conflits = await absenceRepository.chevauchantes(technicienId, dateDebut, dateFin, exclureId);
  if (conflits.length > 0) {
    const c = conflits[0];
    throw new ConflictError(
      `Cette période chevauche une absence déjà enregistrée du ${jourDeDate(c.dateDebut)} au ${jourDeDate(c.dateFin)}.`,
    );
  }
}

export const absenceService = {
  async lister(filtres: FiltreAbsencesDto) {
    const jour = dateDuJour(new Date());
    const absences = (await absenceRepository.findMany({ technicienId: filtres.technicienId })).map((a) =>
      presenter(a, jour),
    );

    if (!filtres.periode || filtres.periode === 'TOUTES') return absences;
    const attendu = filtres.periode === 'PASSEES' ? 'PASSEE' : filtres.periode;
    return absences.filter((a) => a.statut === attendu);
  },

  async creer(acteurId: number, input: CreerAbsenceDto) {
    await verifierTechnicien(input.technicienId);
    await refuserChevauchement(input.technicienId, input.dateDebut, input.dateFin);

    const creee = await absenceRepository.create(input as DonneesAbsence, acteurId);
    // Une absence modifie qui peut recevoir des tickets : action critique au sens du §7.
    logAudit('ABSENCE_CREEE', {
      absenceId: creee.id,
      technicienId: input.technicienId,
      du: input.dateDebut,
      au: input.dateFin,
      motif: input.motif,
      parUtilisateur: acteurId,
    });
    return presenter(creee, dateDuJour(new Date()));
  },

  async mettreAJour(acteurId: number, id: number, input: MajAbsenceDto) {
    const existante = await absenceRepository.findById(id);
    if (!existante) throw new NotFoundError('Absence introuvable');
    await refuserChevauchement(existante.technicienId, input.dateDebut, input.dateFin, id);

    const misAJour = await absenceRepository.update(id, input);
    logAudit('ABSENCE_MODIFIEE', {
      absenceId: id,
      technicienId: existante.technicienId,
      du: input.dateDebut,
      au: input.dateFin,
      motif: input.motif,
      parUtilisateur: acteurId,
    });
    return presenter(misAJour, dateDuJour(new Date()));
  },

  async supprimer(acteurId: number, id: number) {
    const existante = await absenceRepository.findById(id);
    if (!existante) throw new NotFoundError('Absence introuvable');
    await absenceRepository.delete(id);
    logAudit('ABSENCE_SUPPRIMEE', {
      absenceId: id,
      technicienId: existante.technicienId,
      parUtilisateur: acteurId,
    });
  },
};

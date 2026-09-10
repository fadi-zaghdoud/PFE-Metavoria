import { categorieRepository } from '../repositories/categorie.repository';
import { ticketRepository } from '../repositories/ticket.repository';
import { iaService } from './ia.service';
import { env } from '../config/env';
import { deriverStatut } from './categorie.statut';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { logAudit } from '../utils/logger';

// Violation de contrainte d'unicité Prisma (nom déjà pris) — détectée par le code P2002,
// sans dépendre de la classe d'erreur générée (duck-typing robuste au générateur).
function estViolationUnicite(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'P2002';
}

// Garde anti-désynchronisation du modèle (P1) partagée par renommage et suppression : renvoie
// si la catégorie est ACTIVE (nom ∈ classes du modèle), ou LÈVE 503 si l'IA est injoignable/
// indéterminée (fail-safe : dans le doute, on protège le pont-par-nom plutôt que de risquer une
// casse). Le CRUD sans risque de désync (création, édition de description) n'appelle pas ceci.
async function estActiveOu503(nom: string): Promise<boolean> {
  const modele = await iaService.classesModeleActif();
  if (!modele.modeleDisponible || modele.classes === null) {
    throw new AppError(503, 'Statut IA indéterminé — réessayez quand le service IA sera disponible.');
  }
  return modele.classes.includes(nom);
}

export const categorieService = {
  lister() {
    return categorieRepository.findMany();
  },

  // Vue ADMIN (Phase A) : chaque catégorie enrichie de son compteur de labels validés (Étape 2)
  // et de son STATUT calculé (Étape 3 = classes du modèle actif [Étape 1] + compteur + seuil).
  // `modeleDisponible=false` (IA injoignable/désactivée) → tous les statuts passent INDETERMINE.
  async listerAdministration() {
    const [categories, compte, modele] = await Promise.all([
      categorieRepository.findMany(),
      ticketRepository.compterLabelsValidesParCategorie(),
      iaService.classesModeleActif(),
    ]);
    return {
      modeleDisponible: modele.modeleDisponible,
      categories: categories.map((c) => {
        const nLabelsValides = compte.get(c.id) ?? 0;
        return {
          id: c.id,
          nom: c.nom,
          description: c.description,
          dateCreation: c.dateCreation,
          nLabelsValides,
          statut: deriverStatut(c.nom, nLabelsValides, modele.classes, env.SEUIL_EXEMPLES_APPRENABLE),
        };
      }),
    };
  },

  // Création (admin). Nom unique (contrainte DB → P2002 → 409). Une nouvelle catégorie naît
  // EN_APPRENTISSAGE (0 label, hors modèle) — INDETERMINE si l'IA est injoignable (la création
  // reste autorisée IA down : elle ne touche pas au pont-par-nom). Renvoie la forme enrichie.
  async creer(input: { nom: string; description?: string }) {
    const description = input.description?.trim() ? input.description.trim() : null;
    // Unicité INSENSIBLE À LA CASSE : « sécurité » et « Sécurité » désigneraient la même classe
    // pour le modèle IA — les autoriser toutes deux casserait le pont-par-nom.
    if (await categorieRepository.findByNomInsensible(input.nom)) {
      throw new ConflictError('Une catégorie porte déjà ce nom.');
    }
    let cat;
    try {
      cat = await categorieRepository.create({ nom: input.nom, description });
    } catch (e) {
      if (estViolationUnicite(e)) throw new ConflictError('Une catégorie porte déjà ce nom.');
      throw e;
    }
    // Une categorie est une classe du modele IA : la creer, la renommer ou la supprimer
    // change ce que le classifieur peut predire et ce que les specialites peuvent couvrir.
    logAudit('CATEGORIE_CREEE', { categorieId: cat.id, nom: cat.nom });
    const modele = await iaService.classesModeleActif();
    return {
      id: cat.id,
      nom: cat.nom,
      description: cat.description,
      dateCreation: cat.dateCreation,
      nLabelsValides: 0,
      statut: deriverStatut(cat.nom, 0, modele.classes, env.SEUIL_EXEMPLES_APPRENABLE),
    };
  },

  // Mise à jour (admin). Renommer une catégorie ACTIVE casserait le pont-par-nom (P1) → 409 ;
  // fail-safe 503 si l'IA est indéterminée. Éditer la SEULE description est toujours autorisé
  // (aucun risque de désync), donc opérationnel même IA down. Nom déjà pris → 409.
  async mettreAJour(id: number, input: { nom?: string; description?: string }) {
    const cat = await categorieRepository.findById(id);
    if (!cat) throw new NotFoundError('Catégorie introuvable');

    const renomme = input.nom !== undefined && input.nom !== cat.nom;
    if (renomme && (await estActiveOu503(cat.nom))) {
      throw new ConflictError(
        "Impossible de renommer une catégorie reconnue par l'IA — réentraînez d'abord un modèle sans elle.",
      );
    }

    // Unicité insensible à la casse, en s'excluant soi-même (renommer « Reseau » → « RESEAU »
    // reste possible ; entrer en collision avec une AUTRE catégorie ne l'est pas).
    if (renomme && (await categorieRepository.findByNomInsensible(input.nom as string, id))) {
      throw new ConflictError('Une catégorie porte déjà ce nom.');
    }

    const data: { nom?: string; description?: string | null } = {};
    if (input.nom !== undefined) data.nom = input.nom;
    if (input.description !== undefined) data.description = input.description.trim() ? input.description.trim() : null;

    try {
      const misAJour = await categorieRepository.update(id, data);
      logAudit('CATEGORIE_MODIFIEE', {
        categorieId: id,
        de: cat.nom,
        vers: misAJour.nom,
        renomme,
      });
      return misAJour;
    } catch (e) {
      if (estViolationUnicite(e)) throw new ConflictError('Une catégorie porte déjà ce nom.');
      throw e;
    }
  },

  // Suppression (admin). Bloquée si des tickets l'utilisent (on n'orphanise pas — garde vérifiée
  // AVANT le SetNull du schéma) OU si la catégorie est ACTIVE (le modèle la prédit encore) ;
  // fail-safe 503 si l'IA est indéterminée. Ordre : tickets d'abord (pas besoin de l'IA), message
  // le plus informatif. [Phase B : ajouter ici la garde « exemples de test scellés ».]
  async supprimer(id: number): Promise<void> {
    const cat = await categorieRepository.findById(id);
    if (!cat) throw new NotFoundError('Catégorie introuvable');

    const nbTickets = await categorieRepository.countTickets(id);
    if (nbTickets > 0) {
      throw new ConflictError(`Catégorie utilisée par ${nbTickets} ticket(s) — impossible de la supprimer.`);
    }
    if (await estActiveOu503(cat.nom)) {
      throw new ConflictError(
        "Catégorie reconnue par l'IA — réentraînez un modèle sans elle avant de la supprimer.",
      );
    }
    await categorieRepository.deleteById(id);
    logAudit('CATEGORIE_SUPPRIMEE', { categorieId: id, nom: cat.nom });
  },
};

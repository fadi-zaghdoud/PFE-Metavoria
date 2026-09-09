// Règle de choix du technicien pour l'affectation automatique (§6.2, Chantier 1, Étape 3).
//
// Module PUR : aucun accès base, aucune horloge, aucun log. Il reçoit l'état déjà collecté
// et rend une DÉCISION. C'est ce qui permet d'éprouver toutes les branches — y compris les
// replis et les égalités — sans monter une base ni un serveur.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA RÈGLE, PRÉ-ENREGISTRÉE
//
//   1. Pool de base : les techniciens ACTIFS et DISPONIBLES ce jour.
//      Le rôle et le statut `actif` sont filtrés en SQL (aucun diagnostic à en tirer) ;
//      l'ABSENCE est filtrée ICI, parce qu'elle porte, elle, un diagnostic — voir plus bas.
//
//   2. Filtre de spécialité : si la catégorie est connue et qu'au moins un technicien
//      disponible la couvre, le pool se réduit à ces spécialistes. Sinon, repli sur tous
//      les disponibles.
//
//   3. Départage — tri lexicographique STRICT, dans cet ordre :
//        a. charge croissante                       — le moins chargé gagne ;
//        b. dernier ticket assigné le plus ancien    — à charge égale, le moins récemment
//           servi ; `null` (jamais servi) passe devant ;
//        c. id croissant                             — garde-fou de déterminisme.
//      Sans (c), deux techniciens strictement identiques donneraient un résultat dépendant
//      de l'ordre de la base : intestable. Sans (b), (c) favoriserait éternellement le même.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA SPÉCIALITÉ EST UN FILTRE DUR, PAS UN BONUS
// Conséquence assumée : un spécialiste chargé l'emporte sur un généraliste inoccupé. Le
// CDC §6.2 demande d'affecter « selon la charge de travail ET la catégorie » ; on lit la
// catégorie comme une contrainte de compétence, la charge comme l'arbitre à l'intérieur.
// Un score mêlant les deux exigerait d'inventer une pondération que rien dans les données
// ne justifie — refus délibéré, cohérent avec l'absence de pondération par priorité.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI L'ABSENCE EST FILTRÉE AVANT LA SPÉCIALITÉ
// Parce que cela fait DISPARAÎTRE le cas « tous les spécialistes sont absents » au lieu de
// lui créer une branche : le pool de spécialistes disponibles est simplement vide, et l'on
// retombe sur le repli déjà écrit. Seul le MOTIF les distingue, calculé en comparant les
// spécialistes disponibles aux spécialistes tous statuts confondus. Ce motif n'a aucun
// effet sur la décision : il sert le diagnostic de l'administrateur (« hors spécialité
// parce qu'ils sont absents » ≠ « parce que personne ne couvre cette catégorie »).
import type { JourCalendaire } from './absence.disponibilite';

export interface CandidatAffectation {
  id: number;
  // Catégories couvertes par ce technicien (table `technicien_categories`).
  categories: readonly number[];
  // Tickets ouverts déjà assignés. Comptage BRUT, non pondéré par priorité : le §6.2 parle
  // de « charge de travail », et pondérer supposerait des poids que rien ne justifie.
  charge: number;
  // Approximation du « dernier servi » : date de création du dernier ticket qui lui a été
  // assigné, tous statuts confondus. On ne peut PAS s'appuyer sur les événements
  // d'affectation : ils stockent le NOM du technicien et non son id (voir
  // `ticket.service.ts`), donc ils ne sont pas joignables de façon fiable.
  // `null` = jamais servi -> prioritaire à charge égale.
  dernierTicketAssigne: Date | null;
  // Absence couvrant le jour considéré, ou null. Pré-calculée par l'appelant : le dépôt
  // ne remonte que les absences EN COURS, avec un prédicat SQL
  // (`date_debut <= jour AND date_fin >= jour`) qui reproduit exactement les bornes
  // incluses de `estAbsentLe`. Toute évolution de l'une doit suivre l'autre.
  absenceEnCours: { dateFin: JourCalendaire } | null;
}

// Pourquoi ce technicien a été retenu. Sans effet sur la décision : trace et diagnostic.
export type MotifAffectation =
  // Un spécialiste disponible de la catégorie a été trouvé — cas nominal.
  | 'SPECIALITE'
  // Des spécialistes existent pour cette catégorie, mais ils sont TOUS absents.
  | 'REPLI_SPECIALISTES_ABSENTS'
  // Aucun technicien ne déclare cette catégorie (spécialités non renseignées, ou trou).
  | 'REPLI_AUCUN_SPECIALISTE'
  // Aucune catégorie exploitable : IA indisponible, ou confiance sous le seuil (R1/R2).
  | 'REPLI_CHARGE';

export type RaisonNonAffectation =
  // Aucun technicien actif du tout (R4).
  | 'AUCUN_TECHNICIEN'
  // Des techniciens existent, mais tous absents ce jour (R8).
  | 'TOUS_ABSENTS';

export type ResultatChoix =
  | { affecte: true; technicienId: number; motif: MotifAffectation }
  | { affecte: false; raison: RaisonNonAffectation };

// Comparateur du départage. Total (l'id est unique) -> le résultat ne dépend jamais de
// l'ordre d'entrée, ce qui rend la règle reproductible et donc testable.
function parPrioriteDAffectation(a: CandidatAffectation, b: CandidatAffectation): number {
  // Rang 1 — charge croissante.
  if (a.charge !== b.charge) return a.charge - b.charge;

  // Rang 2 — le moins récemment servi. `null` (jamais servi) passe devant tout le monde.
  const dateA = a.dernierTicketAssigne?.getTime() ?? null;
  const dateB = b.dernierTicketAssigne?.getTime() ?? null;
  if (dateA !== dateB) {
    if (dateA === null) return -1;
    if (dateB === null) return 1;
    return dateA - dateB;
  }

  // Rang 3 — garde-fou déterministe.
  return a.id - b.id;
}

// `categorieId` : catégorie EFFECTIVE du ticket, déjà arbitrée par l'appelant —
// catégorie réelle choisie par le demandeur (R5) si elle existe, sinon catégorie suggérée
// par l'IA si sa confiance atteint le seuil, sinon `null` (R1/R2). Cette fonction ne
// connaît ni l'IA ni les seuils : elle reçoit une catégorie ou rien.
export function choisirTechnicien(
  candidats: readonly CandidatAffectation[],
  categorieId: number | null,
): ResultatChoix {
  if (candidats.length === 0) {
    return { affecte: false, raison: 'AUCUN_TECHNICIEN' };
  }

  const disponibles = candidats.filter((c) => c.absenceEnCours === null);
  if (disponibles.length === 0) {
    return { affecte: false, raison: 'TOUS_ABSENTS' };
  }

  let pool: readonly CandidatAffectation[];
  let motif: MotifAffectation;

  if (categorieId === null) {
    pool = disponibles;
    motif = 'REPLI_CHARGE';
  } else {
    const specialistesDisponibles = disponibles.filter((c) => c.categories.includes(categorieId));
    if (specialistesDisponibles.length > 0) {
      pool = specialistesDisponibles;
      motif = 'SPECIALITE';
    } else {
      // Aucun spécialiste disponible : distinguer « ils sont absents » de « il n'y en a pas ».
      const specialistesTousStatuts = candidats.filter((c) => c.categories.includes(categorieId));
      pool = disponibles;
      motif =
        specialistesTousStatuts.length > 0 ? 'REPLI_SPECIALISTES_ABSENTS' : 'REPLI_AUCUN_SPECIALISTE';
    }
  }

  // Copie avant tri : `sort` mute son tableau, et l'appelant ne doit pas voir sa liste réordonnée.
  const [retenu] = [...pool].sort(parPrioriteDAffectation);
  return { affecte: true, technicienId: retenu.id, motif };
}

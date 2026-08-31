// Statut du cycle de vie d'une catégorie (Phase A) — CALCULÉ, jamais stocké : il se dérive des
// classes du modèle IA actif (§Étape 1) et du compteur de labels validés (§Étape 2). Ainsi il
// bascule « active » TOUT SEUL au déploiement d'un modèle qui a appris la catégorie — aucune
// désynchronisation possible entre la base et le modèle. Isolé dans son propre module : fonction
// PURE, sans I/O ni import Prisma → testable directement (node:test).

export type StatutCategorie = 'ACTIVE' | 'APPRENABLE' | 'EN_APPRENTISSAGE' | 'INDETERMINE';

// Table de vérité (pré-enregistrée au plan fin) :
//   classesModele === null                → INDETERMINE  (IA injoignable/désactivée : fail-safe)
//   nom ∈ classesModele                   → ACTIVE       (le modèle sait déjà classer dedans)
//   sinon, nLabelsValides ≥ seuil         → APPRENABLE   (assez d'exemples → prête à réentraîner)
//   sinon                                 → EN_APPRENTISSAGE
export function deriverStatut(
  nom: string,
  nLabelsValides: number,
  classesModele: string[] | null,
  seuil: number,
): StatutCategorie {
  if (classesModele === null) return 'INDETERMINE';
  if (classesModele.includes(nom)) return 'ACTIVE';
  if (nLabelsValides >= seuil) return 'APPRENABLE';
  return 'EN_APPRENTISSAGE';
}

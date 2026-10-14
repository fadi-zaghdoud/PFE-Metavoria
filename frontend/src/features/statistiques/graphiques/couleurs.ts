import type { Categorie, PrioriteTicket } from '../../../types/ticket';

// Une part de graphique (secteur d'anneau, de jauge) avec son identité et ses couleurs.
export interface PartGraphique {
  cle: string; // identité stable : id de catégorie, priorité… jamais le rang
  libelle: string;
  valeur: number;
  couleur: string; // remplissage SVG : var(--color-…)
  pastille: string; // pastille de légende : classe Tailwind bg-…
}

// Jetons définis, pour les deux thèmes, dans index.css (@theme static) et vérifiés par
// `npm run verifier:contrastes`. Les classes sont écrites EN ENTIER ici, pour que Tailwind
// les trouve à la compilation.
const EMPLACEMENTS = [
  { couleur: 'var(--color-categorie-1)', pastille: 'bg-categorie-1' },
  { couleur: 'var(--color-categorie-2)', pastille: 'bg-categorie-2' },
  { couleur: 'var(--color-categorie-3)', pastille: 'bg-categorie-3' },
  { couleur: 'var(--color-categorie-4)', pastille: 'bg-categorie-4' },
  { couleur: 'var(--color-categorie-5)', pastille: 'bg-categorie-5' },
  { couleur: 'var(--color-categorie-6)', pastille: 'bg-categorie-6' },
];
const AUCUNE = { couleur: 'var(--color-categorie-aucune)', pastille: 'bg-categorie-aucune' };
export const NON_CLASSE = 'Non classé';

export const COULEUR_PRIORITE: Record<PrioriteTicket, { couleur: string; pastille: string }> = {
  FAIBLE: { couleur: 'var(--color-priorite-faible)', pastille: 'bg-priorite-faible' },
  MOYENNE: { couleur: 'var(--color-priorite-moyenne)', pastille: 'bg-priorite-moyenne' },
  HAUTE: { couleur: 'var(--color-priorite-haute)', pastille: 'bg-priorite-haute' },
  CRITIQUE: { couleur: 'var(--color-priorite-critique)', pastille: 'bg-priorite-critique' },
};

// Parts de l'anneau des catégories. Chaque catégorie garde SON emplacement de couleur —
// celui de son rang dans l'ordre des identifiants, jamais son rang en effectif : un filtre
// qui vide une catégorie ne recolore pas les autres. L'ordre des parts suit les
// emplacements, celui dont les voisinages ont été vérifiés (`verifier:contrastes`).
//
// Six emplacements colorés : au-delà de six catégories, les cinq premières gardent le leur
// et le sixième regroupe les suivantes (« 3 autres catégories »). « Non classé » ferme
// l'anneau, en gris, s'il compte au moins un ticket.
//
// Sans la liste des catégories (appel en échec), l'ordre alphabétique des noms reçus tient
// lieu d'ordre stable : il ne dépend pas, lui non plus, des effectifs.
export function partsCategories(
  repartition: { categorie: string; count: number }[],
  categories: Categorie[],
): PartGraphique[] {
  const comptes = new Map(repartition.map((r) => [r.categorie, r.count]));
  const connues = [...categories].sort((a, b) => a.id - b.id).map((c) => c.nom);
  const inconnues = repartition
    .map((r) => r.categorie)
    .filter((nom) => nom !== NON_CLASSE && !connues.includes(nom))
    .sort((a, b) => a.localeCompare(b, 'fr'));
  const noms = [...connues, ...inconnues];

  const nommees = noms.length > EMPLACEMENTS.length ? EMPLACEMENTS.length - 1 : noms.length;
  const parts: PartGraphique[] = noms.slice(0, nommees).map((nom, i) => ({
    cle: `categorie:${nom}`,
    libelle: nom,
    valeur: comptes.get(nom) ?? 0,
    ...EMPLACEMENTS[i],
  }));
  const reste = noms.slice(nommees);
  if (reste.length > 0) {
    parts.push({
      cle: 'categorie:autres',
      libelle: `${reste.length} autres catégories`,
      valeur: reste.reduce((n, nom) => n + (comptes.get(nom) ?? 0), 0),
      ...EMPLACEMENTS[EMPLACEMENTS.length - 1],
    });
  }
  const nonClasses = comptes.get(NON_CLASSE) ?? 0;
  if (nonClasses > 0) parts.push({ cle: 'categorie:aucune', libelle: NON_CLASSE, valeur: nonClasses, ...AUCUNE });
  return parts;
}

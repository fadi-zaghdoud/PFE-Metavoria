// Variation d'un indicateur par rapport à la période précédente. Aucune variation sans
// valeur précédente (le serveur la donne nulle quand la période précédente n'a pas de
// données) ni quand elle vaut zéro : un pourcentage d'un zéro ne veut rien dire.
//
// `plusHautEstMieux` décide de la couleur : plus de tickets résolus est une amélioration,
// plus de tickets ouverts ou un délai plus long, une dégradation. La flèche suit le sens du
// chiffre ; la couleur, son effet.
export interface Variation {
  texte: string; // « +6,3 % »
  sens: 'hausse' | 'baisse' | 'stable';
  favorable: boolean | null; // null : stable
}

export function calculerVariation(
  valeur: number | null,
  precedent: number | null,
  plusHautEstMieux: boolean,
): Variation | null {
  if (valeur == null || precedent == null || precedent === 0) return null;
  const rapport = (valeur - precedent) / precedent;
  const sens = Math.abs(rapport) < 0.0005 ? 'stable' : rapport > 0 ? 'hausse' : 'baisse';
  return {
    texte: rapport.toLocaleString('fr-FR', {
      style: 'percent',
      signDisplay: sens === 'stable' ? 'never' : 'exceptZero',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    sens,
    favorable: sens === 'stable' ? null : (sens === 'hausse') === plusHautEstMieux,
  };
}

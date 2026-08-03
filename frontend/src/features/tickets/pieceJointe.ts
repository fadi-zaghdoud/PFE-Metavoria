// Contraintes de pièce jointe côté client (miroir de la validation backend J8bis).
export const FORMATS_PJ = ['application/pdf', 'image/png', 'image/jpeg'];
export const ACCEPT_PJ = '.pdf,.png,.jpg,.jpeg';
export const FORMATS_PJ_LABEL = 'PDF, PNG ou JPG';
export const TAILLE_MAX_PJ = 10 * 1024 * 1024; // 10 Mo
export const MAX_PJ = 5;

// Valide un fichier ; renvoie un message d'erreur, ou null si OK.
export function validerPieceJointe(f: File): string | null {
  if (!FORMATS_PJ.includes(f.type)) return `Format non supporté (${FORMATS_PJ_LABEL})`;
  if (f.size > TAILLE_MAX_PJ) return 'Fichier trop volumineux (10 Mo maximum)';
  return null;
}

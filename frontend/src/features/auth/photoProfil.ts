// Contraintes de photo de profil côté client — miroir exact de `uploadPhotoProfil`
// (backend/src/middlewares/upload.middleware.ts). Valider ici évite un aller-retour
// réseau pour un fichier que le serveur refusera de toute façon ; la validation
// serveur reste la seule qui fasse autorité.
export const FORMATS_PHOTO = ['image/png', 'image/jpeg', 'image/webp'];
export const ACCEPT_PHOTO = '.png,.jpg,.jpeg,.webp';
export const FORMATS_PHOTO_LABEL = 'PNG, JPG ou WEBP';
export const TAILLE_MAX_PHOTO = 2 * 1024 * 1024; // 2 Mo

// Renvoie un message d'erreur, ou null si le fichier est acceptable.
export function validerPhoto(f: File): string | null {
  if (!FORMATS_PHOTO.includes(f.type)) return `Format non supporté (${FORMATS_PHOTO_LABEL})`;
  if (f.size > TAILLE_MAX_PHOTO) return 'Image trop volumineuse (2 Mo maximum)';
  return null;
}

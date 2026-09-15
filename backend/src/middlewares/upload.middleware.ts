import multer from 'multer';

// Formats acceptés (whitelist MIME) + bornes. Une pièce par requête (le front les envoie
// séquentiellement) ; gardée EN MÉMOIRE (buffer) car transférée à Cloudinary sans passer
// par le disque.
export const FORMATS_AUTORISES = ['application/pdf', 'image/png', 'image/jpeg'];
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024; // 10 Mo
export const MAX_PIECES_PAR_TICKET = 5;

export const uploadPieceJointe = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX_OCTETS, files: 1 },
  fileFilter: (_req, file, cb) => {
    // cb(null, false) rejette silencieusement → le contrôleur renvoie une 400 si req.file est absent.
    cb(null, FORMATS_AUTORISES.includes(file.mimetype));
  },
}).single('fichier');

// ── Photo de profil ──────────────────────────────────────────────────────────
// Bornes plus serrées que pour une pièce jointe : images seules (un PDF n'est pas un
// portrait) et 2 Mo, largement au-dessus de ce que produit un téléphone après le
// recadrage 256×256 appliqué à l'upload, mais assez bas pour écarter les fichiers
// envoyés par erreur.
export const FORMATS_PHOTO = ['image/png', 'image/jpeg', 'image/webp'];
export const TAILLE_MAX_PHOTO_OCTETS = 2 * 1024 * 1024; // 2 Mo

export const uploadPhotoProfil = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX_PHOTO_OCTETS, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Même convention que ci-dessus : rejet silencieux, le contrôleur renvoie la 400.
    cb(null, FORMATS_PHOTO.includes(file.mimetype));
  },
}).single('photo');

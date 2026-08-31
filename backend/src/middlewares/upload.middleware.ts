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

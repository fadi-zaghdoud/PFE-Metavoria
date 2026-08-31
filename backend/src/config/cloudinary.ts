import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

// Cloudinary n'est configuré que si les 3 clés sont présentes. Sinon `estConfigure()`
// renvoie false et l'endpoint d'upload répond une erreur explicite (feature désactivée) —
// l'app démarre normalement sans les clés (même logique que le SMTP optionnel).
const configure = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (configure) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function estConfigure(): boolean {
  return configure;
}

export interface ResultatUpload {
  url: string; // secure_url — stockée dans PieceJointe.url (accès direct, cf. §10 confidentialité)
  publicId: string; // public_id — conservé pour une suppression ultérieure
}

// Upload d'un buffer (multer en mémoire) vers Cloudinary. `timeout` généreux (fichier/réseau
// lent). Le dossier isole les pièces par ticket.
//  - images → `image` ;
//  - PDF → `raw` : la livraison des .pdf servis en `image` est BLOQUÉE par défaut (401,
//    réglage compte « Allow delivery of PDF »), alors qu'un `raw` se récupère en 200 sans
//    réglage. Le fichier n'est jamais servi tel quel au navigateur : le backend le proxifie
//    (voir `telechargerPieceJointe`) en posant le bon Content-Type + nom → PDF/image corrects.
export function uploaderBuffer(
  buffer: Buffer,
  dossier: string,
  resourceType: 'image' | 'raw' = 'image',
): Promise<ResultatUpload> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: dossier, timeout: 120000 },
      (err, res) => {
        if (err || !res) {
          return reject(new Error(err?.message ?? 'Upload Cloudinary échoué'));
        }
        resolve({ url: res.secure_url, publicId: res.public_id });
      },
    );
    stream.end(buffer);
  });
}

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  // Session courte (haute sécurité) : jeton d'accès JWT de courte durée + refresh
  // token rotatif (cookie httpOnly). L'access token porte l'autorisation ; le
  // refresh token, révocable, permet de renouveler sans reconnexion.
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // URL du frontend, utilisée pour construire le lien de réinitialisation de mot de passe.
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Module IA (Greffe 1) — microservice Python (FastAPI). L'IA est un enrichissement
  // NON bloquant : si le service est indisponible ou lent, le ticket se crée quand même.
  SERVICE_IA_URL: z.string().default('http://127.0.0.1:8000'),
  // Budget par appel IA (ms) : borne la latence ajoutée à la création (AbortController).
  IA_TIMEOUT_MS: z.coerce.number().default(4000),
  // Budget de la génération RAG (Greffe 2), appelée en ASYNCHRONE : large (génération
  // 15-30 s) — sans jamais bloquer la réponse HTTP (le clic répond 202 immédiat).
  IA_SUGGESTION_TIMEOUT_MS: z.coerce.number().default(60000),
  // Budget de l'extraction OCR (J8bis Lot B), appelée en ASYNCHRONE à l'upload : large
  // (OCR d'un PDF scanné peut prendre plusieurs secondes) — sans bloquer la réponse d'upload.
  IA_EXTRACT_TIMEOUT_MS: z.coerce.number().default(60000),
  // Budget des appels flywheel admin (réentraînement / déploiement). Le service Python répond
  // vite (202 async au déclenchement, copie+reload au déploiement) → marge confortable.
  IA_REENTRAINEMENT_TIMEOUT_MS: z.coerce.number().default(30000),
  // Interrupteur : IA_ACTIVE=false coupe toute la greffe (actif par défaut).
  IA_ACTIVE: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  // Cycle de vie des catégories (Phase A) : nombre de labels validés (tickets réels
  // RESOLU/CLOTURE) à partir duquel une catégorie encore inconnue du modèle passe
  // « apprenable » (signal admin « prête à réentraîner »). Réglable ici en attendant la
  // config admin (§6.5, Phase C). Sous ce seuil : « en apprentissage ».
  SEUIL_EXEMPLES_APPRENABLE: z.coerce.number().int().min(1).default(10),

  // SMTP — optionnels au démarrage (l'app doit pouvoir booter sans e-mail configuré) ;
  // le service d'e-mail échoue explicitement à l'envoi si ces valeurs sont absentes.
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  // NB : z.coerce.boolean() ferait Boolean("false") === true (chaîne non vide) — on
  // compare donc explicitement la chaîne plutôt que de la coercer naïvement.
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Smart Ticketing <no-reply@metavoria.tn>'),

  // Amorçage de l'administrateur initial (déploiement). Optionnels : sans eux, le
  // seed ne crée AUCUN compte — pas d'identifiants par défaut livrés avec le produit.
  // N'ont d'effet que si la base ne contient encore aucun administrateur.
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  // Cloudinary — stockage des pièces jointes (J8bis). Optionnels au démarrage : sans eux,
  // l'app boote mais l'upload est désactivé (l'endpoint répond une erreur explicite).
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :', z.flattenError(parsed.error).fieldErrors);
  throw new Error('Configuration d\'environnement invalide — vois backend/.env.example');
}

export const env = parsed.data;

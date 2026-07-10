import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // URL du frontend, utilisée pour construire le lien de réinitialisation de mot de passe.
  FRONTEND_URL: z.string().default('http://localhost:5173'),

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :', z.flattenError(parsed.error).fieldErrors);
  throw new Error('Configuration d\'environnement invalide — vois backend/.env.example');
}

export const env = parsed.data;

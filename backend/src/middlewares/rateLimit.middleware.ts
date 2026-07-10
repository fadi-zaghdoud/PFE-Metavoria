import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

const FENETRE_15_MIN = 15 * 60 * 1000;

function reponse429(_req: Request, res: Response): void {
  res.status(429).json({ error: 'Trop de tentatives — réessayez dans quelques minutes' });
}

const optionsCommunes = {
  windowMs: FENETRE_15_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  handler: reponse429,
} as const;

// Connexion : freine le brute-force de mots de passe par IP.
export const limiteurConnexion = rateLimit({ ...optionsCommunes, limit: 10 });

// Demande de code : limite l'énumération d'e-mails et le spam d'envois
// (complété par le cooldown de 60 s par compte dans la couche service).
export const limiteurDemandeCode = rateLimit({ ...optionsCommunes, limit: 5 });

// Vérification / réinitialisation : complète la limite de 5 essais par code.
export const limiteurVerificationCode = rateLimit({ ...optionsCommunes, limit: 15 });

// Inscription : évite la création de comptes en masse.
export const limiteurInscription = rateLimit({ ...optionsCommunes, limit: 10 });

import nodemailer from 'nodemailer';
import { env } from './env';

// Transporteur SMTP générique — compatible avec n'importe quel fournisseur
// (Gmail avec mot de passe d'application, SendGrid, Mailtrap, etc.).
export const transporteurMail = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
});

export const smtpConfigured = Boolean(env.SMTP_USER && env.SMTP_PASSWORD);

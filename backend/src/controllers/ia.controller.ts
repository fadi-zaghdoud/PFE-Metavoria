import type { Request, Response } from 'express';
import { env } from '../config/env';
import { iaService } from '../services/ia.service';
import { ticketRepository } from '../repositories/ticket.repository';
import { AppError } from '../utils/AppError';

// Contrôleur ADMIN du flywheel (Greffe 3, B.3). Toutes les routes sont protégées par
// requireRole('ADMINISTRATEUR') au niveau du router. Node assemble les captures propres
// (labelsValides) et les passe au service Python, qui calcule et reste SANS ÉTAT.

function verifierActif(): void {
  if (!env.IA_ACTIVE) throw new AppError(503, 'Le module IA est désactivé.');
}

// Enveloppe un appel proxy : un service IA injoignable (fetch/timeout) → 503 lisible,
// au lieu d'un 500 opaque. Les statuts métier (202/409/404) sont relayés, pas interceptés.
async function siJoignable<T>(promesse: Promise<T>): Promise<T> {
  try {
    return await promesse;
  } catch {
    throw new AppError(503, 'Le service IA est indisponible (réentraînement).');
  }
}

export const iaController = {
  // Déclenche un réentraînement : passe les captures PROPRES (DB) au service Python (async).
  async reentrainer(_req: Request, res: Response): Promise<void> {
    verifierActif();
    const captures = (await ticketRepository.labelsValides()).filter((l) => l.categorie);
    const { status, body } = await siJoignable(iaService.proxyReentrainer(captures));
    res.status(status).json({ ...(body as object), nbCaptures: captures.length });
  },

  // État du flywheel : compteur de labels validés depuis le dernier entraînement + état courant.
  async flywheel(_req: Request, res: Response): Promise<void> {
    verifierActif();
    const sante = await siJoignable(iaService.proxySante());
    const clf =
      (sante.body as { classifieur?: { date_entrainement?: string; macro_f1_reel?: number } })
        .classifieur ?? {};
    const nbLabelsDepuis = clf.date_entrainement
      ? await ticketRepository.nbLabelsValidesDepuis(new Date(clf.date_entrainement))
      : null;
    const etat = await siJoignable(iaService.proxyEtatReentrainement());
    res.json({
      nbLabelsDepuis,
      dateActif: clf.date_entrainement ?? null,
      macroF1ReelActif: clf.macro_f1_reel ?? null,
      etat: etat.body,
    });
  },

  // Déploie un candidat — relaie le refus 409 du service (candidat non meilleur), non contournable.
  async deployer(req: Request, res: Response): Promise<void> {
    verifierActif();
    const stamp = String(req.body?.stamp ?? '').trim();
    if (!stamp) throw new AppError(400, 'Paramètre `stamp` requis.');
    const { status, body } = await siJoignable(iaService.proxyDeployer(stamp));
    res.status(status).json(body);
  },

  // Classes connues du modèle IA actif (Phase A — statut des catégories). Résilient PAR CONCEPTION :
  // pas de `verifierActif` ni de `siJoignable` (qui lèveraient 503) — `classesModeleActif` dégrade
  // en { modeleDisponible: false } si l'IA est coupée/injoignable. Toujours 200, jamais de crash.
  async modele(_req: Request, res: Response): Promise<void> {
    res.json(await iaService.classesModeleActif());
  },
};

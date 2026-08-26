import { apiRequest } from '../../lib/apiClient';

// Client du flywheel ADMIN (Greffe 3, C2). Types calqués sur le contrat B.3 :
//   - controller Node  backend/src/controllers/ia.controller.ts
//   - service Python    smart_ticketing_ml/service/app.py + flywheel/reentrainer.py
// Node seul touche la DB (compteur) ; le service Python calcule et reste SANS ÉTAT.

// ── Métriques (miroir de eval/metrics.py → ResultatMetrique.to_dict) ─────────
export interface MetriqueClasse {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ResultatMetrique {
  macro_f1: number;
  accuracy: number;
  labels: string[];
  par_classe: Record<string, MetriqueClasse>;
  matrice: number[][];
}

// Un modèle évalué sur le test GELÉ : `reel` = externe réel (métrique de tête),
// `gold` = gold synthétique (contexte).
export interface EvalModele {
  chemin: string;
  gold: ResultatMetrique;
  reel: ResultatMetrique;
}

// ── Rapport de réentraînement (dernier_rapport) ─────────────────────────────
export interface RapportReentrainement {
  genere_le: string;
  stamp: string;
  train: {
    train_v2: string;
    n_synthetique: number;
    n_flywheel_relu: number;
    n_captures: number;
    n_total: number;
  };
  etancheite: {
    jaccard_max_vs_reel: number;
    jaccard_max_vs_gold: number;
    n_ajouts_reels_gardes: number;
    porte: string;
  };
  modele_embedding: string;
  actif: EvalModele;
  candidat: EvalModele;
  delta_macro_f1_reel: number;
  verdict_pre_enregistre: string;
  candidat_meilleur: boolean;
  regle: string;
  deploye: boolean;
}

// Le service remonte l'échec dans l'état plutôt que de crasher (cf. _tache dans app.py).
export interface RapportErreur {
  erreur: string;
}

export type DernierRapport = RapportReentrainement | RapportErreur | null;

// Garde de type : distingue un rapport exploitable d'une erreur (ou de l'absence).
export function estRapportValide(r: DernierRapport): r is RapportReentrainement {
  return r != null && !('erreur' in r);
}

export interface EtatReentrainement {
  en_cours: boolean;
  dernier_rapport: DernierRapport;
}

// GET /api/ia/flywheel — compteur (Node/DB) + état du réentraînement (Python).
export interface EtatFlywheel {
  nbLabelsDepuis: number | null;
  dateActif: string | null;
  macroF1ReelActif: number | null;
  etat: EtatReentrainement;
}

export interface ReponseReentrainer {
  demarre: boolean;
  nbCaptures: number;
}

export interface ReponseDeployer {
  deploye: boolean;
  chemin: string;
  macro_f1_reel: number;
}

export const iaApi = {
  // Compteur + état courant. Appelé au montage ET en polling pendant un réentraînement.
  etatFlywheel: (token: string) => apiRequest<EtatFlywheel>('/ia/flywheel', { token }),

  // Déclenche un réentraînement (202 async). 409 si un entraînement est déjà en cours
  // → remonté en ApiError par apiRequest, capté par la page.
  reentrainer: (token: string) =>
    apiRequest<ReponseReentrainer>('/ia/reentrainer', { method: 'POST', token }),

  // Déploie un candidat. Le service REFUSE (409) si le candidat n'est pas meilleur sur le
  // réel — refus non contournable, relayé en ApiError. La page ne l'active que si meilleur.
  deployer: (stamp: string, token: string) =>
    apiRequest<ReponseDeployer>('/ia/deployer', { method: 'POST', body: { stamp }, token }),
};

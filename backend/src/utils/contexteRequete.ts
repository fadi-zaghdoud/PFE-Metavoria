import { AsyncLocalStorage } from 'node:async_hooks';

// Contexte de la requête HTTP en cours, accessible depuis N'IMPORTE OÙ dans la pile
// d'appels sans le passer en paramètre.
//
// POURQUOI CE MÉCANISME. Le journal d'audit doit porter l'IP, le user-agent et l'acteur.
// Or `logAudit()` est appelé à dix-sept endroits enfouis dans la couche service, et les
// services ne voient JAMAIS `req` — `connecter(input)` reçoit un DTO, pas une requête.
// Les deux alternatives étaient : passer un contexte en paramètre partout, ce qui
// contaminerait dix-sept signatures et tous leurs appelants ; ou tracer au niveau du
// middleware HTTP, ce qui ferait perdre les noms d'action (impossible de distinguer un
// changement de priorité d'un changement de catégorie sans analyser les routes).
// `AsyncLocalStorage` (stable depuis Node 16, le projet exige Node ≥ 20) porte le
// contexte le long de la chaîne asynchrone : ZÉRO appel de `logAudit` n'est modifié.
//
// Module PUR : aucun accès base, aucun log, aucune dépendance à Express. Les valeurs
// sont fournies par le middleware ; ce module ne sait que les ranger et les rendre.

export interface ContexteRequete {
  ip?: string;
  userAgent?: string;
  // Renseignés APRÈS l'authentification (le contexte est ouvert avant elle) — voir
  // `enrichirContexte`.
  acteurId?: number;
  acteurNom?: string;
}

const stockage = new AsyncLocalStorage<ContexteRequete>();

// Ouvre un contexte pour toute la durée de `fn`, y compris ses continuations asynchrones.
export function executerAvecContexte<T>(contexte: ContexteRequete, fn: () => T): T {
  return stockage.run({ ...contexte }, fn);
}

// Exécute SANS contexte utilisateur. À utiliser pour les traitements décidés par le
// SYSTÈME et non par la personne qui a déclenché la requête — enrichissement IA lancé en
// arrière-plan, OCR d'une pièce jointe, affectation automatique.
//
// Ce n'est PAS une dégradation, c'est la valeur juste : le service IA n'agit à l'adresse
// IP de personne. Sans cette barrière, un traitement système hériterait de l'IP de
// l'utilisateur dont la requête l'a déclenché, et le journal attribuerait à cette
// personne une action qu'elle n'a pas faite.
export function executerSansContexte<T>(fn: () => T): T {
  return stockage.run({}, fn);
}

// Contexte courant, ou un objet vide hors requête (tâche de démarrage, script, test).
// Ne lève JAMAIS et ne renvoie jamais `undefined` : l'appelant peut toujours lire ses
// champs, qui valent alors `undefined` — « on ne sait pas », et on n'invente rien.
export function contexteCourant(): Readonly<ContexteRequete> {
  return stockage.getStore() ?? {};
}

// Complète le contexte déjà ouvert. Nécessaire parce que l'IP est connue dès l'entrée
// de la requête, alors que l'identité de l'acteur ne l'est qu'après l'authentification.
// Sans contexte ouvert (hors requête), l'appel est sans effet plutôt qu'une erreur.
export function enrichirContexte(ajout: Partial<ContexteRequete>): void {
  const contexte = stockage.getStore();
  if (contexte) Object.assign(contexte, ajout);
}

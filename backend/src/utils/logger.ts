import { auditRepository } from '../repositories/audit.repository';
import { contexteCourant } from './contexteRequete';
import type { Prisma } from '../generated/prisma/client';

// Journalisation des actions critiques (exigence non fonctionnelle « Traçabilité » du
// cahier des charges, §7).
//
// POURQUOI CE MODULE A CHANGÉ. La version précédente n'écrivait qu'une ligne
// `console.info`. Mesuré au démarrage du Chantier 2 : il ne restait que 21 lignes
// `[AUDIT]` pour un projet qui trace depuis le 11 juillet — non par rotation, mais parce
// que chaque reconstruction d'image recrée le conteneur et emporte ses journaux.
// L'exigence était satisfaite sur le papier et avait retenu moins d'une journée
// d'historique. Les actions sont désormais PERSISTÉES en base, donc requêtables,
// filtrables et durables.
//
// CONTRAT — identique à celui des notifications : cette fonction NE LÈVE JAMAIS et n'est
// JAMAIS attendue. Une trace qui échoue ne doit pas faire échouer l'action tracée. La
// contrepartie est assumée : l'écriture n'étant pas transactionnelle avec l'action, une
// coupure juste après peut perdre la ligne. L'alternative — attendre l'écriture —
// ajouterait de la latence à chaque action et permettrait à une base d'audit indisponible
// de bloquer le métier. Mauvais échange.
//
// La ligne console est CONSERVÉE : elle reste utile en développement et dans
// `docker logs`, où elle donne le fil des événements sans ouvrir la base.

export interface OptionsAudit {
  // Objet visé par l'action, quand la convention ci-dessous ne le déduit pas ou se trompe.
  cible?: { type: string; id?: number | null };
  // Par défaut SUCCES. Un ECHEC est au moins aussi intéressant : cinq connexions refusées
  // depuis la même adresse est le signal que la journalisation console ne pouvait pas
  // produire.
  resultat?: 'SUCCES' | 'ECHEC';
}

// CONVENTION DE CIBLE — table de résolution explicite, et non une inférence opaque.
// Les dix-sept appels déjà en place portent tous, dans leurs détails, l'identifiant de
// l'objet concerné. Les lire ici évite de réécrire ces appels un par un, et donne
// gratuitement à la page d'audit la question « tout ce qui concerne cet objet ».
// L'ORDRE compte : une absence porte à la fois `absenceId` et `technicienId`, et c'est
// l'absence qui est visée. `technicienId` est délibérément absent de cette table — c'est
// une référence secondaire, jamais la cible.
const CLES_DE_CIBLE: { cle: string; type: string }[] = [
  { cle: 'absenceId', type: 'ABSENCE' },
  { cle: 'ticketId', type: 'TICKET' },
  { cle: 'utilisateurId', type: 'UTILISATEUR' },
  { cle: 'categorieId', type: 'CATEGORIE' },
];

function deduireCible(details: Record<string, unknown>): { type: string; id: number | null } | null {
  for (const { cle, type } of CLES_DE_CIBLE) {
    const valeur = details[cle];
    if (typeof valeur === 'number') return { type, id: valeur };
  }
  return null;
}

export function logAudit(
  action: string,
  details: Record<string, unknown>,
  options: OptionsAudit = {},
): void {
  // Le contexte est lu SYNCHRONEMENT, au moment de l'appel : l'entrée décrit cet
  // instant-là, pas celui où l'écriture différée s'exécutera.
  const { ip, userAgent, acteurId, acteurNom } = contexteCourant();

  console.info(`[AUDIT] ${action}`, JSON.stringify({ horodatage: new Date().toISOString(), ...details }));

  const cible = options.cible ?? deduireCible(details);

  void auditRepository
    .creer({
      action,
      acteurId: acteurId ?? null,
      // NOT NULL en base, et c'est voulu : c'est le NOM qui distingue une action du
      // système d'une action d'un compte depuis supprimé. Sans contexte d'acteur, il n'y
      // a aucun humain derrière l'action — « Système » est la valeur juste, pas un défaut.
      acteurNom: acteurNom ?? 'Système',
      cibleType: cible?.type ?? null,
      cibleId: cible?.id ?? null,
      resultat: options.resultat ?? 'SUCCES',
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      details: details as Prisma.InputJsonValue,
    })
    .catch((err: unknown) => {
      // Dernier filet. Si le journal lui-même est injoignable, on le dit en console et
      // l'action métier poursuit — c'est tout l'objet du contrat.
      console.warn(
        `[AUDIT] écriture impossible pour « ${action} » — l'action n'est pas interrompue :`,
        err instanceof Error ? err.message : err,
      );
    });
}

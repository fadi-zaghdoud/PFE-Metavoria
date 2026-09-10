import { auditRepository } from '../repositories/audit.repository';
import { logAudit } from '../utils/logger';

// Rétention du journal d'audit.
//
// ─────────────────────────────────────────────────────────────────────────────
// DONNÉES PERSONNELLES — ce que cette table contient et pourquoi
//
// Le journal enregistre des ADRESSES IP et des identifiants de comptes, qui sont des
// données à caractère personnel. Cadre retenu :
//
//   Finalité   SÉCURITÉ et redevabilité. Détecter les accès anormaux (tentatives de
//              force brute), et pouvoir répondre à « qui a changé ce rôle, et quand ».
//              La table n'a PAS vocation à mesurer l'activité des employés, et ne doit
//              pas être détournée en outil de surveillance.
//   Accès      ADMINISTRATEUR uniquement (garde `requireRole` sur les routes de lecture).
//   Durée      12 mois. Un cycle annuel complet : une anomalie constatée en fin d'exercice
//              reste rattachable à son origine, sans conserver indéfiniment des adresses IP.
//   Purge      automatique au démarrage de l'API (voir la limite ci-dessous).
//
// ─────────────────────────────────────────────────────────────────────────────
// LIMITE ASSUMÉE — écrite ici plutôt que découverte plus tard
//
// Le projet n'a AUCUN planificateur de tâches : la purge est donc déclenchée au démarrage
// de l'API, et nulle part ailleurs. Une instance qui tournerait plus de douze mois sans
// jamais redémarrer ne purgerait pas, et conserverait des entrées au-delà de la durée
// annoncée. En pratique la pile redémarre à chaque déploiement, mais la limite est réelle.
//
// La corriger demanderait soit une dépendance de planification, soit un travail périodique
// interne — l'un et l'autre hors du périmètre de ce chantier. À traiter le jour où
// l'application tournera en continu.
// ─────────────────────────────────────────────────────────────────────────────

export const RETENTION_JOURNAL_MOIS = 12;

// Date limite : tout ce qui est antérieur est supprimé. Fonction PURE, donc l'instant de
// référence est passé en paramètre et le calcul est vérifiable sans horloge.
export function dateLimiteRetention(maintenant: Date, mois = RETENTION_JOURNAL_MOIS): Date {
  const limite = new Date(maintenant);
  limite.setMonth(limite.getMonth() - mois);
  return limite;
}

export const auditService = {
  // Purge les entrées expirées. NE LÈVE JAMAIS : appelée au démarrage, elle ne doit en
  // aucun cas empêcher l'API de servir. Un journal trop long est un problème d'hygiène,
  // une API qui ne démarre pas est une panne.
  async purgerExpirees(maintenant = new Date()): Promise<number | null> {
    const limite = dateLimiteRetention(maintenant);
    try {
      const supprimees = await auditRepository.purger(limite);
      if (supprimees > 0) {
        console.info(
          `[AUDIT] rétention : ${supprimees} entrée(s) antérieure(s) au ${limite.toISOString().slice(0, 10)} supprimée(s) (${RETENTION_JOURNAL_MOIS} mois).`,
        );
        // La suppression d'entrées d'audit est elle-même une opération à tracer — action
        // du système, sans acteur humain ni adresse IP.
        logAudit('JOURNAL_PURGE', {
          entreesSupprimees: supprimees,
          anterieuresAu: limite.toISOString(),
          retentionMois: RETENTION_JOURNAL_MOIS,
        });
      } else {
        console.info(
          `[AUDIT] rétention : aucune entrée antérieure au ${limite.toISOString().slice(0, 10)} (${RETENTION_JOURNAL_MOIS} mois).`,
        );
      }
      return supprimees;
    } catch (err) {
      console.warn(
        "[AUDIT] rétention : purge impossible — l'API démarre quand même :",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  },
};

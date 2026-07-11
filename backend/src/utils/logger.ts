// Journalisation des actions critiques (exigence non fonctionnelle « Traçabilité »
// du cahier des charges) : création, affectation et changement de statut des tickets.
// Une ligne structurée par action, préfixée [AUDIT] pour un filtrage aisé des logs.
export function logAudit(action: string, details: Record<string, unknown>): void {
  console.info(`[AUDIT] ${action}`, JSON.stringify({ horodatage: new Date().toISOString(), ...details }));
}

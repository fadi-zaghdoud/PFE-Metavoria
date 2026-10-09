import type { StatutTicket } from '../../types/ticket';

// Couleur de REMPLISSAGE de chaque statut — pastilles des badges, barres et marques des
// graphiques. Une seule table pour tous les écrans : un statut garde partout sa couleur.
// Les jetons `statut-*` sont définis, pour les deux thèmes, dans index.css.
// Module sans composant : l'exporter depuis ticket-ui.tsx ajouterait un avertissement
// « only-export-components » à ceux déjà présents.
export const PASTILLE_STATUT: Record<StatutTicket, string> = {
  NOUVEAU: 'bg-statut-nouveau',
  EN_COURS: 'bg-statut-cours',
  EN_ATTENTE: 'bg-statut-attente',
  RESOLU: 'bg-statut-resolu',
  CLOTURE: 'bg-statut-clos',
};

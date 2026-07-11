import { Minus, SignalHigh, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import type { PrioriteTicket, StatutTicket } from '../../types/ticket';

// ── Statut ───────────────────────────────────────────────────────────────────
const STATUTS: Record<StatutTicket, { label: string; variant: BadgeVariant }> = {
  NOUVEAU: { label: 'Nouveau', variant: 'info' },
  EN_COURS: { label: 'En cours', variant: 'primary' },
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  RESOLU: { label: 'Résolu', variant: 'success' },
  CLOTURE: { label: 'Clôturé', variant: 'neutral' },
};

export const LABEL_STATUT: Record<StatutTicket, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
};

export const STATUT_OPTIONS: StatutTicket[] = ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE'];

export function StatutBadge({ statut }: { statut: StatutTicket }) {
  const { label, variant } = STATUTS[statut];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

// ── Priorité ─────────────────────────────────────────────────────────────────
const PRIORITES: Record<PrioriteTicket, { label: string; icon: LucideIcon; classe: string }> = {
  CRITIQUE: { label: 'Critique', icon: TriangleAlert, classe: 'text-rose-600' },
  HAUTE: { label: 'Haute', icon: SignalHigh, classe: 'text-amber-600' },
  MOYENNE: { label: 'Moyenne', icon: SignalHigh, classe: 'text-sky-600' },
  FAIBLE: { label: 'Faible', icon: Minus, classe: 'text-slate-400' },
};

export const LABEL_PRIORITE: Record<PrioriteTicket, string> = {
  CRITIQUE: 'Critique',
  HAUTE: 'Haute',
  MOYENNE: 'Moyenne',
  FAIBLE: 'Faible',
};

// Ordonnées de la plus urgente à la moins urgente (utilisées dans les filtres/sélecteurs).
export const PRIORITE_OPTIONS: PrioriteTicket[] = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'FAIBLE'];

export function PrioriteLabel({ priorite }: { priorite: PrioriteTicket }) {
  const { label, icon: Icon, classe } = PRIORITES[priorite];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', classe)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

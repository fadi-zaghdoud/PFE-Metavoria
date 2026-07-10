import {
  Globe,
  Mail,
  MessageSquare,
  Minus,
  SignalHigh,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { cn } from '../../lib/cn';
import type { CanalTicket, PrioriteTicket, StatutTicket, Sentiment } from './demo-data';

// ── Statut ───────────────────────────────────────────────────────────────────
const STATUTS: Record<StatutTicket, { label: string; variant: BadgeVariant }> = {
  NOUVEAU: { label: 'Nouveau', variant: 'info' },
  EN_COURS: { label: 'En cours', variant: 'primary' },
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  RESOLU: { label: 'Résolu', variant: 'success' },
  CLOTURE: { label: 'Clôturé', variant: 'neutral' },
};

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

export function PrioriteLabel({ priorite }: { priorite: PrioriteTicket }) {
  const { label, icon: Icon, classe } = PRIORITES[priorite];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', classe)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

// ── SLA ──────────────────────────────────────────────────────────────────────
export function SlaPill({ echeance, statut }: { echeance: Date; statut: StatutTicket }) {
  if (statut === 'RESOLU' || statut === 'CLOTURE') {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const restantMs = echeance.getTime() - Date.now();
  const heures = Math.abs(restantMs) / 3600_000;
  const texteDuree = heures < 1 ? `${Math.round(heures * 60)} min` : `${Math.round(heures)} h`;

  if (restantMs < 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">
        Dépassé de {texteDuree}
      </span>
    );
  }
  const urgent = heures < 4;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        urgent
          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
          : 'bg-slate-50 text-slate-500 ring-slate-500/10',
      )}
    >
      {texteDuree} restantes
    </span>
  );
}

// ── Canal ────────────────────────────────────────────────────────────────────
const CANAUX: Record<CanalTicket, { label: string; icon: LucideIcon }> = {
  EMAIL: { label: 'E-mail', icon: Mail },
  PORTAIL: { label: 'Portail', icon: Globe },
  TEAMS: { label: 'Teams', icon: MessageSquare },
};

export function CanalIcone({ canal }: { canal: CanalTicket }) {
  const { label, icon: Icon } = CANAUX[canal];
  return (
    <span title={label} aria-label={label} className="text-slate-400">
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

// ── Sentiment (analyse IA) ───────────────────────────────────────────────────
const SENTIMENTS: Record<Sentiment, { label: string; variant: BadgeVariant }> = {
  POSITIF: { label: 'Positif', variant: 'success' },
  NEUTRE: { label: 'Neutre', variant: 'neutral' },
  FRUSTRE: { label: 'Frustré', variant: 'danger' },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { label, variant } = SENTIMENTS[sentiment];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

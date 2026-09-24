import { Clock, Minus, SignalHigh, TriangleAlert, type LucideIcon } from 'lucide-react';
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

// ── Ancienneté ───────────────────────────────────────────────────────────────
// Un ticket ouvert depuis 40 jours est indiscernable d'un ticket du matin : seule la
// colonne « Créé » le disait, en petit, et elle disparaît sous md.
//
// LES SEUILS VIENNENT DU COMPORTEMENT RÉEL DE CE SUPPORT, pas d'une convention. Mesuré
// sur les tickets clos : la résolution prend 1 jour en médiane, 3 jours au 90e centile,
// 4 jours au maximum. Un ticket encore ouvert après 7 jours dépasse donc de plus du double
// le pire cas observé — ce n'est plus de la file d'attente, c'est de l'oubli. 30 jours
// marque le décrochage franc.
export const SEUIL_ANCIENNETE_JOURS = 7;
export const SEUIL_ANCIENNETE_CRITIQUE_JOURS = 30;

const STATUTS_OUVERTS: StatutTicket[] = ['NOUVEAU', 'EN_COURS', 'EN_ATTENTE'];

// Rien sur un ticket clos : son ancienneté est derrière lui, et la signaler reviendrait à
// reprocher un délai déjà soldé. Rien non plus sous le seuil — un badge qui s'allume
// partout ne signale plus rien.
export function BadgeAnciennete({
  statut,
  dateCreation,
}: {
  statut: StatutTicket;
  dateCreation: string;
}) {
  if (!STATUTS_OUVERTS.includes(statut)) return null;

  const jours = Math.floor((Date.now() - new Date(dateCreation).getTime()) / 86_400_000);
  if (jours < SEUIL_ANCIENNETE_JOURS) return null;

  const critique = jours >= SEUIL_ANCIENNETE_CRITIQUE_JOURS;
  return (
    <Badge
      variant={critique ? 'danger' : 'warning'}
      title={`Ouvert depuis ${jours} jours, sans résolution`}
    >
      <Clock className="size-3" aria-hidden />
      {jours} j
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

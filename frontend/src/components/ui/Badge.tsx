import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-3 text-texte-3 ring-texte-4/10',
  primary: 'bg-marque-fond text-marque-fort ring-marque/15',
  success: 'bg-succes-fond text-succes-texte ring-succes-accent/15',
  warning: 'bg-alerte-fond text-alerte-texte ring-alerte-accent/20',
  danger: 'bg-danger-fond text-danger-texte ring-danger-accent/15',
  info: 'bg-info-fond text-info-texte ring-info-accent/15',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ variant = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

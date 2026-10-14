import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<Variant, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-info-bordure bg-info-fond text-info-texte-fort', Icon: Info },
  success: { box: 'border-succes-bordure bg-succes-fond text-succes-texte-fort', Icon: CircleCheck },
  warning: { box: 'border-alerte-bordure bg-alerte-fond text-alerte-texte-fort', Icon: TriangleAlert },
  danger: { box: 'border-danger-bordure bg-danger-fond text-danger-texte-fort', Icon: CircleAlert },
};

interface AlertProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', children, className }: AlertProps) {
  const { box, Icon } = STYLES[variant];
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

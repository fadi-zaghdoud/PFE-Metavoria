import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<Variant, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-sky-200 bg-sky-50 text-sky-800', Icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CircleCheck },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: TriangleAlert },
  danger: { box: 'border-rose-200 bg-rose-50 text-rose-800', Icon: CircleAlert },
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
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

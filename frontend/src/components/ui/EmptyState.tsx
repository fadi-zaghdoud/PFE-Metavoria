import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="animate-fade-up flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 ring-1 ring-inset ring-slate-200/70">
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/10 to-transparent"
        />
        <Icon className="relative size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

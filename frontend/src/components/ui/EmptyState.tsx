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
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-texte-4 ring-1 ring-inset ring-bordure/70">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-texte">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-texte-4">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

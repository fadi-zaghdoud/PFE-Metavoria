import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-bordure/80 bg-surface shadow-sm', className)}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-bordure-faible px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-texte">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-texte-4">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

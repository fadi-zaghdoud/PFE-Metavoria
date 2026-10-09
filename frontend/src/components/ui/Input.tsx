import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const FIELD_BASE =
  'w-full rounded-lg border border-bordure-forte bg-surface px-3 text-sm text-texte placeholder:text-texte-4 shadow-xs transition-colors duration-150 hover:border-bordure-survol focus:border-primary-500 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-texte-4';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, 'min-h-24 py-2 leading-relaxed', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(FIELD_BASE, 'h-9 appearance-none pr-8')} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-texte-4"
        aria-hidden
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}

// Champ de formulaire complet : label + contrôle + erreur/indice.
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-texte-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger-texte" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-texte-4">{hint}</p>
      ) : null}
    </div>
  );
}

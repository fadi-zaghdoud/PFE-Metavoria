import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-xs ring-1 ring-inset ring-white/15 hover:bg-primary-700 active:translate-y-px active:bg-primary-800 disabled:hover:bg-primary-600',
  secondary:
    'border border-bordure bg-surface text-texte-2 shadow-xs hover:border-bordure-forte hover:bg-surface-2 active:bg-surface-3',
  ghost: 'text-texte-3 hover:bg-surface-3 hover:text-texte',
  danger:
    'bg-rose-600 text-white shadow-xs ring-1 ring-inset ring-white/15 hover:bg-rose-700 active:translate-y-px active:bg-rose-800',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Conteneur avec bord arrondi + scroll horizontal ; l'en-tête reste collant
// dans un parent à hauteur contrainte (sticky top-0).
export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-auto rounded-2xl border border-bordure/80 bg-surface shadow-sm', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-bordure bg-surface-2 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-texte-4',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-bordure-faible px-4 py-3 align-middle', className)} {...props} />;
}

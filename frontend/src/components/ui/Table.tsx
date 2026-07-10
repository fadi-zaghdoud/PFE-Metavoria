import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Conteneur avec bord arrondi + scroll horizontal ; l'en-tête reste collant
// dans un parent à hauteur contrainte (sticky top-0).
export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-auto rounded-xl border border-slate-200 bg-white shadow-xs', className)}
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
        'sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-2.5 text-left text-xs font-medium text-slate-500 backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-slate-100 px-4 py-3 align-middle', className)} {...props} />;
}

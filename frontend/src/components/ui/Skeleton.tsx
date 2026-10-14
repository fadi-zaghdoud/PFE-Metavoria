import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Squelette de chargement : un aplat qui pulse. Le balayage lumineux d'origine était un
// dégradé animé — retiré avec les autres (consigne du 09/10 : aucun dégradé).
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-4/70 motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

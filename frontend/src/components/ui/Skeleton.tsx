import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Squelette de chargement avec balayage lumineux (shimmer) plutôt qu'un simple
// pulse — plus vivant et « premium ».
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-4/70',
        'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-reflet after:to-transparent after:animate-[shimmer_1.6s_infinite]',
        className,
      )}
      {...props}
    />
  );
}

import { Ticket } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LogoProps {
  className?: string;
  markOnly?: boolean;
  light?: boolean;
}

export function Logo({ className, markOnly = false, light = false }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-600 text-white shadow-glow-sm ring-1 ring-inset ring-white/25">
        {/* Reflet lumineux en haut du logo */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
        />
        <Ticket className="relative size-5" aria-hidden />
      </span>
      {!markOnly && (
        <span className="leading-tight">
          <span className={cn('block text-sm font-semibold tracking-tight', light ? 'text-white' : 'text-texte')}>
            Smart Ticketing
          </span>
          <span
            className={cn(
              'block text-[10px] font-medium uppercase tracking-[0.16em]',
              light ? 'text-white/50' : 'text-texte-4',
            )}
          >
            Metavoria
          </span>
        </span>
      )}
    </span>
  );
}

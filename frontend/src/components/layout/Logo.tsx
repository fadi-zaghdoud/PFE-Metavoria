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
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 text-white shadow-sm">
        <Ticket className="size-4.5" aria-hidden />
      </span>
      {!markOnly && (
        <span className="leading-tight">
          <span className={cn('block text-sm font-semibold', light ? 'text-white' : 'text-slate-900')}>
            Smart Ticketing
          </span>
          <span className={cn('block text-[10px] font-medium uppercase tracking-wider', light ? 'text-white/50' : 'text-slate-400')}>
            Metavoria
          </span>
        </span>
      )}
    </span>
  );
}

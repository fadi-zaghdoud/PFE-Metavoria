import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Card } from './Card';
import { AnimatedNumber } from './AnimatedNumber';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

// Pastille d'icône : aplat teinté de l'état, icône à 3:1 sur ce fond (vérifié par
// `verifier:contrastes`). Ni dégradé, ni halo, ni lueur (consigne du 09/10).
const TONES: Record<Tone, string> = {
  primary: 'bg-marque-fond text-marque',
  success: 'bg-succes-fond text-succes-accent',
  warning: 'bg-alerte-fond text-alerte-accent',
  danger: 'bg-danger-fond text-danger-accent',
  neutral: 'bg-surface-3 text-texte-3',
};

interface Trend {
  direction: 'up' | 'down' | 'neutral';
  label: string;
}

const TREND_STYLE = {
  up: { cls: 'bg-succes-fond text-succes-texte ring-succes-accent/15', Icon: ArrowUpRight },
  down: { cls: 'bg-danger-fond text-danger-texte ring-danger-accent/15', Icon: ArrowDownRight },
  neutral: { cls: 'bg-surface-3 text-texte-3 ring-texte-4/10', Icon: Minus },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
  decimals?: number;
  suffix?: string;
  trend?: Trend;
  index?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'primary',
  decimals = 0,
  suffix,
  trend,
  index = 0,
  className,
}: StatCardProps) {
  const t = TONES[tone];
  const trendStyle = trend ? TREND_STYLE[trend.direction] : null;

  return (
    <Card
      className={cn(
        'group animate-fade-up relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-texte-4">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-texte">
            {typeof value === 'number' ? (
              <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
            ) : (
              value
            )}
          </p>
          {(hint || trend) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {trendStyle && trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                    trendStyle.cls,
                  )}
                >
                  <trendStyle.Icon className="size-3" aria-hidden />
                  {trend.label}
                </span>
              )}
              {hint && <span className="text-xs text-texte-4">{hint}</span>}
            </div>
          )}
        </div>
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', t)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

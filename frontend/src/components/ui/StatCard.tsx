import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Card } from './Card';
import { AnimatedNumber } from './AnimatedNumber';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Tone, { chip: string; aura: string; glow: string }> = {
  primary: { chip: 'from-primary-500 to-primary-600', aura: 'from-primary-500/15', glow: 'shadow-glow-sm' },
  success: { chip: 'from-emerald-500 to-teal-600', aura: 'from-emerald-500/15', glow: '' },
  warning: { chip: 'from-amber-500 to-orange-500', aura: 'from-amber-500/15', glow: '' },
  danger: { chip: 'from-rose-500 to-rose-600', aura: 'from-rose-500/15', glow: '' },
  neutral: { chip: 'from-puce-neutre to-puce-neutre-fonce', aura: 'from-puce-neutre/10', glow: '' },
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
      {/* Halo décoratif discret en coin */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100',
          t.aura,
        )}
      />
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
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ring-1 ring-inset ring-white/20',
            t.chip,
            t.glow,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

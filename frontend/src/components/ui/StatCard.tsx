import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Card } from './Card';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  neutral: 'bg-slate-100 text-slate-600',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'primary' }: StatCardProps) {
  return (
    <Card className="p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

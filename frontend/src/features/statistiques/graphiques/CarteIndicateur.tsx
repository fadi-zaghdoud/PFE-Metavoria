import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';
import type { Variation } from './variation';

// Carte d'indicateur : libellé discret et icône en tête, la valeur en grand, puis la
// variation par rapport à la période précédente — seulement si elle existe. Flèche selon
// le sens du chiffre ; vert si c'est une amélioration, rouge sinon (texte d'état, 4,5:1).
export function CarteIndicateur({
  libelle,
  icone: Icone,
  valeur,
  variation,
  periodePrecedente,
  detail,
  index = 0,
}: {
  libelle: string;
  icone: LucideIcon;
  valeur: string;
  variation: Variation | null;
  periodePrecedente?: string; // « du 21 au 30 mai 2026 »
  detail?: ReactNode;
  index?: number;
}) {
  const Fleche = variation?.sens === 'hausse' ? TrendingUp : variation?.sens === 'baisse' ? TrendingDown : Minus;
  const ton =
    variation?.favorable == null ? 'text-texte-3' : variation.favorable ? 'text-succes-texte' : 'text-danger-texte';
  const effet =
    variation?.favorable == null ? 'stable' : variation.favorable ? 'amélioration' : 'dégradation';

  return (
    <Card className="animate-fade-up flex h-full flex-col p-5" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-texte-3">{libelle}</p>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marque-fond text-marque"
          aria-hidden
        >
          <Icone className="size-5" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-texte">{valeur}</p>
      {variation && (
        <p
          className="mt-2 flex items-center gap-1.5 text-sm"
          title={periodePrecedente ? `Période précédente : ${periodePrecedente}` : undefined}
        >
          <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', ton)}>
            <Fleche className="size-4" aria-hidden />
            {variation.texte}
          </span>
          <span className="text-texte-4" aria-hidden>
            vs préc.
          </span>
          <span className="sr-only">
            par rapport à la période précédente{periodePrecedente ? `, ${periodePrecedente}` : ''} : {effet}
          </span>
        </p>
      )}
      {detail && <div className="mt-auto pt-2 text-xs text-texte-4">{detail}</div>}
    </Card>
  );
}

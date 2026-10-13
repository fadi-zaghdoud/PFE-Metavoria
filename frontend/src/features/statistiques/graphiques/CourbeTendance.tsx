import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { nombreFr } from '../../../lib/format';
import { jourLisible } from '../periodes';
import type { Granularite } from '../tableauDeBordApi';
import { CadreInfobulle, LigneInfobulle } from './Infobulle';

interface Point {
  debut: string;
  crees: number;
  resolus: number;
}

const COULEUR_CREES = 'var(--color-serie-accent)';
const COULEUR_RESOLUS = 'var(--color-statut-resolu)';
const TICK = { fill: 'var(--color-texte-4)', fontSize: 12 };

function titreTranche(debut: string, granularite: Granularite): string {
  if (granularite === 'jour') return jourLisible(debut, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (granularite === 'semaine') return `Semaine du ${jourLisible(debut, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return jourLisible(debut, { month: 'long', year: 'numeric' });
}

// Infobulle de la courbe : le réticule trouve la tranche, l'infobulle donne les deux séries.
function InfobulleTendance({
  active,
  payload,
  granularite,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  granularite: Granularite;
}) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <CadreInfobulle>
      <p className="mb-1 font-medium text-texte-2">{titreTranche(point.debut, granularite)}</p>
      <LigneInfobulle couleur={COULEUR_CREES} valeur={nombreFr(point.crees)} libelle={`créé${point.crees > 1 ? 's' : ''}`} />
      <LigneInfobulle couleur={COULEUR_RESOLUS} valeur={nombreFr(point.resolus)} libelle={`résolu${point.resolus > 1 ? 's' : ''}`} />
    </CadreInfobulle>
  );
}

// Légende de la courbe, dans l'en-tête de sa carte : un aplat pour l'aire, un trait pour la
// ligne — la légende imite la marque.
export function LegendeTendance() {
  return (
    <div className="flex shrink-0 items-center gap-4 text-xs text-texte-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm border-t-2 border-serie-accent bg-serie-accent/20" aria-hidden />
        Créés
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-3.5 rounded-full bg-statut-resolu" aria-hidden />
        Résolus
      </span>
    </div>
  );
}

// Tickets créés (aire légère) et résolus (ligne), sur une seule échelle, à la granularité de
// la période : jour, semaine (du lundi) ou mois.
export function CourbeTendance({ points, granularite }: { points: Point[]; granularite: Granularite }) {
  const reduire = useReducedMotion();
  const crees = points.reduce((n, p) => n + p.crees, 0);
  const resolus = points.reduce((n, p) => n + p.resolus, 0);
  if (points.length === 0 || crees + resolus === 0) {
    return <p className="py-24 text-center text-sm text-texte-4">Aucun ticket sur la période.</p>;
  }
  const plusieursAnnees = new Set(points.map((p) => p.debut.slice(0, 4))).size > 1;
  const etiquette = (debut: string) =>
    granularite === 'mois'
      ? jourLisible(debut, plusieursAnnees ? { month: 'short', year: '2-digit' } : { month: 'short' })
      : jourLisible(debut, { day: 'numeric', month: 'short' });
  const unite = granularite === 'jour' ? 'jour' : granularite === 'semaine' ? 'semaine' : 'mois';

  return (
    <div>
      <p className="sr-only">
        {`Tickets créés et résolus par ${unite}, du ${jourLisible(points[0].debut)} au ${jourLisible(
          points[points.length - 1].debut,
        )} : ${nombreFr(crees)} créés, ${nombreFr(resolus)} résolus.`}
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-graphe-grille)" />
          <XAxis
            dataKey="debut"
            tickFormatter={etiquette}
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-graphe-axe)' }}
            minTickGap={28}
          />
          <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            cursor={{ stroke: 'var(--color-bordure-forte)', strokeWidth: 1 }}
            isAnimationActive={false}
            wrapperStyle={{ zIndex: 20 }}
            content={(props) => <InfobulleTendance {...props} granularite={granularite} />}
          />
          <Area
            type="monotone"
            dataKey="crees"
            name="Créés"
            stroke={COULEUR_CREES}
            strokeWidth={2}
            fill={COULEUR_CREES}
            fillOpacity={0.12}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            isAnimationActive={!reduire}
            animationDuration={600}
          />
          <Line
            type="monotone"
            dataKey="resolus"
            name="Résolus"
            stroke={COULEUR_RESOLUS}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            isAnimationActive={!reduire}
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

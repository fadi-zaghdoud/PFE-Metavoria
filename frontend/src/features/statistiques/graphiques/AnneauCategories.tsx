import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { nombreFr } from '../../../lib/format';
import type { PartGraphique } from './couleurs';
import { InfobulleSecteur } from './Infobulle';
import { Legende } from './Legende';

const TAILLE = 176;

// Anneau des tickets par catégorie, total au centre, légende chiffrée dessous. Les parts
// sont séparées par un filet de la couleur de la carte (2 px), pas par une bordure.
export function AnneauCategories({ parts }: { parts: PartGraphique[] }) {
  const reduire = useReducedMotion();
  const total = parts.reduce((n, p) => n + p.valeur, 0);
  if (total === 0) {
    return <p className="py-12 text-center text-sm text-texte-4">Aucun ticket sur la période.</p>;
  }
  const visibles = parts.filter((p) => p.valeur > 0);
  const resume = parts.map((p) => `${p.libelle} ${nombreFr(p.valeur)}`).join(', ');
  return (
    <div>
      <div
        className="relative mx-auto"
        style={{ width: TAILLE, height: TAILLE }}
        role="img"
        aria-label={`Tickets par catégorie, ${nombreFr(total)} au total : ${resume}.`}
      >
        <PieChart width={TAILLE} height={TAILLE}>
          <Pie
            data={visibles}
            dataKey="valeur"
            nameKey="libelle"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={86}
            startAngle={90}
            endAngle={-270}
            stroke="var(--color-surface)"
            strokeWidth={2}
            isAnimationActive={!reduire}
            animationDuration={600}
          >
            {visibles.map((p) => (
              <Cell key={p.cle} fill={p.couleur} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 20 }}
            content={(props) => <InfobulleSecteur {...props} total={total} unite="tickets" />}
          />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-texte">{nombreFr(total)}</span>
          <span className="text-xs text-texte-4">tickets</span>
        </div>
      </div>
      <Legende parts={parts} />
    </div>
  );
}

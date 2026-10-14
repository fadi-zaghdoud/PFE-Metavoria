import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { nombreFr } from '../../../lib/format';
import type { PartGraphique } from './couleurs';
import { InfobulleSecteur } from './Infobulle';
import { Legende } from './Legende';

const LARGEUR = 232;
const RAYON = 108;
const EPAISSEUR = 30;
const HAUTEUR = RAYON + 4;

// Jauge des priorités : un demi-anneau segmenté, de Faible (à gauche) à Critique (à
// droite), dans la rampe d'une seule teinte vérifiée par `verifier:contrastes` ; total au
// centre, légende chiffrée dessous.
export function JaugePriorites({ parts }: { parts: PartGraphique[] }) {
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
        style={{ width: LARGEUR, height: HAUTEUR }}
        role="img"
        aria-label={`Tickets par priorité, de Faible à Critique, ${nombreFr(total)} au total : ${resume}.`}
      >
        <PieChart width={LARGEUR} height={HAUTEUR}>
          <Pie
            data={visibles}
            dataKey="valeur"
            nameKey="libelle"
            cx={LARGEUR / 2}
            cy={RAYON + 2}
            innerRadius={RAYON - EPAISSEUR}
            outerRadius={RAYON}
            startAngle={180}
            endAngle={0}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-2xl font-semibold leading-none tracking-tight text-texte">{nombreFr(total)}</span>
          <span className="mt-1 text-xs text-texte-4">tickets</span>
        </div>
      </div>
      <Legende parts={parts} />
    </div>
  );
}

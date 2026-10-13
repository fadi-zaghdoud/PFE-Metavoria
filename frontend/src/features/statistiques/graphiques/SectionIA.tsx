import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { useReducedMotion } from 'motion/react';
import { nombreFr, pourcentageFr } from '../../../lib/format';
import type { IaTableau } from '../tableauDeBordApi';
import { CadreInfobulle, LigneInfobulle } from './Infobulle';

const TAILLE = 104;
const ACCENT = 'var(--color-serie-accent)';

// Anneau de progression : la part des catégories proposées que les techniciens ont
// acceptées, parmi celles qu'ils ont tranchées. La piste (le reste de l'anneau) est un
// décor, pas une donnée : sa classe `piste` l'écarte du contrôle de contraste des marques.
function AnneauProgression({ part, total }: { part: number; total: number }) {
  const reduire = useReducedMotion();
  const donnees =
    total > 0
      ? [
          { cle: 'part', valeur: part },
          { cle: 'reste', valeur: total - part },
        ]
      : [{ cle: 'reste', valeur: 1 }];
  return (
    <div className="relative shrink-0" style={{ width: TAILLE, height: TAILLE }} data-graphique="progression-ia">
      <PieChart width={TAILLE} height={TAILLE}>
        <Pie
          data={donnees}
          dataKey="valeur"
          cx="50%"
          cy="50%"
          innerRadius={38}
          outerRadius={50}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={!reduire}
          animationDuration={600}
        >
          {donnees.map((d) =>
            d.cle === 'part' ? (
              <Cell key={d.cle} fill={ACCENT} />
            ) : (
              <Cell key={d.cle} fill="var(--color-surface-3)" className="piste" />
            ),
          )}
        </Pie>
        {total > 0 && (
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 20 }}
            content={({ active }) =>
              active ? (
                <CadreInfobulle>
                  <LigneInfobulle couleur={ACCENT} valeur={`${nombreFr(part)} sur ${nombreFr(total)}`} libelle="acceptées" />
                  <p className="mt-1 text-texte-4">{nombreFr(total - part)} corrigée{total - part > 1 ? 's' : ''} par un technicien</p>
                </CadreInfobulle>
              ) : null
            }
          />
        )}
      </PieChart>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold text-texte">
        {total > 0 ? pourcentageFr(part, total, 0) : '—'}
      </span>
    </div>
  );
}

function PetitChiffre({ valeur, libelle, titre }: { valeur: number; libelle: string; titre: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3" title={titre}>
      <p className="text-2xl font-semibold tracking-tight text-texte">{nombreFr(valeur)}</p>
      <p className="mt-0.5 text-xs text-texte-4">{libelle}</p>
    </div>
  );
}

const pluriel = (n: number, singulier: string, pluriel_: string) => (n > 1 ? pluriel_ : singulier);

// Performance du module IA sur la période : la part acceptée, TOUJOURS avec « x sur n »,
// puis trois effectifs — les solutions générées, les abstentions, les corrections que les
// techniciens ont apportées aux catégories proposées (autant de labels pour le
// réentraînement).
export function SectionIA({ donnees }: { donnees: IaTableau }) {
  const { categories, solutions } = donnees;
  if (categories.proposees === 0 && solutions.generees + solutions.abstentions + solutions.echecs === 0) {
    return <p className="py-10 text-center text-sm text-texte-4">Aucune suggestion IA sur la période.</p>;
  }
  return (
    <div>
      <div className="flex items-center gap-5">
        <AnneauProgression part={categories.acceptees} total={categories.tranchees} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-texte">Catégories proposées acceptées</p>
          <p className="mt-0.5 text-sm text-texte-4">
            {categories.tranchees > 0
              ? `${nombreFr(categories.acceptees)} sur ${nombreFr(categories.tranchees)} ${pluriel(categories.tranchees, 'tranchée', 'tranchées')}`
              : 'Aucune proposition tranchée par un technicien'}
            {categories.enAttente > 0 ? ` · ${nombreFr(categories.enAttente)} en attente` : ''}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <PetitChiffre
          valeur={solutions.generees}
          libelle={pluriel(solutions.generees, 'suggestion générée', 'suggestions générées')}
          titre="Solutions proposées par la recherche dans l'historique (RAG), sur la période"
        />
        <PetitChiffre
          valeur={solutions.abstentions}
          libelle={pluriel(solutions.abstentions, 'abstention', 'abstentions')}
          titre="Demandes pour lesquelles le module s'est abstenu, faute de ticket assez proche"
        />
        <PetitChiffre
          valeur={categories.corrigees}
          libelle={pluriel(categories.corrigees, 'correction collectée', 'corrections collectées')}
          titre="Catégories proposées puis corrigées par un technicien : des labels pour le réentraînement"
        />
      </div>
      {solutions.echecs > 0 && (
        <p className="mt-3 text-xs text-texte-4">
          {nombreFr(solutions.echecs)} {pluriel(solutions.echecs, 'génération en échec', 'générations en échec')} (service
          IA indisponible).
        </p>
      )}
    </div>
  );
}

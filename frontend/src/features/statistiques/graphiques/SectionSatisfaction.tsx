import { Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { nombreFr, pourcentageFr } from '../../../lib/format';
import { CadreInfobulle, LigneInfobulle } from './Infobulle';

// Trois avis dérivés de la note sur 5 — la règle est écrite sous la liste. Icônes en jetons
// `avis-*` (3:1 sur la carte, vérifiés par `verifier:contrastes`) ; le texte reste en
// jetons de texte. Pas de barres : la note moyenne et trois pourcentages suffisent.
const AVIS: {
  cle: string;
  libelle: string;
  notes: number[];
  icone: LucideIcon;
  classe: string;
  couleur: string;
}[] = [
  { cle: 'positif', libelle: 'Positives', notes: [4, 5], icone: Smile, classe: 'text-avis-positif', couleur: 'var(--color-avis-positif)' },
  { cle: 'neutre', libelle: 'Neutres', notes: [3], icone: Meh, classe: 'text-avis-neutre', couleur: 'var(--color-avis-neutre)' },
  { cle: 'negatif', libelle: 'Négatives', notes: [1, 2], icone: Frown, classe: 'text-avis-negatif', couleur: 'var(--color-avis-negatif)' },
];

export function SectionSatisfaction({
  moyenne,
  nombre,
  repartition,
}: {
  moyenne: number | null;
  nombre: number;
  repartition: { note: number; count: number }[];
}) {
  const compter = (notes: number[]) =>
    repartition.filter((r) => notes.includes(r.note)).reduce((n, r) => n + r.count, 0);

  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-texte">
          {moyenne != null && nombre > 0 ? nombreFr(moyenne, 1, 1) : '—'}
        </span>
        <span className="text-sm text-texte-4">/ 5</span>
      </p>
      <p className="mt-1 text-sm text-texte-4">
        {nombre > 0 ? `${nombreFr(nombre)} évaluation${nombre > 1 ? 's' : ''}` : 'Aucune évaluation sur la période.'}
      </p>

      {nombre > 0 && (
        <>
          <ul className="mt-5 space-y-0.5">
            {AVIS.map(({ cle, libelle, notes, icone: Icone, classe, couleur }) => {
              const n = compter(notes);
              return (
                <li
                  key={cle}
                  tabIndex={0}
                  className="group relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-500/50"
                >
                  <Icone className={cn('size-5 shrink-0', classe)} aria-hidden />
                  <span className="text-sm text-texte-2">{libelle}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums text-texte">
                    {pourcentageFr(n, nombre)}
                  </span>
                  <span className="sr-only">
                    , {nombreFr(n)} évaluation{n > 1 ? 's' : ''} sur {nombreFr(nombre)}
                  </span>
                  {/* Infobulle : au survol et au focus clavier, l'effectif derrière le pourcentage. */}
                  <span
                    aria-hidden
                    className="absolute bottom-full right-0 z-20 mb-1 hidden group-hover:block group-focus-visible:block"
                  >
                    <CadreInfobulle>
                      <LigneInfobulle
                        couleur={couleur}
                        valeur={nombreFr(n)}
                        libelle={`évaluation${n > 1 ? 's' : ''} ${libelle.toLowerCase()}`}
                        detail={`sur ${nombreFr(nombre)}`}
                      />
                    </CadreInfobulle>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-texte-4">4-5 étoiles positive · 3 neutre · 1-2 négative</p>
        </>
      )}
    </div>
  );
}

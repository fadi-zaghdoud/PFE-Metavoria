import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { CHOIX_PERIODE, type ChoixPeriode } from './periodes';

// Boutons de période de l'en-tête : un groupe de boutons radio (ARIA), une seule touche Tab
// pour y entrer, les flèches pour changer — le motif de la bascule de thème.
export function SelecteurPeriode({
  valeur,
  onChange,
}: {
  valeur: ChoixPeriode;
  onChange: (choix: ChoixPeriode) => void;
}) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  function clavier(evenement: KeyboardEvent<HTMLButtonElement>, index: number) {
    const sens =
      evenement.key === 'ArrowRight' || evenement.key === 'ArrowDown'
        ? 1
        : evenement.key === 'ArrowLeft' || evenement.key === 'ArrowUp'
          ? -1
          : 0;
    if (sens === 0) return;
    evenement.preventDefault();
    const suivant = (index + sens + CHOIX_PERIODE.length) % CHOIX_PERIODE.length;
    onChange(CHOIX_PERIODE[suivant].cle);
    boutons.current[suivant]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Période"
      className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-bordure bg-surface-2 p-0.5"
    >
      {CHOIX_PERIODE.map(({ cle, libelle, titre }, index) => {
        const actif = valeur === cle;
        return (
          <button
            key={cle}
            ref={(element) => {
              boutons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={actif}
            title={titre}
            tabIndex={actif ? 0 : -1}
            onClick={() => onChange(cle)}
            onKeyDown={(evenement) => clavier(evenement, index)}
            className={cn(
              'h-8 rounded-md px-2 text-sm font-medium transition-colors sm:px-3',
              actif ? 'bg-surface text-marque shadow-xs ring-1 ring-bordure' : 'text-texte-3 hover:bg-surface-3 hover:text-texte',
            )}
          >
            {libelle}
          </button>
        );
      })}
    </div>
  );
}

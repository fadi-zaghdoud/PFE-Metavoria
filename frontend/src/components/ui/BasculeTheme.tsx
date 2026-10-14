import { useRef, type KeyboardEvent } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from '../../lib/useTheme';
import type { PreferenceTheme } from '../../lib/theme';
import { cn } from '../../lib/cn';

const OPTIONS: { valeur: PreferenceTheme; libelle: string; icone: LucideIcon }[] = [
  { valeur: 'systeme', libelle: 'Thème du système', icone: Monitor },
  { valeur: 'clair', libelle: 'Thème clair', icone: Sun },
  { valeur: 'sombre', libelle: 'Thème sombre', icone: Moon },
];

// Bascule de thème à trois états. Groupe de boutons radio (ARIA) : une seule touche Tab
// pour entrer dans le groupe, les flèches pour changer de choix — le motif clavier attendu
// d'un groupe radio, et non trois arrêts de tabulation.
export function BasculeTheme({ className }: { className?: string }) {
  const { preference, choisir } = useTheme();
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
    const suivant = (index + sens + OPTIONS.length) % OPTIONS.length;
    choisir(OPTIONS[suivant].valeur);
    boutons.current[suivant]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'interface"
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-bordure bg-surface-2 p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ valeur, libelle, icone: Icone }, index) => {
        const actif = preference === valeur;
        return (
          <button
            key={valeur}
            ref={(element) => {
              boutons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={actif}
            aria-label={libelle}
            title={libelle}
            tabIndex={actif ? 0 : -1}
            onClick={() => choisir(valeur)}
            onKeyDown={(evenement) => clavier(evenement, index)}
            className={cn(
              'flex size-7 items-center justify-center rounded-md transition-colors',
              actif
                ? 'bg-surface text-marque shadow-xs ring-1 ring-bordure'
                : 'text-texte-4 hover:bg-surface-3 hover:text-texte-2',
            )}
          >
            <Icone className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

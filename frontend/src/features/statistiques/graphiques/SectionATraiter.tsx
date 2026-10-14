import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, UserX } from 'lucide-react';
import { StatutBadge } from '../../tickets/ticket-ui';
import { cn } from '../../../lib/cn';
import { nombreFr } from '../../../lib/format';
import type { ATraiterTableau } from '../tableauDeBordApi';

type Vue = 'sansPriseEnCharge' | 'plusAnciens';

const VUES: { cle: Vue; libelle: string; vide: string }[] = [
  { cle: 'sansPriseEnCharge', libelle: 'Sans prise en charge', vide: 'Aucun ticket en attente de prise en charge.' },
  { cle: 'plusAnciens', libelle: 'Plus anciens', vide: 'Aucun ticket ouvert.' },
];

// « À traiter » — le présent, sans période : le compte des tickets sans technicien, puis
// les plus anciens tickets ouverts, avec ou sans prise en charge. Chaque ticket porte sa
// pastille de statut (la même que partout) et son ancienneté ; un clic l'ouvre.
export function SectionATraiter({ donnees, lienAffecter }: { donnees: ATraiterTableau; lienAffecter: boolean }) {
  const [vue, setVue] = useState<Vue>('sansPriseEnCharge');
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  const liste = donnees[vue];
  const sansTechnicien = donnees.sansTechnicien;

  function clavier(evenement: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(evenement.key)) return;
    evenement.preventDefault();
    const suivant = (index + 1) % VUES.length;
    setVue(VUES[suivant].cle);
    boutons.current[suivant]?.focus();
  }

  const compteur = (
    <>
      <UserX className="size-5 shrink-0" aria-hidden />
      <span className="font-semibold">
        {nombreFr(sansTechnicien)} ticket{sansTechnicien > 1 ? 's' : ''} sans technicien
      </span>
    </>
  );

  return (
    <div>
      {sansTechnicien === 0 ? (
        <p className="flex items-center gap-3 rounded-xl bg-succes-fond px-4 py-3 text-sm text-succes-texte-fort">
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          Aucun ticket sans technicien
        </p>
      ) : lienAffecter ? (
        <Link
          to="/tickets?vue=non-assignes"
          title="Ouvrir la liste des tickets à affecter"
          className="flex items-center gap-3 rounded-xl bg-alerte-fond px-4 py-3 text-sm text-alerte-texte-fort transition-colors hover:bg-alerte-fond-2"
        >
          {compteur}
        </Link>
      ) : (
        <p className="flex items-center gap-3 rounded-xl bg-alerte-fond px-4 py-3 text-sm text-alerte-texte-fort">
          {compteur}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Tickets à afficher"
        className="mt-4 inline-flex items-center gap-0.5 rounded-lg border border-bordure bg-surface-2 p-0.5"
      >
        {VUES.map(({ cle, libelle }, index) => {
          const actif = vue === cle;
          return (
            <button
              key={cle}
              ref={(element) => {
                boutons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif ? 0 : -1}
              onClick={() => setVue(cle)}
              onKeyDown={(evenement) => clavier(evenement, index)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                actif ? 'bg-surface text-marque shadow-xs ring-1 ring-bordure' : 'text-texte-3 hover:bg-surface-3 hover:text-texte',
              )}
            >
              {libelle} <span className="tabular-nums text-texte-4">{nombreFr(donnees[cle].total)}</span>
            </button>
          );
        })}
      </div>

      {liste.tickets.length === 0 ? (
        <p className="py-8 text-center text-sm text-texte-4">{VUES.find((v) => v.cle === vue)?.vide}</p>
      ) : (
        <ul className="mt-2 divide-y divide-bordure-faible">
          {liste.tickets.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets/${t.id}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="w-12 shrink-0 text-sm tabular-nums text-texte-4">#{t.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-texte" title={t.titre}>
                  {t.titre}
                </span>
                <span
                  className="shrink-0 text-xs tabular-nums text-texte-4"
                  title={`Ouvert depuis ${nombreFr(t.joursOuvert)} jour${t.joursOuvert > 1 ? 's' : ''}`}
                >
                  {nombreFr(t.joursOuvert)} j
                </span>
                <StatutBadge statut={t.statut} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {liste.total > liste.tickets.length && (
        <p className="mt-2 text-xs text-texte-4">
          Les {nombreFr(liste.tickets.length)} plus anciens sur {nombreFr(liste.total)}.
        </p>
      )}
    </div>
  );
}

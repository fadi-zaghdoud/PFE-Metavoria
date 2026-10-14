import { cn } from '../../../lib/cn';
import { nombreFr } from '../../../lib/format';
import type { PartGraphique } from './couleurs';

// Légende chiffrée, toujours visible : chaque part avec sa pastille, son libellé et sa
// valeur. L'identité ne repose jamais sur la seule couleur, et la valeur se lit sans survol.
export function Legende({ parts }: { parts: PartGraphique[] }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm">
      {parts.map((p) => (
        <li key={p.cle} className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-sm', p.pastille)} aria-hidden />
          <span className="truncate text-texte-3" title={p.libelle}>
            {p.libelle}
          </span>
          <span className="ml-auto pl-2 font-medium tabular-nums text-texte">{nombreFr(p.valeur)}</span>
        </li>
      ))}
    </ul>
  );
}

import type { ReactNode } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../lib/cn';

// Socle commun aux trois propriétés modifiables d'un ticket — priorité, technicien,
// catégorie. Toutes trois étaient des <select> natifs, qui ne savent afficher que du
// texte : ni la photo d'un technicien, ni l'icône colorée d'une priorité n'y entraient.
// Le choix passe donc par une boîte de dialogue, et le même socle sert les trois pour que
// le panneau reste homogène — trois contrôles d'aspects différents pour trois lignes
// voisines se verraient immédiatement.

export interface OptionChoix {
  cle: string | number;
  // Pastille de gauche : avatar, icône de priorité, marqueur de catégorie.
  visuel: ReactNode;
  libelle: string;
  // Deuxième ligne, discrète : service d'un technicien, description d'une catégorie.
  detail?: string | null;
  // Mention à droite, avant la coche : « absent → 02/10 ».
  annotation?: ReactNode;
}

// ── Déclencheur ──────────────────────────────────────────────────────────────
// Remplace le <select> dans le panneau. Porte le visuel de la valeur courante, ce que
// l'ancien contrôle ne pouvait pas faire.
export function BoutonPropriete({
  visuel,
  libelle,
  vide = false,
  disabled = false,
  ariaLabel,
  onClick,
}: {
  visuel: ReactNode;
  libelle: string;
  // true : aucune valeur choisie — le libellé est une invite, pas un contenu.
  vide?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  // `min-w-0` DEUX FOIS, et c'est nécessaire : le bouton est une cellule de grille et le
  // libellé un élément flex, or les deux ont `min-width: auto` par défaut — « au moins la
  // largeur de mon contenu ». Sans cela, « Choisir une catégorie… » pousse la piste de
  // grille et le bouton déborde de la carte au lieu d'être tronqué.
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-bordure-forte bg-surface px-2 py-1.5 text-left shadow-xs transition-colors hover:border-bordure-survol hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {visuel}
      <span className={cn('min-w-0 flex-1 truncate text-sm', vide ? 'text-texte-4' : 'text-texte-2')}>
        {libelle}
      </span>
      <ChevronDown className="ml-auto size-4 shrink-0 text-texte-4" aria-hidden />
    </button>
  );
}

// Emplacement vide, aux dimensions d'un Avatar `md`, pour que la hauteur du bouton ne
// change pas selon qu'une valeur est choisie ou non.
export function PastilleVide() {
  return (
    <span
      className="size-8 shrink-0 rounded-full border border-dashed border-bordure-forte"
      aria-hidden
    />
  );
}

// ── Boîte de choix ───────────────────────────────────────────────────────────
export function DialogChoix({
  ouvert,
  onClose,
  titre,
  description,
  options,
  cleActuelle,
  onChoisir,
  enCours,
  actionRetrait,
  messageVide = 'Aucune option disponible.',
}: {
  ouvert: boolean;
  onClose: () => void;
  titre: string;
  description?: string;
  options: OptionChoix[];
  cleActuelle: string | number | null;
  onChoisir: (cle: string | number) => void;
  enCours: boolean;
  // Rangée séparée sous la liste (« Retirer l'affectation »). Ce n'est pas un choix parmi
  // les options, c'est l'action inverse — d'où la séparation.
  actionRetrait?: ReactNode;
  messageVide?: string;
}) {
  return (
    <Dialog open={ouvert} onClose={onClose} title={titre} description={description}>
      <ul className="-mx-1 max-h-[22rem] space-y-0.5 overflow-y-auto px-1">
        {options.map((o) => {
          const actuel = o.cle === cleActuelle;
          return (
            <li key={o.cle}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => onChoisir(o.cle)}
                aria-current={actuel}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  actuel ? 'bg-marque-fond ring-1 ring-inset ring-marque/15' : 'hover:bg-surface-2',
                )}
              >
                {o.visuel}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-texte">
                    {o.libelle}
                  </span>
                  {o.detail && (
                    <span className="block truncate text-xs text-texte-4">{o.detail}</span>
                  )}
                </span>
                {o.annotation}
                {actuel && <Check className="size-4 shrink-0 text-marque" aria-hidden />}
              </button>
            </li>
          );
        })}

        {options.length === 0 && (
          <li className="px-2.5 py-6 text-center text-sm text-texte-4">{messageVide}</li>
        )}
      </ul>

      {actionRetrait}

      {enCours && (
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-texte-4">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Enregistrement…
        </p>
      )}
    </Dialog>
  );
}

import { Check, Loader2, UserMinus } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import type { Utilisateur } from '../../types/auth';
import { cn } from '../../lib/cn';

// « 2026-10-02 » -> « 02/10 ». Découpe de chaîne et non new Date(...) : construire une
// date à partir du jour seul la placerait à minuit UTC et pourrait afficher la veille
// dans un fuseau à décalage négatif. Même raisonnement que le tableau de bord.
function jourCourt(jour: string): string {
  const [, mois, j] = jour.split('-');
  return mois && j ? `${j}/${mois}` : jour;
}

interface Props {
  // Le ticket visé, ou null quand le sélecteur est fermé. Porté par la page et non par la
  // ligne : un seul Dialog pour toute la table, pas un par ligne.
  ticket: { id: number; titre: string; technicienId: number | null } | null;
  techniciens: Utilisateur[];
  enCours: boolean;
  onChoisir: (technicienId: number | null) => void;
  onClose: () => void;
}

// Choix du technicien dans une boîte de dialogue plutôt que dans un <select> natif : un
// <option> ne peut pas contenir d'image, et un menu positionné dans la cellule serait
// rogné par le `overflow-auto` du conteneur de table. Le Dialog existant apporte déjà
// l'échappement, le piège de focus et la fermeture au clic sur le fond — rien de tout cela
// n'est réécrit ici.
export function SelecteurTechnicien({ ticket, techniciens, enCours, onChoisir, onClose }: Props) {
  return (
    <Dialog
      open={ticket !== null}
      onClose={onClose}
      title={ticket ? `Affecter le ticket #${ticket.id}` : 'Affecter'}
      description={ticket?.titre}
    >
      <ul className="-mx-1 max-h-[22rem] space-y-0.5 overflow-y-auto px-1">
        {techniciens.map((t) => {
          const actuel = t.id === ticket?.technicienId;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => onChoisir(actuel ? null : t.id)}
                aria-current={actuel}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  actuel
                    ? 'bg-primary-50 ring-1 ring-inset ring-primary-600/15'
                    : 'hover:bg-slate-50',
                )}
              >
                <Avatar prenom={t.prenom} nom={t.nom} photoUrl={t.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {t.prenom} {t.nom}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {t.service ?? 'Service non renseigné'}
                  </span>
                </span>

                {/* L'absence est affichée SANS SON MOTIF : elle vient de la même source que
                    la charge du tableau de bord, où MALADIE est une donnée de santé qui ne
                    sort jamais de la page Absences. Seule la date de fin remonte — de quoi
                    décider sans rien révéler. */}
                {t.absenceJusquau && (
                  <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    absent → {jourCourt(t.absenceJusquau)}
                  </span>
                )}
                {actuel && <Check className="size-4 shrink-0 text-primary-600" aria-hidden />}
              </button>
            </li>
          );
        })}

        {techniciens.length === 0 && (
          <li className="px-2.5 py-6 text-center text-sm text-slate-400">
            Aucun technicien actif à proposer.
          </li>
        )}
      </ul>

      {/* Retirer l'affectation — séparé de la liste : ce n'est pas un choix de personne,
          c'est l'action inverse. Proposé seulement quand il y a quelque chose à retirer. */}
      {ticket?.technicienId != null && (
        <button
          type="button"
          disabled={enCours}
          onClick={() => onChoisir(null)}
          className="mt-2 flex w-full items-center gap-2 rounded-xl border-t border-slate-100 px-2.5 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserMinus className="size-4 shrink-0" aria-hidden />
          Retirer l'affectation
        </button>
      )}

      {enCours && (
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Enregistrement…
        </p>
      )}
    </Dialog>
  );
}

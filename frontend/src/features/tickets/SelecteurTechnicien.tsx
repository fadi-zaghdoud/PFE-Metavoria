import { UserMinus } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import type { Utilisateur } from '../../types/auth';
import { DialogChoix, type OptionChoix } from './ChoixPropriete';

// « 2026-10-02 » -> « 02/10 ». Découpe de chaîne et non new Date(...) : construire une
// date à partir du jour seul la placerait à minuit UTC et pourrait afficher la veille
// dans un fuseau à décalage négatif. Même raisonnement que le tableau de bord.
function jourCourt(jour: string): string {
  const [, mois, j] = jour.split('-');
  return mois && j ? `${j}/${mois}` : jour;
}

interface Props {
  // Le ticket visé, ou null quand le sélecteur est fermé.
  ticket: { id: number; titre: string; technicienId: number | null } | null;
  techniciens: Utilisateur[];
  enCours: boolean;
  onChoisir: (technicienId: number | null) => void;
  onClose: () => void;
}

// Choix du technicien : la seule des trois propriétés dont les options portent une PHOTO,
// et la raison première d'avoir quitté le <select> natif.
export function SelecteurTechnicien({ ticket, techniciens, enCours, onChoisir, onClose }: Props) {
  const options: OptionChoix[] = techniciens.map((t) => ({
    cle: t.id,
    visuel: <Avatar prenom={t.prenom} nom={t.nom} photoUrl={t.photoUrl} />,
    libelle: `${t.prenom} ${t.nom}`,
    detail: t.service ?? 'Service non renseigné',
    // L'absence est affichée SANS SON MOTIF : elle vient de la même source que la charge
    // du tableau de bord, où MALADIE est une donnée de santé qui ne sort jamais de la page
    // Absences. Seule la date de fin remonte — de quoi décider sans rien révéler.
    // Le technicien absent reste SÉLECTIONNABLE : l'administrateur peut sciemment lui
    // confier un ticket pour son retour. La mention évite de choisir à l'aveugle, elle
    // n'interdit rien.
    annotation: t.absenceJusquau ? (
      <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        absent → {jourCourt(t.absenceJusquau)}
      </span>
    ) : undefined,
  }));

  return (
    <DialogChoix
      ouvert={ticket !== null}
      onClose={onClose}
      titre={ticket ? `Affecter le ticket #${ticket.id}` : 'Affecter'}
      description={ticket?.titre}
      options={options}
      cleActuelle={ticket?.technicienId ?? null}
      onChoisir={(cle) => onChoisir(Number(cle))}
      enCours={enCours}
      messageVide="Aucun technicien actif à proposer."
      actionRetrait={
        ticket?.technicienId != null ? (
          <button
            type="button"
            disabled={enCours}
            onClick={() => onChoisir(null)}
            className="mt-2 flex w-full items-center gap-2 rounded-xl border-t border-slate-100 px-2.5 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserMinus className="size-4 shrink-0" aria-hidden />
            Retirer l'affectation
          </button>
        ) : undefined
      }
    />
  );
}

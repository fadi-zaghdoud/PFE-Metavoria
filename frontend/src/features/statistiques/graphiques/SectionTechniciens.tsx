import { Fragment, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock, Inbox } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { dureeHeuresFr, nombreFr } from '../../../lib/format';
import { aujourdhuiUtc, jourLisible } from '../periodes';
import type { PeriodeTableau, TechnicienTableau, TechniciensTableau } from '../tableauDeBordApi';
import { CadreInfobulle, LigneInfobulle } from './Infobulle';

// Lignes montrées avant « N autres actifs » : trois, comme la maquette — la carte garde ainsi
// la hauteur de ses voisines (priorités, satisfaction) sur grand écran.
const LIGNES_VISIBLES = 3;

const jourCourt = (jour: string) => jourLisible(jour, { day: '2-digit', month: '2-digit' });
const s = (n: number) => (n > 1 ? 's' : '');

// En-tête de la colonne des nombres, à droite du titre de la carte (vue de l'équipe) : les
// tickets ouverts au dernier jour de la période — aujourd'hui, sauf pour une période passée.
export function ColonneOuverts({ periode }: { periode: PeriodeTableau }) {
  return (
    <span className="shrink-0 text-xs text-texte-4">
      {periode.au === aujourdhuiUtc() ? 'ouverts' : `ouverts au ${jourCourt(periode.au)}`}
    </span>
  );
}

// Une absence en cours n'est donnée que par sa date de fin — jamais par son motif, que le
// serveur ne transmet pas.
const Absence = ({ jour }: { jour: string }) => (
  <span className="rounded bg-alerte-fond-2 px-1.5 font-semibold text-alerte-texte">absent jusqu'au {jourCourt(jour)}</span>
);

// Un technicien : avatar à initiales (pas de photo), nom, tickets résolus sur la période et
// leur temps moyen ; à droite, ses tickets ouverts.
function LigneTechnicien({ t, finPeriode }: { t: TechnicienTableau; finPeriode: string }) {
  const { ouverts, resolus } = t;
  return (
    <li
      tabIndex={0}
      className="group relative -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <Avatar prenom={t.prenom} nom={t.nom} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-texte">
          {t.prenom} {t.nom}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texte-4">
          {t.absenceJusquau && <Absence jour={t.absenceJusquau} />}
          <span>
            {resolus > 0
              ? `${nombreFr(resolus)} résolu${s(resolus)} · ${dureeHeuresFr(t.tempsResolution.heures)} en moyenne`
              : 'Aucun ticket résolu sur la période'}
          </span>
        </p>
      </div>
      <span className="shrink-0 text-base font-semibold tabular-nums text-texte">
        {nombreFr(ouverts)}
        <span className="sr-only">
          {' '}
          ticket{s(ouverts)} ouvert{s(ouverts)}
        </span>
      </span>
      {/* Infobulle : au survol et au focus clavier, ce que mesure chaque nombre. */}
      <span
        aria-hidden
        className="absolute bottom-full right-0 z-20 mb-1 hidden group-hover:block group-focus-visible:block"
      >
        <CadreInfobulle>
          <LigneInfobulle valeur={nombreFr(ouverts)} libelle={`ticket${s(ouverts)} ouvert${s(ouverts)}`} detail={finPeriode} />
          <LigneInfobulle valeur={nombreFr(resolus)} libelle={`résolu${s(resolus)}`} detail="sur la période" />
          {resolus > 0 && (
            <LigneInfobulle
              valeur={dureeHeuresFr(t.tempsResolution.heures)}
              libelle="de résolution en moyenne"
              detail={`sur ${nombreFr(resolus)} ticket${s(resolus)}`}
            />
          )}
          {t.absenceJusquau && <p className="mt-1 text-texte-4">Absent jusqu'au {jourLisible(t.absenceJusquau)}</p>}
        </CadreInfobulle>
      </span>
    </li>
  );
}

// Vue d'un technicien (décision D7) : sa seule activité — son nom, puis trois lignes aux
// icônes des cartes du haut.
function MonActivite({ t, finPeriode }: { t: TechnicienTableau; finPeriode: string }) {
  const { ouverts, resolus } = t;
  const lignes = [
    { cle: 'ouverts', icone: Inbox, libelle: `Ticket${s(ouverts)} ouvert${s(ouverts)}`, detail: finPeriode, valeur: nombreFr(ouverts) },
    { cle: 'resolus', icone: CheckCircle2, libelle: `Résolu${s(resolus)}`, detail: 'sur la période', valeur: nombreFr(resolus) },
    {
      cle: 'temps',
      icone: Clock,
      libelle: 'Temps moyen de résolution',
      detail: resolus > 0 ? `sur ${nombreFr(resolus)} ticket${s(resolus)}` : undefined,
      valeur: dureeHeuresFr(t.tempsResolution.heures),
    },
  ];
  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar prenom={t.prenom} nom={t.nom} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-texte">
            {t.prenom} {t.nom}
          </p>
          {t.absenceJusquau && (
            <p className="mt-0.5 text-xs">
              <Absence jour={t.absenceJusquau} />
            </p>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-0.5" data-graphique="techniciens">
        {lignes.map(({ cle, icone: Icone, libelle, detail, valeur }) => (
          <li key={cle} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5">
            <Icone className="size-5 shrink-0 text-marque" aria-hidden />
            <span className="min-w-0 text-sm text-texte-2">
              {libelle}
              {detail && <span className="text-texte-4"> · {detail}</span>}
            </span>
            <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-texte">{valeur}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Les techniciens actifs sur la période — un ticket ouvert à sa fin ou résolu en son cours —,
// les plus chargés d'abord ; les autres résumés en une ligne. L'administrateur voit l'équipe ;
// un technicien, sa seule activité (décision D7 : la section nomme des collègues).
export function SectionTechniciens({ donnees, vueEquipe }: { donnees: TechniciensTableau; vueEquipe: boolean }) {
  const [deplie, setDeplie] = useState(false);
  const { techniciens, sansActivite, periode } = donnees;
  const finPeriode = periode.au === aujourdhuiUtc() ? "aujourd'hui" : `au ${jourLisible(periode.au)}`;

  if (!vueEquipe) {
    return techniciens.length === 0 ? (
      <p className="py-10 text-center text-sm text-texte-4">Aucune activité sur la période.</p>
    ) : (
      <MonActivite t={techniciens[0]} finPeriode={finPeriode} />
    );
  }

  const visibles = deplie ? techniciens : techniciens.slice(0, LIGNES_VISIBLES);
  const autres = techniciens.length - visibles.length;
  const mentions: { cle: string; contenu: ReactNode }[] = [];
  if (autres > 0) {
    mentions.push({
      cle: 'autres',
      contenu: (
        <button
          type="button"
          onClick={() => setDeplie(true)}
          aria-expanded={false}
          className="font-medium text-marque underline-offset-2 hover:underline"
        >
          {nombreFr(autres)} autre{s(autres)} actif{s(autres)}
        </button>
      ),
    });
  } else if (deplie && techniciens.length > LIGNES_VISIBLES) {
    mentions.push({
      cle: 'reduire',
      contenu: (
        <button
          type="button"
          onClick={() => setDeplie(false)}
          aria-expanded
          className="font-medium text-marque underline-offset-2 hover:underline"
        >
          Réduire la liste
        </button>
      ),
    });
  }
  if (sansActivite > 0) mentions.push({ cle: 'sans', contenu: `${nombreFr(sansActivite)} sans activité` });

  return (
    <div>
      {techniciens.length === 0 ? (
        <p className="py-8 text-center text-sm text-texte-4">Aucun technicien actif sur la période.</p>
      ) : (
        <ul className="space-y-0.5" data-graphique="techniciens">
          {visibles.map((t) => (
            <LigneTechnicien key={t.id} t={t} finPeriode={finPeriode} />
          ))}
        </ul>
      )}
      {mentions.length > 0 && (
        <p className="mt-3 text-xs text-texte-4">
          {mentions.map(({ cle, contenu }, i) => (
            <Fragment key={cle}>
              {i > 0 && ' · '}
              {contenu}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

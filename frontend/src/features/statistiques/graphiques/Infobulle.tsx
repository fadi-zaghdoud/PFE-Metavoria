import type { ReactNode } from 'react';
import type { PartGraphique } from './couleurs';

// Infobulle commune aux graphiques. La VALEUR mène, le libellé suit : au survol, on
// connaît déjà la série et l'on cherche le nombre. La clé de couleur est un court trait,
// pas un pavé plein. Le texte reste en jetons de texte, jamais à la couleur de la série.
export function CadreInfobulle({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none rounded-lg border border-bordure bg-surface px-3 py-2 text-xs shadow-md">
      {children}
    </div>
  );
}

export function LigneInfobulle({
  couleur,
  valeur,
  libelle,
  detail,
}: {
  couleur?: string;
  valeur: string;
  libelle: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      {couleur && (
        <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: couleur }} aria-hidden />
      )}
      <span className="font-semibold tabular-nums text-texte">{valeur}</span>
      <span className="text-texte-3">{libelle}</span>
      {detail && <span className="text-texte-4">· {detail}</span>}
    </div>
  );
}

// Infobulle d'un secteur d'anneau ou de jauge : effectif, part du total. Les propriétés
// `active` et `payload` sont celles que Recharts transmet à un contenu d'infobulle ; elles
// sont typées au plus juste, sans dépendre des types internes de la bibliothèque.
export function InfobulleSecteur({
  active,
  payload,
  total,
  unite,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  total: number;
  unite: string;
}) {
  const part = payload?.[0]?.payload as PartGraphique | undefined;
  if (!active || !part) return null;
  const pourcentage = total > 0 ? (part.valeur / total).toLocaleString('fr-FR', { style: 'percent', maximumFractionDigits: 1 }) : '—';
  return (
    <CadreInfobulle>
      <LigneInfobulle
        couleur={part.couleur}
        valeur={part.valeur.toLocaleString('fr-FR')}
        libelle={part.libelle}
        detail={pourcentage}
      />
      <p className="mt-1 text-texte-4">
        sur {total.toLocaleString('fr-FR')} {unite}
      </p>
    </CadreInfobulle>
  );
}

import type { ReactNode } from 'react';
import { Card } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';

// Carte d'une section du tableau de bord : titre discret en tête, sans filet, puis le
// graphique. Une seule présentation pour toutes les sections — l'œil compare les contenus,
// pas les cadres. La carte survolée (ou qui a le focus) passe au premier plan : chaque
// carte animée forme son propre contexte d'empilement, et l'infobulle de l'anneau, qui
// déborde, passait sous la carte voisine.
export function CarteGraphique({
  titre,
  sousTitre,
  action,
  children,
  className,
}: {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('animate-fade-up relative p-5 hover:z-10 focus-within:z-10', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-texte">{titre}</h2>
          {sousTitre && <p className="mt-0.5 text-xs text-texte-4">{sousTitre}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

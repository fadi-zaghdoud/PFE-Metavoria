import { lazy, Suspense } from 'react';
import { useAuthStore } from '../store/authStore';
import { PageHeader } from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';

// Le tableau de bord et ses graphiques (Recharts) forment un morceau chargé à la demande :
// les autres écrans n'en paient pas le poids.
const TableauDeBord = lazy(() =>
  import('../features/statistiques/TableauDeBord').then((m) => ({ default: m.TableauDeBord })),
);

// Le bandeau d'accueil, le bloc « Utilisateurs » et la liste des derniers comptes créés
// ont quitté la page (groupe 1 du tableau de bord) : un titre sobre les remplace, et plus
// aucune adresse e-mail n'apparaît sur le tableau de bord.
const DESCRIPTIONS: Record<string, string> = {
  ADMINISTRATEUR: "Vue d'ensemble des tickets et du support.",
  TECHNICIEN: 'Vos tickets à traiter et les indicateurs du support.',
  EMPLOYE: 'Suivez vos demandes de support et créez de nouveaux tickets.',
};

function ChargementTableau() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement du tableau de bord">
      <Skeleton className="h-[76px] rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const utilisateur = useAuthStore((state) => state.utilisateur);

  if (!utilisateur) return null;

  return (
    <div>
      <PageHeader title="Tableau de bord" description={DESCRIPTIONS[utilisateur.role]} />
      <Suspense fallback={<ChargementTableau />}>
        <TableauDeBord />
      </Suspense>
    </div>
  );
}

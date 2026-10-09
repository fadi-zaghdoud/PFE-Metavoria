import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserCircle,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import { TableauDeBord } from '../features/statistiques/TableauDeBord';
import type { Utilisateur } from '../types/auth';
import { dateLongue, LABELS_ROLE, tempsRelatif } from '../lib/format';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

function StatsAdmin() {
  const token = useAuthStore((state) => state.token);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!token) return;
    utilisateursApi
      .lister({}, token)
      .then(({ utilisateurs: liste }) => setUtilisateurs(liste))
      .catch(() => setErreur(true));
  }, [token]);

  const stats = useMemo(() => {
    if (!utilisateurs) return null;
    return {
      total: utilisateurs.length,
      actifs: utilisateurs.filter((u) => u.actif).length,
      techniciens: utilisateurs.filter((u) => u.role === 'TECHNICIEN').length,
      admins: utilisateurs.filter((u) => u.role === 'ADMINISTRATEUR').length,
      recents: utilisateurs.slice(0, 5),
    };
  }, [utilisateurs]);

  if (erreur) return null;

  // Chiffres de composition de l'annuaire : quasi statiques, et aucun n'appelle d'action.
  // Ils occupaient quatre StatCard identiques à celles des indicateurs de tickets, et cette
  // seconde rangée de quatre entrait en concurrence avec la première — celle qui, elle,
  // porte « À affecter ». Même information, une seule carte, chrome neutre : pas de
  // dégradé ni d'aura, pour qu'elle se lise comme un sous-titre et non comme un indicateur.
  const COMPOSITION: { label: string; valeur: number; icon: LucideIcon }[] = stats
    ? [
        { label: 'Comptes', valeur: stats.total, icon: Users },
        { label: 'Actifs', valeur: stats.actifs, icon: UserCheck },
        { label: 'Techniciens', valeur: stats.techniciens, icon: Wrench },
        { label: 'Administrateurs', valeur: stats.admins, icon: ShieldCheck },
      ]
    : [];

  return (
    <>
      {stats ? (
        <Card className="animate-fade-up p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COMPOSITION.map(({ label, valeur, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-texte-4"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight tabular-nums text-texte">
                    {valeur}
                  </p>
                  <p className="truncate text-xs text-texte-4">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Skeleton className="h-[76px] rounded-2xl" />
      )}

      <Card className="mt-6">
        <CardHeader
          title="Derniers comptes créés"
          actions={
            <Link
              to="/administration/utilisateurs"
              className="inline-flex items-center gap-1 text-xs font-medium text-marque transition-colors hover:text-marque-fort hover:underline"
            >
              Tout voir <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <CardContent className="p-2">
          {stats ? (
            <ul className="divide-y divide-bordure-faible">
              {stats.recents.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <Avatar prenom={u.prenom} nom={u.nom} photoUrl={u.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texte">
                      {u.prenom} {u.nom}
                    </p>
                    <p className="truncate text-xs text-texte-4">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'ADMINISTRATEUR' ? 'primary' : 'neutral'}>
                    {LABELS_ROLE[u.role]}
                  </Badge>
                  <span className="hidden text-xs text-texte-4 sm:block">
                    {tempsRelatif(u.dateCreation)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DashboardPage() {
  const utilisateur = useAuthStore((state) => state.utilisateur);

  if (!utilisateur) return null;

  const estAdmin = utilisateur.role === 'ADMINISTRATEUR';

  const DESCRIPTIONS: Record<string, string> = {
    ADMINISTRATEUR: "Vue d'ensemble de la plateforme, des tickets et des utilisateurs.",
    TECHNICIEN: 'Vos tickets à traiter et les indicateurs du support.',
    EMPLOYE: 'Suivez vos demandes de support et créez de nouveaux tickets.',
  };

  return (
    <div className="space-y-8">
      {/* Bienvenue — carte plate : le bandeau en dégradé est retiré (consigne du 09/10). Le
          bloc reste jusqu'à l'arrivée de l'en-tête du tableau de bord, qui le remplacera. */}
      <Card className="animate-fade-up p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-texte-4">
              {dateLongue(new Date())}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-texte md:text-3xl">
              Bonjour, {utilisateur.prenom} 👋
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-texte-3">
              {DESCRIPTIONS[utilisateur.role]}
            </p>
          </div>
          <Link
            to="/profil"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-bordure bg-surface px-4 text-sm font-medium text-texte-2 shadow-xs transition-colors hover:border-bordure-forte hover:bg-surface-2"
          >
            <UserCircle className="size-4" aria-hidden />
            Mon profil
          </Link>
        </div>
      </Card>

      <TableauDeBord />

      {estAdmin && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-texte">Utilisateurs</h2>
          <StatsAdmin />
        </div>
      )}
    </div>
  );
}

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
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight tabular-nums text-slate-900">
                    {valeur}
                  </p>
                  <p className="truncate text-xs text-slate-500">{label}</p>
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
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline"
            >
              Tout voir <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <CardContent className="p-2">
          {stats ? (
            <ul className="divide-y divide-slate-100">
              {stats.recents.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
                >
                  <Avatar prenom={u.prenom} nom={u.nom} photoUrl={u.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.prenom} {u.nom}
                    </p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'ADMINISTRATEUR' ? 'primary' : 'neutral'}>
                    {LABELS_ROLE[u.role]}
                  </Badge>
                  <span className="hidden text-xs text-slate-400 sm:block">
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
      {/* Hero de bienvenue — bannière de marque */}
      <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 p-6 text-white shadow-glow md:p-8">
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <span aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
        <span aria-hidden className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">
              {dateLongue(new Date())}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight md:text-3xl">
              Bonjour, {utilisateur.prenom} 👋
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">
              {DESCRIPTIONS[utilisateur.role]}
            </p>
          </div>
          <Link
            to="/profil"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur transition-colors hover:bg-white/20"
          >
            <UserCircle className="size-4" aria-hidden />
            Mon profil
          </Link>
        </div>
      </div>

      <TableauDeBord />

      {estAdmin && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Utilisateurs</h2>
          <StatsAdmin />
        </div>
      )}
    </div>
  );
}

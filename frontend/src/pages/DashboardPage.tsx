import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  Star,
  Ticket,
  UserCheck,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import { ticketsApi } from '../features/tickets/ticketsApi';
import type { Utilisateur } from '../types/auth';
import type { StatistiquesTickets } from '../types/ticket';
import { dateLongue, LABELS_ROLE, tempsRelatif } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

// Cartes "modules à venir" — feuille de route du cahier des charges.
const MODULES_A_VENIR = [
  {
    icon: BrainCircuit,
    titre: 'Assistant IA',
    texte: 'Classification automatique, priorisation et suggestions de résolution.',
    phase: 'Phase 5',
  },
  {
    icon: ShieldCheck,
    titre: 'Statistiques & SLA',
    texte: 'Rapports détaillés, temps de résolution et délais SLA.',
    phase: 'Phase 4',
  },
];

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

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Utilisateurs" value={stats.total} icon={Users} tone="primary" />
            <StatCard label="Comptes actifs" value={stats.actifs} icon={UserCheck} tone="success" />
            <StatCard label="Techniciens" value={stats.techniciens} icon={Wrench} tone="warning" />
            <StatCard label="Administrateurs" value={stats.admins} icon={ShieldCheck} tone="neutral" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        )}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Derniers comptes créés"
          actions={
            <Link
              to="/administration/utilisateurs"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
            >
              Tout voir <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <CardContent className="p-2">
          {stats ? (
            <ul className="divide-y divide-slate-100">
              {stats.recents.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar prenom={u.prenom} nom={u.nom} />
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

// Indicateurs tickets + satisfaction, adaptés au périmètre de l'utilisateur
// (ses propres tickets pour un employé, l'ensemble pour le support/admin).
function StatsTickets() {
  const token = useAuthStore((state) => state.token);
  const [stats, setStats] = useState<StatistiquesTickets | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!token) return;
    ticketsApi
      .statistiques(token)
      .then(setStats)
      .catch(() => setErreur(true));
  }, [token]);

  if (erreur) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Tickets" value={stats.totalTickets} icon={Ticket} tone="primary" />
            <StatCard label="Ouverts" value={stats.ticketsOuverts} icon={Inbox} tone="warning" />
            <StatCard
              label="Résolus / clôturés"
              value={stats.ticketsResolus + stats.ticketsClotures}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Satisfaction moyenne"
              value={stats.satisfactionMoyenne != null ? `${stats.satisfactionMoyenne} / 5` : '—'}
              hint={`${stats.nombreEvaluations} évaluation${stats.nombreEvaluations > 1 ? 's' : ''}`}
              icon={Star}
              tone="warning"
            />
          </>
        ) : (
          ['s1', 's2', 's3', 's4'].map((k) => <Skeleton key={k} className="h-[104px] rounded-xl" />)
        )}
      </div>

      {stats && stats.nombreEvaluations > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Répartition des évaluations"
            description={`${stats.nombreEvaluations} évaluation${stats.nombreEvaluations > 1 ? 's' : ''}`}
          />
          <CardContent className="space-y-2">
            {[...stats.repartitionSatisfaction].reverse().map(({ note, count }) => {
              const pct = stats.nombreEvaluations
                ? Math.round((count / stats.nombreEvaluations) * 100)
                : 0;
              return (
                <div key={note} className="flex items-center gap-3">
                  <span className="flex w-9 items-center gap-1 text-xs text-slate-500">
                    {note}
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-slate-400">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
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
    <div>
      <PageHeader
        eyebrow={dateLongue(new Date())}
        title={`Bonjour, ${utilisateur.prenom} 👋`}
        description={DESCRIPTIONS[utilisateur.role]}
        actions={
          <Link
            to="/profil"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            <UserCircle className="size-4" aria-hidden />
            Mon profil
          </Link>
        }
      />

      <StatsTickets />

      {estAdmin && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Utilisateurs</h2>
          <StatsAdmin />
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Feuille de route du projet</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MODULES_A_VENIR.map(({ icon: Icon, titre, texte, phase }) => (
          <Card key={titre} className="flex flex-col p-5 transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <Badge variant="neutral">{phase}</Badge>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{titre}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{texte}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
